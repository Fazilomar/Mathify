"""
WSGI config for mathify project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.0/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mathify.settings')

application = get_wsgi_application()
app = application

# Safely run migrations on deployment startup if enabled (defaults to true)
if os.environ.get('AUTO_MIGRATE', 'true').lower() in ('1', 'true', 'yes'):
    try:
        from django.core.management import call_command
        call_command('migrate', interactive=False)
    except Exception as e:
        print(f"[Auto-Migrate] Migration notice: {e}")

