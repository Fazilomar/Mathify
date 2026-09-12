from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('social', '0003_callsignal'),
    ]

    operations = [
        migrations.AddField(
            model_name='call',
            name='title',
            field=models.CharField(blank=True, default='Seminar Call', max_length=200),
        ),
        migrations.AddField(
            model_name='call',
            name='meeting_code',
            field=models.CharField(blank=True, max_length=50, null=True, unique=True),
        ),
        migrations.AddField(
            model_name='call',
            name='scheduled_for',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='call',
            name='description',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='call',
            name='is_instant',
            field=models.BooleanField(default=True),
        ),
    ]
