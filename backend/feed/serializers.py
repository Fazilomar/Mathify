from rest_framework import serializers
from .models import Post, Like, Comment, Follow


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


class CommentSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ['id', 'user', 'content', 'parent', 'replies', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']

    def get_user(self, obj):
        return _safe_user_name(obj.user)

    def get_replies(self, obj):
        if obj.replies.exists():
            return CommentSerializer(obj.replies.all(), many=True).data
        return []


class PostSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    author_id = serializers.ReadOnlyField(source='author.id')
    author_username = serializers.SerializerMethodField()
    author_avatar = serializers.SerializerMethodField()
    likes_count = serializers.ReadOnlyField()
    comments_count = serializers.ReadOnlyField()
    is_liked = serializers.SerializerMethodField()

    def get_author(self, obj):
        return _safe_user_name(obj.author)

    def get_author_username(self, obj):
        return _safe_user_name(obj.author)

    MAX_CONTENT_LENGTH = 4000
    MAX_LATEX_LENGTH = 8000
    MAX_MEDIA_BYTES = 10 * 1024 * 1024
    IMAGE_TYPES = {
        'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp',
        'image/heic', 'image/heif', 'image/svg+xml', 'image/bmp', 'application/octet-stream',
    }
    IMAGE_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic', '.heif', '.svg', '.bmp')
    VIDEO_TYPES = {'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'}
    VIDEO_EXTENSIONS = ('.mp4', '.mov', '.webm', '.ogg', '.m4v')

    class Meta:
        model = Post
        fields = [
            'id', 'author', 'author_id', 'author_username', 'author_avatar',
            'content', 'latex_content', 'media',
            'post_type', 'likes_count', 'comments_count', 'is_liked',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'author', 'author_id', 'author_username', 'author_avatar', 'created_at', 'updated_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.media:
            try:
                request = self.context.get('request')
                if request:
                    data['media'] = request.build_absolute_uri(instance.media.url)
                else:
                    data['media'] = instance.media.url
            except Exception:
                pass
        return data

    def get_author_avatar(self, obj):
        try:
            if hasattr(obj.author, 'profile') and obj.author.profile.avatar:
                request = self.context.get('request')
                url = obj.author.profile.avatar.url
                if request:
                    return request.build_absolute_uri(url)
                return url
        except Exception:
            pass
        return None

    def get_is_liked(self, obj):
        if hasattr(obj, '_is_liked'):
            return bool(obj._is_liked)
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False

    def validate(self, attrs):
        instance = getattr(self, 'instance', None)
        post_type = attrs.get('post_type', getattr(instance, 'post_type', Post.TYPE_TEXT))
        content = attrs.get('content', getattr(instance, 'content', '')) or ''
        latex_content = attrs.get('latex_content', getattr(instance, 'latex_content', '')) or ''
        media = attrs.get('media', getattr(instance, 'media', None))

        content = content.strip()
        latex_content = latex_content.strip()

        if not content and not latex_content and not media:
            raise serializers.ValidationError('Post requires content, latex_content, or media.')

        if len(content) > self.MAX_CONTENT_LENGTH:
            raise serializers.ValidationError({'content': 'Content is too long.'})

        if len(latex_content) > self.MAX_LATEX_LENGTH:
            raise serializers.ValidationError({'latex_content': 'LaTeX content is too long.'})

        if post_type == Post.TYPE_FORMULA and not latex_content:
            raise serializers.ValidationError({'latex_content': 'Formula posts require LaTeX content.'})

        if media is not None:
            if media.size > self.MAX_MEDIA_BYTES:
                raise serializers.ValidationError({'media': 'Media file is too large (max 10MB).'})

            content_type = getattr(media, 'content_type', '').lower()
            media_name = getattr(media, 'name', '').lower()

            is_video = (
                content_type in self.VIDEO_TYPES or
                content_type.startswith('video/') or
                media_name.endswith(self.VIDEO_EXTENSIONS)
            )

            is_image = (
                content_type in self.IMAGE_TYPES or
                content_type.startswith('image/') or
                media_name.endswith(self.IMAGE_EXTENSIONS)
            )

            if is_video:
                attrs['post_type'] = Post.TYPE_VIDEO
            elif is_image:
                attrs['post_type'] = Post.TYPE_IMAGE
            else:
                attrs['post_type'] = Post.TYPE_IMAGE

        return attrs


class LikeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Like
        fields = ['id', 'post', 'created_at']
        read_only_fields = ['id', 'created_at']


class FollowSerializer(serializers.ModelSerializer):
    follower = serializers.StringRelatedField(read_only=True)
    following = serializers.StringRelatedField(read_only=True)
    following_user_id = serializers.ReadOnlyField(source='following.id')
    following_id = serializers.PrimaryKeyRelatedField(
        source='following', queryset=__import__('accounts.models', fromlist=['CustomUser']).CustomUser.objects.all(),
        write_only=True,
    )

    class Meta:
        model = Follow
        fields = ['id', 'follower', 'following', 'following_id', 'following_user_id', 'created_at']
        read_only_fields = ['id', 'follower', 'following', 'following_user_id', 'created_at']