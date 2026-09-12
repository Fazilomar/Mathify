from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_profile_role'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='institution',
            field=models.CharField(
                blank=True, default='',
                help_text='University, School, or Organization (e.g. MIT, Math Club)',
                max_length=200
            ),
        ),
        migrations.AddField(
            model_name='profile',
            name='designation',
            field=models.CharField(
                blank=True, default='',
                help_text='e.g. Lecturer, Competition Organizer, Seminar Host, Club President',
                max_length=100
            ),
        ),
    ]
