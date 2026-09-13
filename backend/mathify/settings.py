import os
from pathlib import Path
from datetime import timedelta
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent
IS_VERCEL = 'VERCEL' in os.environ or config('VERCEL', default=False, cast=bool)

SECRET_KEY = config('SECRET_KEY', default='django-insecure-change-me-in-production')

DEBUG = config('DEBUG', default=True, cast=bool)

ALLOWED_HOSTS = [h.strip() for h in config('ALLOWED_HOSTS', default='*').split(',') if h.strip()]
if 'testserver' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append('testserver')


INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',

    # local
    'accounts',
    'feed',
    'social',
    'library',
    'studio',
    'rankings',
    'ai_tutor',
    'notifications',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'mathify.urls'

FRONTEND_DIST = BASE_DIR.parent / 'frontend' / 'dist'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [FRONTEND_DIST] if FRONTEND_DIST.exists() else [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'mathify.wsgi.application'

DATABASE_URL = config('DATABASE_URL', default=None)
USE_POSTGRES = config('USE_POSTGRES', default=bool(DATABASE_URL), cast=bool)

if DATABASE_URL:
    try:
        import dj_database_url
        DATABASES = {
            'default': dj_database_url.parse(
                DATABASE_URL,
                conn_max_age=config('DB_CONN_MAX_AGE', default=(0 if IS_VERCEL else 600), cast=int),
                ssl_require=config('DB_SSL_REQUIRE', default=True, cast=bool)
            )
        }
    except Exception as e:
        print(f"[Warning] Failed to parse DATABASE_URL ({e}), falling back to SQLite.")
        sqlite_file = config('SQLITE_DB_NAME', default='db.sqlite3')
        sqlite_path = Path('/tmp') / sqlite_file if IS_VERCEL else BASE_DIR / sqlite_file
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': sqlite_path,
            }
        }
else:
    if IS_VERCEL:
        print("[CRITICAL PRODUCTION WARNING] Running on Vercel without DATABASE_URL! Ephemeral SQLite in /tmp will cause user session disconnects across serverless lambda containers. Please supply your Supabase DATABASE_URL in Vercel Environment Variables.")
    sqlite_file = config('SQLITE_DB_NAME', default='db.sqlite3')
    sqlite_path = Path('/tmp') / sqlite_file if IS_VERCEL else BASE_DIR / sqlite_file
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': sqlite_path,
        }
    }

REDIS_URL = config('REDIS_URL', default=None)
if REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': REDIS_URL,
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'mathify-locmem-cache',
        }
    }

AUTH_USER_MODEL = 'accounts.CustomUser'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

AUTHENTICATION_BACKENDS = [
    'accounts.backends.EmailOrUsernameModelBackend',
    'django.contrib.auth.backends.ModelBackend',
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [
    d for d in [BASE_DIR / 'static', FRONTEND_DIST / 'assets'] if d.exists()
]

MEDIA_URL = '/media/'
MEDIA_ROOT = (Path('/tmp') / 'media') if IS_VERCEL else (BASE_DIR / 'media')

# Request body and upload sizes (prevent 400 RequestDataTooBig on valid images/attachments)
DATA_UPLOAD_MAX_MEMORY_SIZE = config('DATA_UPLOAD_MAX_MEMORY_SIZE', default=10 * 1024 * 1024, cast=int)  # 10 MB
FILE_UPLOAD_MAX_MEMORY_SIZE = config('FILE_UPLOAD_MAX_MEMORY_SIZE', default=10 * 1024 * 1024, cast=int)  # 10 MB

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Django REST Framework & Throttling
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': config('REST_PAGE_SIZE', default=20, cast=int),
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.ScopedRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': config('THROTTLE_ANON_RATE', default='200/day'),
        'user': config('THROTTLE_USER_RATE', default='2000/day'),
        'auth': config('THROTTLE_AUTH_RATE', default='15/minute'),
        'password_reset': config('THROTTLE_PW_RESET_RATE', default='5/hour'),
        'ai_tutor': config('THROTTLE_AI_TUTOR_RATE', default='30/minute'),
        'feed_post': config('THROTTLE_FEED_RATE', default='25/minute'),
        'score_award': config('THROTTLE_SCORE_RATE', default='15/hour'),
        'competition_answer': config('THROTTLE_COMPETITION_ANSWER_RATE', default='30/minute'),
    }
}

# JWT
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=config('JWT_ACCESS_DAYS', default=1, cast=int)),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=config('JWT_REFRESH_DAYS', default=30, cast=int)),
    'ROTATE_REFRESH_TOKENS': True,
}

# CORS 
CORS_ALLOW_ALL_ORIGINS = config('CORS_ALLOW_ALL_ORIGINS', default=DEBUG, cast=bool)
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in config('CORS_ALLOWED_ORIGINS', default='http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000').split(',') if origin.strip()]
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://.*\.vercel\.app$",
]

# Email & SMTP Configuration
EMAIL_BACKEND = config('EMAIL_BACKEND', default='django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = config('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
EMAIL_USE_SSL = config('EMAIL_USE_SSL', default=False, cast=bool)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='noreply@mathify.local')

# AI Tutor (Gemini API)
GEMINI_API_KEY = config('GEMINI_API_KEY', default='').strip()
GEMINI_DEFAULT_MODEL = config('GEMINI_DEFAULT_MODEL', default='gemini-2.5-flash').strip()
AI_TIMEOUT_SECONDS = config('AI_TIMEOUT_SECONDS', default=20, cast=int)

