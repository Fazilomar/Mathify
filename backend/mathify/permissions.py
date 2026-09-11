from rest_framework import permissions


class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Object-level permission to allow read-only access for safe methods (GET, HEAD, OPTIONS),
    and strictly restrict write/edit/delete mutations to the owner of the object.

    Dynamically inspects standard owner attributes on the model instance:
    'author', 'created_by', 'uploaded_by', 'user', 'sender', or 'follower'.
    """

    OWNER_FIELDS = ('author', 'created_by', 'uploaded_by', 'user', 'sender', 'follower')

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True

        user = request.user
        if not user or not user.is_authenticated:
            return False

        for attr in self.OWNER_FIELDS:
            if hasattr(obj, attr):
                owner = getattr(obj, attr)
               
                if hasattr(owner, 'id'):
                    return owner.id == user.id
                return owner == user

        return False


class IsHostOrReadOnly(permissions.BasePermission):
    """
    Allows read-only access for safe methods (GET, HEAD, OPTIONS) to all users.
    Write methods (POST to create competitions) are strictly restricted to
    users with the 'host' role (lecturers/organizers) or staff/admin.
    """
    message = "Only hosts and lecturers are authorized to create and organize competitions."

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_staff or request.user.is_superuser:
            return True
        prof = getattr(request.user, 'profile', None)
        return prof is not None and getattr(prof, 'role', None) == 'host'

