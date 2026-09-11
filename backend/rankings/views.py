from rest_framework import viewsets, permissions, generics, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count, F
from django.db import transaction
from django.utils import timezone
from django.core.cache import cache
from decouple import config

from mathify.permissions import IsHostOrReadOnly
from .models import Badge, UserBadge, Competition, Score, CompetitionQuestion, QuestionSubmission, CompetitionParticipant
from .serializers import (
    BadgeSerializer, UserBadgeSerializer,
    CompetitionSerializer, CompetitionQuestionSerializer, ScoreSerializer, LeaderboardEntrySerializer,
)


class BadgeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = BadgeSerializer
    queryset = Badge.objects.all()


class UserBadgeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = UserBadgeSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = UserBadge.objects.select_related('user', 'badge')
        user_id = self.request.query_params.get('user')
        if user_id:
            return qs.filter(user_id=user_id)
        if self.request.user.is_authenticated:
            return qs.filter(user=self.request.user)
        return qs.none()


class CompetitionViewSet(viewsets.ModelViewSet):
    serializer_class = CompetitionSerializer
    queryset = Competition.objects.filter(is_active=True).prefetch_related('questions', 'registrations')

    def get_permissions(self):
        if self.action in ['create', 'destroy', 'update', 'partial_update']:
            return [IsHostOrReadOnly()]
        if self.action in ['register', 'answer', 'add_question']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticatedOrReadOnly()]

    def perform_create(self, serializer):
        comp = serializer.save(created_by=self.request.user)
        # Host is automatically registered
        CompetitionParticipant.objects.get_or_create(competition=comp, user=self.request.user)

        questions_data = self.request.data.get('questions', [])
        if isinstance(questions_data, list):
            for idx, q_item in enumerate(questions_data, start=1):
                prompt = q_item.get('prompt', '').strip()
                ans = str(q_item.get('answer', '')).strip()
                pts = int(q_item.get('points', 10))
                if prompt and ans:
                    CompetitionQuestion.objects.create(
                        competition=comp,
                        prompt=prompt,
                        answer=ans,
                        points=pts,
                        order=idx
                    )

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def register(self, request, pk=None):
        competition = self.get_object()
        part, created = CompetitionParticipant.objects.get_or_create(
            competition=competition, user=request.user
        )
        return Response({
            'registered': True,
            'detail': 'Successfully registered for this competition!' if created else 'Already registered.'
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def answer(self, request, pk=None):
        competition = self.get_object()
        question_id = request.data.get('question_id')
        user_ans = str(request.data.get('answer', '')).strip()

        if not question_id or not user_ans:
            return Response({'detail': 'question_id and answer are required.'}, status=status.HTTP_400_BAD_REQUEST)

        question = competition.questions.filter(id=question_id).first()
        if not question:
            return Response({'detail': 'Question not found in this competition.'}, status=status.HTTP_404_NOT_FOUND)

        # Check if already answered correctly
        submission, created = QuestionSubmission.objects.get_or_create(
            user=request.user, question=question,
            defaults={'user_answer': user_ans, 'is_correct': False, 'points_awarded': 0}
        )
        if not created and submission.is_correct:
            return Response({
                'detail': 'You have already answered this question correctly!',
                'correct': True,
                'points_awarded': submission.points_awarded
            })

        # Answer comparison: normalize whitespace, remove formatting characters and case
        def normalize(val):
            return ''.join(str(val).lower().replace('$', '').replace('\\', '').replace(' ', ''))

        is_correct = normalize(user_ans) == normalize(question.answer)
        submission.user_answer = user_ans
        submission.is_correct = is_correct

        points = 0
        if is_correct:
            points = question.points
            submission.points_awarded = points

            # Atomically award points strictly for this question
            with transaction.atomic():
                profile = request.user.profile
                profile.axiom_points = F('axiom_points') + points
                profile.save()
                profile.refresh_from_db(fields=['axiom_points'])

                score_comp, _ = Score.objects.select_for_update().get_or_create(
                    user=request.user, period=Score.PERIOD_ALL_TIME, competition=competition,
                    defaults={'points': 0}
                )
                score_comp.points = F('points') + points
                score_comp.save()

                score_global, _ = Score.objects.select_for_update().get_or_create(
                    user=request.user, period=Score.PERIOD_ALL_TIME, competition=None,
                    defaults={'points': 0}
                )
                score_global.points = F('points') + points
                score_global.save()

                # Invalidate cached leaderboard
                cache.delete(f"leaderboard_{Score.PERIOD_ALL_TIME}")

        submission.save()

        if is_correct:
            return Response({
                'correct': True,
                'points_awarded': points,
                'total_points': request.user.profile.axiom_points,
                'detail': f'Brilliant! Correct solution. +{points} Axiom Points awarded.'
            })
        else:
            return Response({
                'correct': False,
                'points_awarded': 0,
                'detail': 'Incorrect answer. Re-evaluate your derivation and try again.'
            })

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def add_question(self, request, pk=None):
        competition = self.get_object()
        if competition.created_by != request.user and not request.user.is_staff and not request.user.is_superuser:
            return Response({'detail': 'Only the organizer of this competition can add questions.'}, status=status.HTTP_403_FORBIDDEN)

        prompt = request.data.get('prompt', '').strip()
        ans = str(request.data.get('answer', '')).strip()
        pts = int(request.data.get('points', 10))

        if not prompt or not ans:
            return Response({'detail': 'Prompt and answer are required.'}, status=status.HTTP_400_BAD_REQUEST)

        order = competition.questions.count() + 1
        q = CompetitionQuestion.objects.create(
            competition=competition,
            prompt=prompt,
            answer=ans,
            points=pts,
            order=order
        )
        return Response(CompetitionQuestionSerializer(q, context={'request': request}).data, status=status.HTTP_201_CREATED)


class LeaderboardView(generics.ListAPIView):
    """
    GET /api/rankings/leaderboard/?period=weekly
    Returns ranked list of users by total points for the given period.
    Cached dynamically via LEADERBOARD_CACHE_TTL.
    """
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def list(self, request, *args, **kwargs):
        period = request.query_params.get('period', Score.PERIOD_ALL_TIME)
        cache_key = f"leaderboard_{period}"
        cache_ttl = config('LEADERBOARD_CACHE_TTL', default=60, cast=int)

        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return Response(cached_data)

        # Single optimized query with badge_count annotation (eliminates N+1 queries)
        scores = (
            Score.objects
            .filter(period=period, competition__isnull=True)
            .select_related('user')
            .annotate(badge_count=Count('user__earned_badges', distinct=True))
            .order_by('-points')[:100]
        )

        data = []
        if scores.exists():
            for rank, score in enumerate(scores, start=1):
                prof = getattr(score.user, 'profile', None)
                data.append({
                    'rank': rank,
                    'user': score.user.username or score.user.email.split('@')[0],
                    'username': score.user.username or score.user.email.split('@')[0],
                    'points': score.points,
                    'badge_count': score.badge_count,
                    'institution': prof.department.name if prof and prof.department else 'Mathematical Sciences',
                    'specialty': prof.bio if prof and prof.bio else 'Pure Mathematics',
                    'proofs_count': score.user.creations.count() if hasattr(score.user, 'creations') else 0,
                })
        else:
            from accounts.models import Profile
            profiles = Profile.objects.select_related('user', 'department').order_by('-axiom_points', '-created_at')[:100]
            for rank, prof in enumerate(profiles, start=1):
                data.append({
                    'rank': rank,
                    'user': prof.user.username or prof.user.email.split('@')[0],
                    'username': prof.user.username or prof.user.email.split('@')[0],
                    'points': prof.axiom_points,
                    'badge_count': prof.user.earned_badges.count() if hasattr(prof.user, 'earned_badges') else 0,
                    'institution': prof.department.name if prof.department else 'Mathematical Sciences',
                    'specialty': prof.bio if prof.bio else 'Pure Mathematics',
                    'proofs_count': prof.user.creations.count() if hasattr(prof.user, 'creations') else 0,
                })

        serializer = LeaderboardEntrySerializer(data, many=True)
        response_data = serializer.data
        if cache_ttl > 0:
            cache.set(cache_key, response_data, cache_ttl)
        return Response(response_data)


class ScoreViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only viewset for scores to prevent client-side score tampering.
    Points can only be awarded through verified endpoints.
    """
    serializer_class = ScoreSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Score.objects.all()
    throttle_scope = 'score_award'

    @action(detail=False, methods=['post'])
    def award_points(self, request):
        competition_id = request.data.get('competition_id')
        if not competition_id:
            return Response({'detail': 'competition_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        comp = Competition.objects.filter(id=competition_id, is_active=True).first()
        if not comp:
            return Response({'detail': 'Active competition not found.'}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        if now < comp.start_date or now > comp.end_date:
            return Response({'detail': 'Competition is not currently active.'}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        # Dynamic point determination: from competition model or environment default
        points = getattr(comp, 'points_reward', None) or config('COMPETITION_DEFAULT_POINTS', default=10, cast=int)

        # Atomic transaction to prevent concurrency race conditions & duplicate awards
        with transaction.atomic():
            profile = user.profile

            # Check if user has already claimed participation points for this competition
            score_comp, created = Score.objects.select_for_update().get_or_create(
                user=user, period=Score.PERIOD_ALL_TIME, competition=comp,
                defaults={'points': 0}
            )
            if not created and score_comp.points >= points:
                return Response(
                    {'detail': 'Points for this competition have already been awarded.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Atomically increment scores
            score_comp.points = F('points') + points
            score_comp.save()

            score_global, _ = Score.objects.select_for_update().get_or_create(
                user=user, period=Score.PERIOD_ALL_TIME, competition=None,
                defaults={'points': 0}
            )
            score_global.points = F('points') + points
            score_global.save()

            profile.axiom_points = F('axiom_points') + points
            profile.save()

            # Refresh values after F-expression updates
            profile.refresh_from_db(fields=['axiom_points'])
            score_global.refresh_from_db(fields=['points'])
            score_comp.refresh_from_db(fields=['points'])

            # Invalidate cached leaderboards on score update
            cache.delete(f"leaderboard_{Score.PERIOD_ALL_TIME}")

        return Response({
            'axiom_points': profile.axiom_points,
            'global_points': score_global.points,
            'competition_points': score_comp.points
        })