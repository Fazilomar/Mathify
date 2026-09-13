from rest_framework import serializers
from .models import Formula, Creation


def _safe_user_name(user, fallback='Scholar'):
    if not user:
        return fallback
    if hasattr(user, 'get_public_name'):
        return user.get_public_name()
    u = (getattr(user, 'username', '') or '').strip()
    if u and '@' not in u:
        return u
    email = getattr(user, 'email', '') or ''
    if email and '@' in email:
        return email.split('@')[0]
    return f"user_{getattr(user, 'id', 'anonymous')}"


class FormulaSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()
    created_by_id = serializers.PrimaryKeyRelatedField(
        queryset=__import__('accounts.models', fromlist=['CustomUser']).CustomUser.objects.all(),
        source='created_by',
        required=False
    )
    title = serializers.CharField(write_only=True, required=False)
    latex_code = serializers.CharField(write_only=True, required=False)
    latex = serializers.CharField(source='latex_expression', read_only=True)

    def get_created_by(self, obj):
        return _safe_user_name(obj.created_by)

    class Meta:
        model = Formula
        fields = [
            'id', 'name', 'title', 'latex_expression', 'latex_code', 'latex',
            'description', 'category', 'created_by', 'created_by_id', 'created_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at']
        extra_kwargs = {
            'name': {'required': False},
            'latex_expression': {'required': False},
        }

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        if 'title' in data and 'name' not in data:
            data['name'] = data['title']
        if 'latex_code' in data and 'latex_expression' not in data:
            data['latex_expression'] = data['latex_code']
        if 'latex' in data and 'latex_expression' not in data:
            data['latex_expression'] = data['latex']
        return super().to_internal_value(data)

    def validate(self, attrs):
        if 'title' in attrs and 'name' not in attrs:
            attrs['name'] = attrs.pop('title')
        elif 'title' in attrs:
            attrs.pop('title')

        if 'latex_code' in attrs and 'latex_expression' not in attrs:
            attrs['latex_expression'] = attrs.pop('latex_code')
        elif 'latex_code' in attrs:
            attrs.pop('latex_code')

        if not attrs.get('name'):
            raise serializers.ValidationError({'name': 'This field is required.'})
        if not attrs.get('latex_expression'):
            raise serializers.ValidationError({'latex_expression': 'This field is required.'})

        return attrs


class CreationSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    author_id = serializers.PrimaryKeyRelatedField(
        queryset=__import__('accounts.models', fromlist=['CustomUser']).CustomUser.objects.all(),
        source='author',
        required=False
    )
    formulas = FormulaSerializer(many=True, read_only=True)
    formula_ids = serializers.PrimaryKeyRelatedField(
        queryset=Formula.objects.all(), source='formulas',
        many=True, write_only=True, required=False
    )

    def get_author(self, obj):
        return _safe_user_name(obj.author)

    class Meta:
        model = Creation
        fields = [
            'id', 'title', 'author', 'author_id', 'content', 'latex_content',
            'formulas', 'formula_ids', 'visibility', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'author', 'created_at', 'updated_at']