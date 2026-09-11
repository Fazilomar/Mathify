from rest_framework import serializers
from .models import Formula, Creation


class FormulaSerializer(serializers.ModelSerializer):
    created_by = serializers.StringRelatedField(read_only=True)
    created_by_id = serializers.PrimaryKeyRelatedField(
        queryset=__import__('accounts.models', fromlist=['CustomUser']).CustomUser.objects.all(),
        source='created_by',
        required=False
    )
    title = serializers.CharField(write_only=True, required=False)
    latex_code = serializers.CharField(write_only=True, required=False)
    latex = serializers.CharField(source='latex_expression', read_only=True)

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
    author = serializers.StringRelatedField(read_only=True)
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

    class Meta:
        model = Creation
        fields = [
            'id', 'title', 'author', 'author_id', 'content', 'latex_content',
            'formulas', 'formula_ids', 'visibility', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'author', 'created_at', 'updated_at']