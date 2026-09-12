from django.db import migrations

def seed_departments(apps, schema_editor):
    Department = apps.get_model('accounts', 'Department')
    depts = [
        {"name": "Mathematics", "code": "MATH", "description": "Department of Mathematical Sciences"},
        {"name": "Computer Science", "code": "CS", "description": "Department of Computer Science & Engineering"},
        {"name": "Physics", "code": "PHYS", "description": "Department of Physics"},
        {"name": "Statistics", "code": "STAT", "description": "Department of Statistics & Actuarial Science"},
        {"name": "Applied Mathematics", "code": "AMATH", "description": "Department of Applied Mathematics"},
    ]
    for d in depts:
        Department.objects.get_or_create(code=d["code"], defaults={"name": d["name"], "description": d["description"]})

def reverse_seed(apps, schema_editor):
    Department = apps.get_model('accounts', 'Department')
    Department.objects.filter(code__in=["MATH", "CS", "PHYS", "STAT", "AMATH"]).delete()

class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_departments, reverse_seed),
    ]
