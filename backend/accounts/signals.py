from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from .models import Profile

User = get_user_model()


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        try:
            Profile.objects.get_or_create(user=instance)
        except Exception:
            # If the database table is missing the role column (e.g. unapplied migration),
            # auto-patch the schema in place so user signup/OAuth never fails
            from django.db import connection
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
                        "ALTER TABLE accounts_profile ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'student';"
                    )
                Profile.objects.get_or_create(user=instance)
            except Exception as e:
                print(f"[Accounts Signal] Profile creation notice: {e}")
