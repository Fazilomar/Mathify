from rest_framework import serializers
from .models import Notification


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


class NotificationSerializer(serializers.ModelSerializer):
    actor = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            'id', 'actor', 'verb', 'target_type', 'target_id',
            'data', 'is_read', 'created_at',
        ]
        read_only_fields = ['id', 'actor', 'created_at']

    def get_actor(self, obj):
        return _safe_user_name(obj.actor)
