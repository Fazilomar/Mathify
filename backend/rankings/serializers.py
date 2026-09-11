from rest_framework import serializers
from django.utils import timezone
from datetime import timedelta
from .models import Badge, UserBadge, Competition, Score, CompetitionQuestion, QuestionSubmission


class BadgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Badge
        fields = ['id', 'name', 'description', 'icon', 'criteria', 'points_required']


class UserBadgeSerializer(serializers.ModelSerializer):
    badge = BadgeSerializer(read_only=True)
    user = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = UserBadge
        fields = ['id', 'user', 'badge', 'awarded_at']


class CompetitionQuestionSerializer(serializers.ModelSerializer):
    is_answered = serializers.SerializerMethodField()
    is_correct = serializers.SerializerMethodField()

    class Meta:
        model = CompetitionQuestion
        fields = ['id', 'prompt', 'points', 'order', 'is_answered', 'is_correct']
        read_only_fields = ['id', 'is_answered', 'is_correct']

    def get_is_answered(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.submissions.filter(user=request.user).exists()
        return False

    def get_is_correct(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            sub = obj.submissions.filter(user=request.user).first()
            return sub.is_correct if sub else False
        return False


class CompetitionSerializer(serializers.ModelSerializer):
    created_by = serializers.StringRelatedField(read_only=True)
    questions = CompetitionQuestionSerializer(many=True, read_only=True)
    questions_count = serializers.SerializerMethodField()
    participants_count = serializers.SerializerMethodField()
    is_registered = serializers.SerializerMethodField()
    start_date = serializers.DateTimeField(required=False, default=timezone.now)
    end_date = serializers.DateTimeField(required=False, allow_null=True)

    def validate(self, data):
        if not data.get('start_date'):
            data['start_date'] = timezone.now()
        if not data.get('end_date'):
            data['end_date'] = data['start_date'] + timedelta(days=7)
        return data

    class Meta:
        model = Competition
        fields = [
            'id', 'name', 'description', 'start_date', 'end_date',
            'created_by', 'is_active', 'questions', 'questions_count',
            'participants_count', 'is_registered', 'created_at'
        ]
        read_only_fields = [
            'id', 'created_by', 'questions', 'questions_count',
            'participants_count', 'is_registered', 'created_at'
        ]

    def get_questions_count(self, obj):
        return obj.questions.count()

    def get_participants_count(self, obj):
        return obj.registrations.count()

    def get_is_registered(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            return obj.registrations.filter(user=request.user).exists()
        return False


class ScoreSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    competition = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Score
        fields = ['id', 'user', 'competition', 'points', 'period', 'updated_at']
        read_only_fields = ['id', 'user', 'updated_at']


class LeaderboardEntrySerializer(serializers.Serializer):
    rank = serializers.IntegerField()
    user = serializers.CharField()
    username = serializers.CharField(required=False, default='')
    points = serializers.IntegerField()
    badge_count = serializers.IntegerField(default=0)
    institution = serializers.CharField(required=False, default='Mathematical Sciences')
    specialty = serializers.CharField(required=False, default='Pure & Applied Mathematics')
    proofs_count = serializers.IntegerField(required=False, default=0)