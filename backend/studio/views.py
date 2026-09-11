from rest_framework import viewsets, permissions
from mathify.permissions import IsOwnerOrReadOnly
from .models import Formula, Creation
from .serializers import FormulaSerializer, CreationSerializer


class FormulaViewSet(viewsets.ModelViewSet):
    serializer_class = FormulaSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_queryset(self):
        return Formula.objects.select_related('created_by')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


from django.db.models import Q

class CreationViewSet(viewsets.ModelViewSet):
    serializer_class = CreationSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated:
            qs = Creation.objects.filter(
                Q(author=user) | Q(visibility=Creation.VISIBILITY_PUBLIC)
            ).select_related('author').prefetch_related('formulas')
        else:
            qs = Creation.objects.filter(
                visibility=Creation.VISIBILITY_PUBLIC
            ).select_related('author').prefetch_related('formulas')

        query = self.request.query_params.get('q')
        if query:
            qs = qs.filter(Q(title__icontains=query) | Q(content__icontains=query))
        return qs

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def perform_update(self, serializer):
        serializer.save()