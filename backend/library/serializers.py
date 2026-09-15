from rest_framework import serializers
from .models import Category, Tag, Resource, Bookmark
from mathify.media_fields import HybridFileField


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description', 'parent']


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'name', 'slug']


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


class ResourceSerializer(serializers.ModelSerializer):
    uploaded_by = serializers.SerializerMethodField()
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), source='category',
        write_only=True, required=False, allow_null=True
    )

    def get_uploaded_by(self, obj):
        return _safe_user_name(obj.uploaded_by)
    level_display = serializers.CharField(source='get_level_display', read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    bookmark_count = serializers.ReadOnlyField()
    is_bookmarked = serializers.SerializerMethodField()
    file = HybridFileField(required=False, allow_null=True, max_upload_size_mb=50)
    MAX_FILE_BYTES = 50 * 1024 * 1024

    class Meta:
        model = Resource
        fields = [
            'id', 'title', 'description', 'resource_type', 'level', 'level_display',
            'file', 'file_size_bytes', 'url',
            'category', 'category_id', 'tags', 'uploaded_by',
            'bookmark_count', 'is_bookmarked', 'created_at',
        ]
        read_only_fields = ['id', 'uploaded_by', 'created_at', 'level_display', 'file_size_bytes']

    def get_is_bookmarked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.bookmarks.filter(user=request.user).exists()
        return False

    def validate_file(self, value):
        if value and value.size > self.MAX_FILE_BYTES:
            raise serializers.ValidationError('Files must be 50 MB or smaller.')
        return value


class BookmarkSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bookmark
        fields = ['id', 'resource', 'created_at']
        read_only_fields = ['id', 'created_at']