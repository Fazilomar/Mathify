from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.db.models import Q, Exists, OuterRef, Value, BooleanField
from mathify.permissions import IsOwnerOrReadOnly

from .models import Post, Like, Comment, Follow
from .serializers import PostSerializer, LikeSerializer, CommentSerializer, FollowSerializer


class IsAuthorOrReadOnly(IsOwnerOrReadOnly):
    """
    Object-level permission to only allow authors of a post to edit or delete it.
    """
    pass


class PostViewSet(viewsets.ModelViewSet):
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly]
    throttle_scope = 'feed_post'

    def get_queryset(self):
        user = self.request.user
        qs = Post.objects.select_related('author__profile')

        if user.is_authenticated:
            is_liked_sub = Exists(Like.objects.filter(post=OuterRef('pk'), user=user))
            qs = qs.annotate(_is_liked=is_liked_sub)
        else:
            qs = qs.annotate(_is_liked=Value(False, output_field=BooleanField()))

        author = self.request.query_params.get('author')
        if author:
            qs = qs.filter(author_id=author)

        post_type = self.request.query_params.get('post_type')
        if post_type:
            qs = qs.filter(post_type=post_type)

        query = self.request.query_params.get('q')
        if query:
            qs = qs.filter(Q(content__icontains=query) | Q(latex_content__icontains=query))

        # /api/feed/posts/?feed=following  → posts by users a person follows.
        if self.request.query_params.get('feed') == 'following' and user.is_authenticated:
            followed_ids = user.following.values_list('following_id', flat=True)
            return qs.filter(author_id__in=followed_ids)

        return qs

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def like(self, request, pk=None):
        post = self.get_object()
        like, created = Like.objects.get_or_create(user=request.user, post=post)
        if not created:
            like.delete()
            return Response({'liked': False})
        return Response({'liked': True}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get', 'post'], permission_classes=[permissions.IsAuthenticatedOrReadOnly])
    def comments(self, request, pk=None):
        post = self.get_object()
        if request.method == 'GET':
            qs = post.comments.filter(parent__isnull=True).select_related('user__profile')
            return Response(CommentSerializer(qs, many=True, context={'request': request}).data)
        serializer = CommentSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user, post=post)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class FollowViewSet(viewsets.ModelViewSet):
    serializer_class = FollowSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]

    def get_queryset(self):
        qs = Follow.objects.all()
        follower = self.request.query_params.get('follower')
        following = self.request.query_params.get('following')

        if follower:
            qs = qs.filter(follower_id=follower)
        if following:
            qs = qs.filter(following_id=following)

        if not follower and not following:
            qs = qs.filter(follower=self.request.user)

        return qs

    def perform_create(self, serializer):
        serializer.save(follower=self.request.user)

    def perform_destroy(self, instance):
        if instance.follower != self.request.user:
            raise PermissionDenied("You can only unfollow your own follow relationships.")
        instance.delete()

    @action(detail=False, methods=['get'])
    def friends(self, request):
        user = request.user
        # Mutual follows: current user follows them, and they follow current user back
        following_ids = Follow.objects.filter(follower=user).values_list('following_id', flat=True)
        mutual_follows = Follow.objects.filter(
            follower_id__in=following_ids,
            following=user
        ).select_related('follower__profile__department')
        
        # Serialize the matching users
        from accounts.serializers import UserSerializer
        users = [f.follower for f in mutual_follows]
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)