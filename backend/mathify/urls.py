"""
URL configuration for mathify project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.views.generic import TemplateView
from accounts.views import MeView


urlpatterns = [
    path('admin/', admin.site.urls),

    # JWT auth
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair_alias'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh_alias'),
    path('api/auth/me/', MeView.as_view(), name='auth_me_direct'),

    # apps
    path('api/accounts/', include('accounts.urls')),
    path('api/feed/', include('feed.urls')),
    path('api/social/', include('social.urls')),
    path('api/library/', include('library.urls')),
    path('api/studio/', include('studio.urls')),
    path('api/rankings/', include('rankings.urls')),
    path('api/ai-tutor/', include('ai_tutor.urls')),
    path('api/', include('notifications.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT) + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

from django.views.static import serve

# Route Vite compiled assets and static files from frontend/dist
urlpatterns += [
    re_path(r'^assets/(?P<path>.*)$', serve, {'document_root': settings.FRONTEND_DIST / 'assets'}),
    re_path(r'^(?P<path>[^/]+\.(?:svg|png|ico|json|webmanifest))$', serve, {'document_root': settings.FRONTEND_DIST}),
    re_path(r'^(?!api/|admin/|media/|static/|assets/).*$', TemplateView.as_view(template_name='index.html'), name='spa_catchall'),
]

