from django.http import StreamingHttpResponse
from django.conf import settings
from rest_framework import viewsets, permissions, status, views
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
import os
import urllib.request
import urllib.error
import json
import time
from decouple import config
from django.utils import timezone
from rankings.models import Score, Competition
from .models import TutorProfile, ChatSession, SessionMessage
from .serializers import TutorProfileSerializer, ChatSessionSerializer, ChatSessionListSerializer, SessionMessageSerializer, SendMessageSerializer


def _resolve_gemini_key():
    key = getattr(settings, 'GEMINI_API_KEY', None) or os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY')
    if not key:
        try:
            key = config('GEMINI_API_KEY', default=None) or config('GOOGLE_API_KEY', default=None)
        except Exception:
            pass
    return key.strip() if key else None

class TutorProfileViewSet(viewsets.ReadOnlyModelViewSet):
    """Directory of available AI tutors."""
    serializer_class = TutorProfileSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = TutorProfile.objects.filter(is_active=True)
        subject = self.request.query_params.get('subject')
        if subject:
            qs = qs.filter(subject=subject)
        return qs


class ChatSessionViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = 'ai_tutor'

    def get_serializer_class(self):
        if self.action == 'list':
            return ChatSessionListSerializer
        return ChatSessionSerializer

    def get_queryset(self):
        return (
            ChatSession.objects
            .filter(user=self.request.user)
            .select_related('tutor')
            .prefetch_related('messages')
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'], url_path='send')
    def send_message(self, request, pk=None):
        """
        POST /api/ai-tutor/sessions/<id>/send/
        Body: { "content": "..." }

        Saves the user message, calls the AI, saves and returns the assistant reply.
        """
        session = self.get_object()
        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user_content = serializer.validated_data['content']
        file_data = serializer.validated_data.get('file_data')
        file_name = serializer.validated_data.get('file_name')
        file_mime = serializer.validated_data.get('file_mime')

        # Save the user turn
        SessionMessage.objects.create(
            session=session,
            role=SessionMessage.ROLE_USER,
            content=user_content,
            file_data=file_data,
            file_name=file_name,
            file_mime=file_mime
        )

        # Build message history for the AI call
        history = [
            {
                'role': m.role,
                'content': m.content,
                'file_data': m.file_data,
                'file_mime': m.file_mime,
                'file_name': m.file_name,
            }
            for m in SessionMessage.objects.filter(session=session)
        ]
        
        ai_content = self._get_ai_reply(session, history)
        assistant_msg = SessionMessage.objects.create(
            session=session, role=SessionMessage.ROLE_ASSISTANT, content=ai_content
        )

        session.save(update_fields=['updated_at'])

        return Response(
            SessionMessageSerializer(assistant_msg).data,
            status=status.HTTP_201_CREATED,
        )

    # AI integration 
    @action(detail=True, methods=['post'], url_path='send-stream')
    def send_stream(self, request, pk=None):
        """
        POST /api/ai-tutor/sessions/<id>/send-stream/
        Body: { "content": "..." }

        Returns a StreamingHttpResponse yielding Server-Sent Events (SSE).
        """
        session = self.get_object()
        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user_content = serializer.validated_data['content']
        file_data = serializer.validated_data.get('file_data')
        file_name = serializer.validated_data.get('file_name')
        file_mime = serializer.validated_data.get('file_mime')

        SessionMessage.objects.create(
            session=session,
            role=SessionMessage.ROLE_USER,
            content=user_content,
            file_data=file_data,
            file_name=file_name,
            file_mime=file_mime
        )

        history = [
            {
                'role': m.role,
                'content': m.content,
                'file_data': m.file_data,
                'file_mime': m.file_mime,
                'file_name': m.file_name,
            }
            for m in SessionMessage.objects.filter(session=session)
        ]

        # Return response
        response = StreamingHttpResponse(
            self._stream_ai_reply(session, history),
            content_type='text/event-stream'
        )
        response['X-Accel-Buffering'] = 'no'  
        return response

    def _stream_ai_reply(self, session: ChatSession, history: list):
        

        # 1. call system prompt
        has_tutor = False
        try:
            has_tutor = bool(session and session.tutor)
        except Exception:
            has_tutor = False

        default_prompt = (
            'You are the Mathify AI Theorem Research Mentor. You explain mathematical concepts and derivations '
            'with rigorous academic precision. ALWAYS format mathematical expressions using standard LaTeX notation: '
            'use $...$ for inline formulas (e.g. $e^{i\\pi} + 1 = 0$, $x \\in \\mathbb{R}$) and $$...$$ for block '
            'display equations on their own lines. Use clean Markdown headings (##, ###) and bullet points for derivations.'
        )
        system_prompt = (session.tutor.model_config.get('system_prompt', '')
                         if has_tutor and session.tutor.model_config.get('system_prompt') else default_prompt)

        user = None
        try:
            user = session.user if session else None
        except Exception:
            user = None

        system_prompt = f"{system_prompt}\n\n{self._get_app_context_prompt(user)}"
        
        # 2. call api keys
        gemini_key = _resolve_gemini_key()
        full_text = ""

        # 3. Stream from Gemini REST
        if gemini_key:
            try:
                model_name = getattr(session.tutor, 'model_name', None) or config('GEMINI_DEFAULT_MODEL', default='gemini-2.5-flash')
                timeout_val = config('AI_TIMEOUT_SECONDS', default=15, cast=int)
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:streamGenerateContent?alt=sse&key={gemini_key}"
                contents = []
                for m in history:
                    role = 'model' if m['role'] == 'assistant' else 'user'
                    parts = []
                    if m.get('file_data') and m.get('file_mime'):
                        parts.append({
                            "inlineData": {
                                "mimeType": m['file_mime'],
                                "data": m['file_data']
                            }
                        })
                    parts.append({"text": m['content']})
                    contents.append({
                        "role": role,
                        "parts": parts
                    })
                
                payload = {
                    "contents": contents,
                    "systemInstruction": {
                        "parts": [{"text": system_prompt}]
                    }
                }
                
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode('utf-8'),
                    headers={'Content-Type': 'application/json'},
                    method='POST'
                )
                
                with urllib.request.urlopen(req, timeout=timeout_val) as response:
                    for line in response:
                        if line.startswith(b'data: '):
                            data_str = line[6:].decode('utf-8').strip()
                            try:
                                chunk_data = json.loads(data_str)
                                text_chunk = chunk_data['candidates'][0]['content']['parts'][0].get('text', '')
                                if text_chunk:
                                    full_text += text_chunk
                                    yield f"data: {json.dumps({'text': text_chunk})}\n\n"
                            except Exception:
                                pass

                if full_text:
                    if session and getattr(session, 'id', None):
                        SessionMessage.objects.create(
                            session=session, role=SessionMessage.ROLE_ASSISTANT, content=full_text
                        )
                        session.save(update_fields=['updated_at'])
                yield f"data: {json.dumps({'done': True})}\n\n"
                return
            except urllib.error.HTTPError as e:
                try:
                    err_body = e.read().decode('utf-8')
                    err_json = json.loads(err_body)
                    details = err_json.get('error', {}).get('message', str(e))
                except Exception:
                    details = str(e)
                err_msg = f"[AI Tutor Connection Error (Gemini Stream)]: {details}"
                yield f"data: {json.dumps({'text': err_msg})}\n\n"
                if session and getattr(session, 'id', None):
                    SessionMessage.objects.create(
                        session=session, role=SessionMessage.ROLE_ASSISTANT, content=err_msg
                    )
                yield f"data: {json.dumps({'done': True})}\n\n"
                return
            except Exception as e:
                err_msg = f"[AI Tutor Connection Error (Gemini Stream)]: {str(e)}"
                yield f"data: {json.dumps({'text': err_msg})}\n\n"
                if session and getattr(session, 'id', None):
                    SessionMessage.objects.create(
                        session=session, role=SessionMessage.ROLE_ASSISTANT, content=err_msg
                    )
                yield f"data: {json.dumps({'done': True})}\n\n"
                return

        # If no gemini key is configured
        err_msg = "⚠️ Live Gemini AI Reasoning Engine is not configured. Please supply a valid GEMINI_API_KEY in your .env file."
        yield f"data: {json.dumps({'text': err_msg})}\n\n"
        if session and getattr(session, 'id', None):
            SessionMessage.objects.create(
                session=session, role=SessionMessage.ROLE_ASSISTANT, content=err_msg
            )
        yield f"data: {json.dumps({'done': True})}\n\n"

        default_prompt = (
            'You are the Mathify AI Theorem Research Mentor. You explain mathematical concepts and derivations '
            'with rigorous academic precision. ALWAYS format mathematical expressions using standard LaTeX notation: '
            'use $...$ for inline formulas (e.g. $e^{i\\pi} + 1 = 0$, $x \\in \\mathbb{R}$) and $$...$$ for block '
            'display equations on their own lines. Use clean Markdown headings (##, ###) and bullet points for derivations.'
        )
        system_prompt = (session.tutor.model_config.get('system_prompt', '')
                         if session and session.tutor and session.tutor.model_config.get('system_prompt') else default_prompt)
        
        user = None
        if session:
            try:
                user = session.user
            except Exception:
                user = None

        system_prompt = f"{system_prompt}\n\n{self._get_app_context_prompt(user)}"
        
        gemini_key = _resolve_gemini_key()

        if gemini_key:
            try:
                model_name = getattr(session.tutor, 'model_name', None) or config('GEMINI_DEFAULT_MODEL', default='gemini-2.5-flash')
                timeout_val = config('AI_TIMEOUT_SECONDS', default=15, cast=int)
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
                contents = []
                for m in history:
                    role = 'model' if m['role'] == 'assistant' else 'user'
                    parts = []
                    if m.get('file_data') and m.get('file_mime'):
                        parts.append({
                            "inlineData": {
                                "mimeType": m['file_mime'],
                                "data": m['file_data']
                            }
                        })
                    parts.append({"text": m['content']})
                    contents.append({
                        "role": role,
                        "parts": parts
                    })
                payload = {"contents": contents, "systemInstruction": {"parts": [{"text": system_prompt}]}}
                req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'}, method='POST')
                with urllib.request.urlopen(req, timeout=timeout_val) as response:
                    res_data = json.loads(response.read().decode('utf-8'))
                    return res_data['candidates'][0]['content']['parts'][0]['text']
            except urllib.error.HTTPError as e:
                try:
                    err_body = e.read().decode('utf-8')
                    err_json = json.loads(err_body)
                    details = err_json.get('error', {}).get('message', str(e))
                except Exception:
                    details = str(e)
                return f"[AI Tutor Connection Error (Gemini)]: {details}"
            except Exception as e:
                return f"[AI Tutor Connection Error (Gemini)]: {str(e)}"

        return "⚠️ Live Gemini AI Reasoning Engine is not configured. Please supply a valid GEMINI_API_KEY in your .env file."

    def _get_app_context_prompt(self, user):

        # Active Competitions
        active_comps = Competition.objects.filter(is_active=True, end_date__gt=timezone.now())
        comps_list = []
        for c in active_comps:
            comps_list.append(f"- Competition: '{c.name}' (ID: {c.id}). Description: {c.description}. Active until {c.end_date.strftime('%Y-%m-%d %H:%M')}.")
        comps_str = "\n".join(comps_list) if comps_list else "There are currently no active competitions."

        # Global Standings
        top_scores = Score.objects.filter(period=Score.PERIOD_ALL_TIME, competition__isnull=True).select_related('user').order_by('-points')[:5]
        leaderboard_list = []
        for i, s in enumerate(top_scores, 1):
            leaderboard_list.append(f"Rank {i}: {s.user.username} with {s.points} points.")
        leaderboard_str = "\n".join(leaderboard_list) if leaderboard_list else "No scores recorded on the leaderboard yet."

        # User's status
        user_points = 0
        user_rank = "Unranked"
        username = getattr(user, 'username', 'Guest')
        if getattr(user, 'is_authenticated', False):
            try:
                profile = getattr(user, 'profile', None)
                if profile:
                    user_points = profile.axiom_points
                user_score = Score.objects.filter(user=user, period=Score.PERIOD_ALL_TIME, competition__isnull=True).first()
                if user_score:
                    user_rank = Score.objects.filter(period=Score.PERIOD_ALL_TIME, competition__isnull=True, points__gt=user_score.points).count() + 1
            except Exception:
                pass

        return f"""
[MATHIFY EVENT & STANDING STATUS]
- Active Competitions:
{comps_str}
- Global Leaderboard (Top 5):
{leaderboard_str}
- Current User Status:
  * Username: @{username}
  * Points: {user_points}
  * Rank: {user_rank}

- Rules/Participation Info:
  * Publish a proof by going to the Math Studio, creating a creation, choosing 'Public' visibility, and saving it (+50 pts).
  * Participate in live competitions by visiting the 'Competitions' page, viewing active events, and solving/submitting solutions (+10 pts per submit).
  * Direct the user if they get lost!
  * You can assist user on how to solve a problem and give a perfect explanation of the problem and help user visit the basics of the problem so they get a better understanding of it.
"""


from rest_framework.renderers import BaseRenderer, JSONRenderer, BrowsableAPIRenderer


class ServerSentEventRenderer(BaseRenderer):
    media_type = 'text/event-stream'
    format = 'event-stream'

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


class ChatAPIView(APIView):
    """
    POST /api/ai-tutor/chat/
    Body: { "message": "...", "session_id": 123 (optional) }
    Unified chat endpoint used by the React AITutorPage.
    """
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'ai_tutor'
    renderer_classes = [JSONRenderer, ServerSentEventRenderer, BrowsableAPIRenderer]

    def post(self, request):
        from rest_framework.response import Response
        user_message = request.data.get('message', '').strip() or request.data.get('content', '').strip()
        if not user_message:
            return Response({'error': 'Message content cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

        session_id = request.data.get('session_id')
        user = request.user if request.user.is_authenticated else None

        session = None
        if session_id and user:
            session = ChatSession.objects.filter(id=session_id, user=user).first()

        if not session and user:
            title = user_message[:35] + ('...' if len(user_message) > 35 else '')
            session = ChatSession.objects.create(user=user, title=title)

        want_stream = (
            request.query_params.get('stream') == 'true' or
            request.data.get('stream') is True or
            'text/event-stream' in request.headers.get('Accept', '')
        )

        if session:
            SessionMessage.objects.create(
                session=session, role=SessionMessage.ROLE_USER, content=user_message
            )
            history = [
                {'role': m.role, 'content': m.content}
                for m in SessionMessage.objects.filter(session=session)
            ]
            helper = ChatSessionViewSet()

            if want_stream:
                def stream_gen():
                    # Send session_id first so frontend can bind session
                    yield f"data: {json.dumps({'session_id': session.id})}\n\n"
                    yield from helper._stream_ai_reply(session, history)

                resp = StreamingHttpResponse(stream_gen(), content_type='text/event-stream')
                resp['X-Accel-Buffering'] = 'no'
                resp['Cache-Control'] = 'no-cache'
                return resp

            ai_reply = helper._get_ai_reply(session, history)
            SessionMessage.objects.create(
                session=session, role=SessionMessage.ROLE_ASSISTANT, content=ai_reply
            )
            session.save(update_fields=['updated_at'])
            return Response({
                'response': ai_reply,
                'reply': ai_reply,
                'content': ai_reply,
                'session_id': session.id,
            })
        else:
            # Guest session fallback
            mock_session = ChatSession(title="Guest Session")
            helper = ChatSessionViewSet()
            history = [{'role': 'user', 'content': user_message}]

            if want_stream:
                def stream_gen():
                    yield f"data: {json.dumps({'session_id': None})}\n\n"
                    yield from helper._stream_ai_reply(mock_session, history)

                resp = StreamingHttpResponse(stream_gen(), content_type='text/event-stream')
                resp['X-Accel-Buffering'] = 'no'
                resp['Cache-Control'] = 'no-cache'
                return resp

            ai_reply = helper._get_ai_reply(mock_session, history)
            return Response({
                'response': ai_reply,
                'reply': ai_reply,
                'content': ai_reply,
                'session_id': None,
            })