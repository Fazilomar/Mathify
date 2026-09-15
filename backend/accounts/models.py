from django.contrib.auth.models import AbstractUser
from django.db import models


class Department(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.code} — {self.name}"

    class Meta:
        ordering = ['name']


class CustomUser(AbstractUser):
    email = models.EmailField(unique=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def get_public_name(self):
        """Returns a safe display name that never reveals the user's private email address."""
        u = (self.username or '').strip()
        if u and '@' not in u:
            return u
        if self.email and '@' in self.email:
            return self.email.split('@')[0]
        return f"user_{self.pk or 'anonymous'}"

    def __str__(self):
        return self.get_public_name()


class Profile(models.Model):
    ROLE_STUDENT = 'student'
    ROLE_HOST = 'host'
    ROLE_CHOICES = [
        (ROLE_STUDENT, 'Student / Participant'),
        (ROLE_HOST, 'Host / Lecturer / Organizer'),
    ]

    YEAR_CHOICES = [
        (1, 'Year 1'), (2, 'Year 2'), (3, 'Year 3'),
        (4, 'Year 4'), (5, 'Postgraduate'),
    ]

    user = models.OneToOneField(
        CustomUser, on_delete=models.CASCADE, related_name='profile'
    )
    role = models.CharField(
        max_length=20, choices=ROLE_CHOICES, default=ROLE_STUDENT,
        help_text="Role: student (participant) or host (lecturer/organizer)"
    )
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    bio = models.TextField(max_length=500, blank=True)
    department = models.ForeignKey(
        Department, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='students'
    )
    year_of_study = models.PositiveSmallIntegerField(
        choices=YEAR_CHOICES, null=True, blank=True
    )
    institution = models.CharField(
        max_length=200, blank=True, default='',
        help_text="University, School, or Organization (e.g. MIT, Math Club)"
    )
    designation = models.CharField(
        max_length=100, blank=True, default='',
        help_text="e.g. Lecturer, Competition Organizer, Seminar Host, Club President"
    )
    axiom_points = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profile({self.user.email} - {self.role})"