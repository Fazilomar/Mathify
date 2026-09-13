from rest_framework import serializers
from .models import Group, GroupMembership, GroupJoinRequest, Message, Call


def _safe_user_name(user, fallback='Scholar'):
    if not user:
        return fallback
    if hasattr(user, 'get_public_name'):
        return user.get_public_name()
    u = (getattr(user, 'username', '') or '').strip()
    if u and '@' not in u:
        return u
    email = getattr(user, 'email', '') or ''
    if email and '@' in email:
        return email.split('@')[0]
    return f"user_{getattr(user, 'id', 'anonymous')}"


class GroupMembershipSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    user_id = serializers.ReadOnlyField(source='user.id')
    avatar = serializers.SerializerMethodField()
    username = serializers.SerializerMethodField()

    class Meta:
        model = GroupMembership
        fields = ['id', 'user', 'user_id', 'username', 'avatar', 'role', 'joined_at']

    def get_user(self, obj):
        return _safe_user_name(obj.user)

    def get_username(self, obj):
        return _safe_user_name(obj.user)

    def get_avatar(self, obj):
        try:
            return obj.user.profile.avatar.url if obj.user.profile.avatar else None
        except Exception:
            return None


class GroupJoinRequestSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    username = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = GroupJoinRequest
        fields = ['id', 'user', 'username', 'avatar', 'group', 'status', 'created_at', 'updated_at']
        read_only_fields = fields

    def get_user(self, obj):
        return _safe_user_name(obj.user)

    def get_username(self, obj):
        return _safe_user_name(obj.user)

    def get_avatar(self, obj):
        try:
            return obj.user.profile.avatar.url if obj.user.profile.avatar else None
        except Exception:
            return None


class GroupSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()
    is_member = serializers.SerializerMethodField()
    active_meeting = serializers.SerializerMethodField()
    request_status = serializers.SerializerMethodField()
    created_by_id = serializers.ReadOnlyField(source='created_by.id')

    class Meta:
        model = Group
        fields = [
            'id', 'name', 'description', 'group_type', 'avatar',
            'created_by', 'created_by_id', 'is_private', 'member_count', 'is_member', 'request_status', 'active_meeting', 'created_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at']

    def get_created_by(self, obj):
        return _safe_user_name(obj.created_by, fallback='Scholar')

    def get_member_count(self, obj):
        return obj.memberships.count()

    def get_is_member(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            return obj.memberships.filter(user=request.user).exists()
        return False

    def get_request_status(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        join_request = obj.join_requests.filter(user=request.user).first()
        return join_request.status if join_request else None

    def get_active_meeting(self, obj):
        active = obj.calls.filter(status=Call.STATUS_ACTIVE).order_by('-started_at').first()
        if active:
            return {
                'id': active.id,
                'meeting_code': active.meeting_code,
                'title': active.title,
                'initiator': _safe_user_name(active.initiator),
                'participants_count': active.participants.count(),
                'started_at': active.started_at,
            }
        return None


class MessageSerializer(serializers.ModelSerializer):
    sender = serializers.SerializerMethodField()
    sender_id = serializers.ReadOnlyField(source='sender.id')
    sender_avatar = serializers.SerializerMethodField()

    MAX_MEDIA_BYTES = 50 * 1024 * 1024

    def get_sender(self, obj):
        return _safe_user_name(obj.sender)

    def get_sender_avatar(self, obj):
        try:
            return obj.sender.profile.avatar.url if obj.sender.profile.avatar else None
        except Exception:
            return None

    def validate_media(self, value):
        if value and value.size > self.MAX_MEDIA_BYTES:
            raise serializers.ValidationError('Attachments must be 50 MB or smaller.')
        return value

    class Meta:
        model = Message
        fields = ['id', 'sender', 'sender_id', 'sender_avatar', 'group', 'recipient', 'content', 'media', 'is_read', 'created_at']
        read_only_fields = ['id', 'sender', 'created_at']


class CallSerializer(serializers.ModelSerializer):
    initiator = serializers.SerializerMethodField()
    initiator_username = serializers.SerializerMethodField()
    group_name = serializers.CharField(source='group.name', read_only=True)
    participants = serializers.SlugRelatedField(many=True, read_only=True, slug_field='username')
    participants_count = serializers.SerializerMethodField()

    def get_initiator(self, obj):
        return _safe_user_name(obj.initiator)

    def get_initiator_username(self, obj):
        return _safe_user_name(obj.initiator)

    class Meta:
        model = Call
        fields = [
            'id', 'initiator', 'initiator_username', 'group', 'group_name', 'title',
            'meeting_code', 'scheduled_for', 'description', 'is_instant', 'status',
            'participants', 'participants_count', 'started_at', 'ended_at', 'created_at'
        ]
        read_only_fields = ['id', 'initiator', 'meeting_code', 'created_at']

    def get_participants_count(self, obj):
        return obj.participants.count()