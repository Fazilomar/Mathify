from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TutorProfileViewSet, ChatSessionViewSet, ChatAPIView

router = DefaultRouter()
router.register('tutors', TutorProfileViewSet, basename='tutor')
router.register('sessions', ChatSessionViewSet, basename='chat-session')

urlpatterns = [
    path('chat/', ChatAPIView.as_view(), name='ai-chat'),
    path('', include(router.urls)),
]