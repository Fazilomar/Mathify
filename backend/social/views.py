from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Group, GroupMembership, Message, Call, CallSignal
from .serializers import GroupSerializer, GroupMembershipSerializer, MessageSerializer, CallSerializer


class GroupViewSet(viewsets.ModelViewSet):
    serializer_class = GroupSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'messages', 'current_call', 'call_signals']:
            return [permissions.IsAuthenticatedOrReadOnly()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = Group.objects.prefetch_related('memberships')
        
        joined = self.request.query_params.get('joined')
        if joined == 'true':
            if self.request.user.is_authenticated:
                qs = qs.filter(memberships__user=self.request.user)
            else:
                return qs.none()
        elif joined == 'false' and self.request.user.is_authenticated:
            qs = qs.exclude(memberships__user=self.request.user)

        query = self.request.query_params.get('q')
        if query:
            from django.db.models import Q
            qs = qs.filter(Q(name__icontains=query) | Q(description__icontains=query))
        group_type = self.request.query_params.get('group_type')
        if group_type:
            qs = qs.filter(group_type=group_type)
        return qs

    def perform_create(self, serializer):
        group = serializer.save(created_by=self.request.user)
        # creator becomes admin automatically
        GroupMembership.objects.create(
            user=self.request.user, group=group, role=GroupMembership.ROLE_ADMIN
        )

    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        group = self.get_object()
        membership, created = GroupMembership.objects.get_or_create(
            user=request.user, group=group
        )
        if not created:
            return Response({'detail': 'Already a member.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(GroupMembershipSerializer(membership).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def leave(self, request, pk=None):
        group = self.get_object()
        GroupMembership.objects.filter(user=request.user, group=group).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get', 'post'])
    def messages(self, request, pk=None):
        group = self.get_object()
        if request.method == 'POST':
            content = request.data.get('content', '').strip()
            if not content:
                return Response({'detail': 'Message content cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)
            if not request.user.is_authenticated:
                return Response({'detail': 'Authentication required to post in study groups.'}, status=status.HTTP_401_UNAUTHORIZED)
            
            # Ensure membership or automatically join if public
            GroupMembership.objects.get_or_create(user=request.user, group=group)
            msg = Message.objects.create(
                sender=request.user,
                group=group,
                content=content
            )
            return Response(MessageSerializer(msg).data, status=status.HTTP_201_CREATED)

        qs = group.messages.select_related('sender').order_by('created_at')
        since_id = request.query_params.get('since_id')
        if since_id and since_id.isdigit():
            qs = qs.filter(id__gt=int(since_id))
        return Response(MessageSerializer(qs, many=True).data)

    @action(detail=True, methods=['get', 'post'])
    def current_call(self, request, pk=None):
        from django.utils import timezone
        group = self.get_object()
        call = group.calls.filter(status__in=[Call.STATUS_PENDING, Call.STATUS_ACTIVE]).first()

        if request.method == 'POST':
            if not request.user.is_authenticated:
                return Response({'detail': 'Authentication required to start or join seminar call.'}, status=status.HTTP_401_UNAUTHORIZED)
            
            if not call:
                call = Call.objects.create(
                    initiator=request.user,
                    group=group,
                    status=Call.STATUS_ACTIVE,
                    started_at=timezone.now()
                )
            call.participants.add(request.user)
            if call.status != Call.STATUS_ACTIVE:
                call.status = Call.STATUS_ACTIVE
                call.save()
            return Response(CallSerializer(call).data, status=status.HTTP_200_OK)

        if call:
            return Response(CallSerializer(call).data)
        return Response({'status': 'idle', 'participants_count': 0})

    @action(detail=True, methods=['post'])
    def leave_call(self, request, pk=None):
        from django.utils import timezone
        group = self.get_object()
        call = group.calls.filter(status__in=[Call.STATUS_PENDING, Call.STATUS_ACTIVE]).first()
        if call and request.user.is_authenticated:
            call.participants.remove(request.user)
            if call.participants.count() == 0:
                call.status = Call.STATUS_ENDED
                call.ended_at = timezone.now()
                call.save()
            return Response(CallSerializer(call).data)
        return Response({'status': 'none'})

    @action(detail=True, methods=['post'])
    def end_call(self, request, pk=None):
        from django.utils import timezone
        group = self.get_object()
        call = group.calls.filter(status__in=[Call.STATUS_PENDING, Call.STATUS_ACTIVE]).first()
        if call:
            call.status = Call.STATUS_ENDED
            call.ended_at = timezone.now()
            call.save()
            try:
                Message.objects.create(
                    sender=request.user,
                    group=group,
                    content=f"[MEETING]:{call.id}:{call.meeting_code}:{call.title}:{request.user.username}:ended:"
                )
            except Exception:
                pass
            return Response(CallSerializer(call).data)
        return Response({'status': 'none'})


    @action(detail=True, methods=['get', 'post'])
    def call_signals(self, request, pk=None):
        import datetime
        from django.utils import timezone
        from django.db.models import Q
        group = self.get_object()

        # Proactively ensure CallSignal table exists
        try:
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS social_callsignal (
                        id BIGSERIAL PRIMARY KEY,
                        signal_type VARCHAR(50) NOT NULL,
                        payload JSONB DEFAULT '{}'::jsonb,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        call_id BIGINT,
                        group_id BIGINT NOT NULL,
                        recipient_id BIGINT,
                        sender_id BIGINT NOT NULL
                    );
                """)
        except Exception:
            pass

        if request.method == 'POST':
            if not request.user.is_authenticated:
                return Response({'detail': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
            recipient_username = request.data.get('recipient')
            signal_type = request.data.get('type', '')
            payload = request.data.get('payload', {})

            recipient = None
            if recipient_username:
                from accounts.models import CustomUser
                recipient = CustomUser.objects.filter(username=recipient_username).first()

            call = group.calls.filter(status=Call.STATUS_ACTIVE).first()
            try:
                sig = CallSignal.objects.create(
                    call=call,
                    group=group,
                    sender=request.user,
                    recipient=recipient,
                    signal_type=signal_type,
                    payload=payload
                )
                # Cleanup older signals (> 3 mins)
                cutoff = timezone.now() - datetime.timedelta(minutes=3)
                CallSignal.objects.filter(group=group, created_at__lt=cutoff).delete()
                return Response({'status': 'ok', 'id': sig.id}, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # GET signals
        if not request.user.is_authenticated:
            return Response([])

        since_id = request.query_params.get('since_id', 0)
        try:
            qs = CallSignal.objects.filter(group=group).filter(
                Q(recipient=request.user) | Q(recipient__isnull=True)
            ).exclude(sender=request.user)

            if since_id and str(since_id).isdigit() and int(since_id) > 0:
                qs = qs.filter(id__gt=int(since_id))

            signals_data = [{
                'id': s.id,
                'sender': s.sender.username,
                'recipient': s.recipient.username if s.recipient else None,
                'type': s.signal_type,
                'payload': s.payload,
                'created_at': s.created_at.isoformat()
            } for s in qs[:60]]
            return Response(signals_data)
        except Exception:
            return Response([])

    @action(detail=True, methods=['get', 'post'])
    def meetings(self, request, pk=None):
        import uuid
        from django.utils import timezone
        from django.db.models import Q
        group = self.get_object()

        if request.method == 'GET':
            calls = group.calls.filter(
                Q(status=Call.STATUS_ACTIVE) | Q(status=Call.STATUS_PENDING)
            ).order_by('-created_at')[:20]
            return Response(CallSerializer(calls, many=True).data)

        # POST: create instant or scheduled meeting
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)

        title = request.data.get('title', '').strip() or f"{group.name} Seminar"
        description = request.data.get('description', '').strip()
        scheduled_for_raw = request.data.get('scheduled_for')
        is_instant = request.data.get('is_instant', True)
        if isinstance(is_instant, str):
            is_instant = is_instant.lower() in ('true', '1', 'yes')

        scheduled_for = None
        if scheduled_for_raw:
            try:
                from django.utils.dateparse import parse_datetime
                scheduled_for = parse_datetime(scheduled_for_raw)
            except Exception:
                scheduled_for = None

        unique_suffix = uuid.uuid4().hex[:6]
        meeting_code = f"mtf-{unique_suffix[:3]}-{unique_suffix[3:]}"

        existing_active = group.calls.filter(status=Call.STATUS_ACTIVE).first()
        if is_instant and existing_active:
            existing_active.participants.add(request.user)
            return Response(CallSerializer(existing_active).data)

        status_val = Call.STATUS_ACTIVE if is_instant else Call.STATUS_PENDING
        started_at_val = timezone.now() if is_instant else None

        call = Call.objects.create(
            initiator=request.user,
            group=group,
            title=title,
            description=description,
            meeting_code=meeting_code,
            is_instant=is_instant,
            status=status_val,
            started_at=started_at_val,
            scheduled_for=scheduled_for,
        )
        if is_instant:
            call.participants.add(request.user)

        # Drop meeting card into group chat
        try:
            msg_status = "active" if is_instant else "scheduled"
            sched_str = call.scheduled_for.isoformat() if call.scheduled_for else ""
            Message.objects.create(
                sender=request.user,
                group=group,
                content=f"[MEETING]:{call.id}:{call.meeting_code}:{call.title}:{request.user.username}:{msg_status}:{sched_str}"
            )
        except Exception:
            pass

        return Response(CallSerializer(call).data, status=status.HTTP_201_CREATED)


class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return Message.objects.none()
        return Message.objects.filter(
            sender=self.request.user
        ) | Message.objects.filter(recipient=self.request.user)

    def perform_create(self, serializer):
        serializer.save(sender=self.request.user)

    @action(detail=False, methods=['get'])
    def conversations(self, request):
        from django.db.models import Q
        user = request.user
        # Find all direct messages (where group is null and sender or recipient is current user)
        direct_msgs = Message.objects.filter(
            group__isnull=True
        ).filter(
            Q(sender=user) | Q(recipient=user)
        ).order_by('-created_at')
        
        seen_partners = set()
        conversations = []
        for msg in direct_msgs:
            partner = msg.recipient if msg.sender == user else msg.sender
            if not partner or partner.id in seen_partners:
                continue
            seen_partners.add(partner.id)
            
            # Serialize partner using UserSerializer
            from accounts.serializers import UserSerializer
            conversations.append({
                'id': partner.id,
                'user': UserSerializer(partner).data,
                'last_message': {
                    'content': msg.content,
                    'media': msg.media.url if msg.media else None,
                    'created_at': msg.created_at,
                    'sender': msg.sender.username
                }
            })
            
        return Response(conversations)

    @action(detail=False, methods=['get'])
    def history(self, request):
        from django.db.models import Q
        user_id = request.query_params.get('user_id')
        if not user_id:
            return Response({'detail': 'user_id query param required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        user = request.user
        messages = Message.objects.filter(
            group__isnull=True
        ).filter(
            (Q(sender=user) & Q(recipient_id=user_id)) |
            (Q(sender_id=user_id) & Q(recipient=user))
        ).order_by('created_at')
        
        # Mark incoming messages as read
        messages.filter(recipient=user, is_read=False).update(is_read=True)
        
        return Response(MessageSerializer(messages, many=True).data)


class CallViewSet(viewsets.ModelViewSet):
    serializer_class = CallSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return Call.objects.none()
        from django.db.models import Q
        user = self.request.user
        return Call.objects.filter(
            Q(initiator=user) | Q(group__memberships__user=user)
        ).distinct()

    def perform_create(self, serializer):
        import uuid
        from django.utils import timezone
        unique_suffix = uuid.uuid4().hex[:6]
        code = f"mtf-{unique_suffix[:3]}-{unique_suffix[3:]}"
        call = serializer.save(
            initiator=self.request.user,
            meeting_code=code,
            status=Call.STATUS_ACTIVE,
            started_at=timezone.now()
        )
        call.participants.add(self.request.user)

    @action(detail=False, methods=['get'], url_path='by-code/(?P<code>[^/.]+)', permission_classes=[permissions.AllowAny])
    def by_code(self, request, code=None):
        call = Call.objects.filter(meeting_code=code).first()
        if not call:
            return Response({'detail': 'Meeting not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(CallSerializer(call).data)

    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        from django.utils import timezone
        call = self.get_object()
        if call.status == Call.STATUS_ENDED:
            return Response({'detail': 'Call has already ended.'}, status=status.HTTP_400_BAD_REQUEST)
        call.participants.add(request.user)
        if call.status == Call.STATUS_PENDING:
            call.status = Call.STATUS_ACTIVE
            if not call.started_at:
                call.started_at = timezone.now()
            call.save()
        return Response(CallSerializer(call).data)

    @action(detail=True, methods=['post'])
    def leave(self, request, pk=None):
        from django.utils import timezone
        call = self.get_object()
        call.participants.remove(request.user)
        if call.participants.count() == 0:
            call.status = Call.STATUS_ENDED
            call.ended_at = timezone.now()
            call.save()
        return Response(CallSerializer(call).data)

    @action(detail=True, methods=['post'])
    def end(self, request, pk=None):
        from django.utils import timezone
        call = self.get_object()
        call.status = Call.STATUS_ENDED
        call.ended_at = timezone.now()
        call.save()
        if call.group:
            try:
                Message.objects.create(
                    sender=request.user,
                    group=call.group,
                    content=f"[MEETING]:{call.id}:{call.meeting_code}:{call.title}:{request.user.username}:ended:"
                )
            except Exception:
                pass
        return Response(CallSerializer(call).data)