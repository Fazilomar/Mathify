import React, { createContext, useContext, useState, useEffect } from 'react';
import { API } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('mx_user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    if (!API.getAccess()) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      let res = await API.get('/api/accounts/me/');
      if (!res.ok) {
        res = await API.get('/api/accounts/me/profile/');
      }
      if (res.ok) {
        const data = await res.json();
        const role = data.profile?.role || data.role || 'student';
        const formattedUser = {
          ...data,
          role,
          avatar: data.profile?.avatar || data.avatar || null,
          axiom_points: data.profile?.axiom_points ?? data.axiom_points ?? 0,
        };
        setUser(formattedUser);
        localStorage.setItem('mx_user', JSON.stringify(formattedUser));
        return formattedUser;
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
    return null;
  };

  useEffect(() => {
    fetchProfile();

    const handleUnauthorized = () => {
      setUser(null);
      API.clearTokens();
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = async (username, password) => {
    const res = await API.post('/api/auth/token/', { username, password });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || 'Invalid username or password');
    }

    const data = await res.json();
    API.setTokens(data.access, data.refresh);
    const profile = await fetchProfile();
    return profile;
  };

  const register = async (userData) => {
    const res = await API.post('/api/accounts/register/', userData);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = Object.entries(err)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`)
        .join(', ');
      throw new Error(msg || 'Registration failed');
    }

    // Auto login after registration
    return login(userData.username, userData.password);
  };

  const logout = () => {
    API.clearTokens();
    setUser(null);
  };

  const updateProfile = async (formData) => {
    const res = await API.patch('/api/accounts/me/profile/', formData);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update profile');
    }
    const updated = await res.json();
    setUser(updated);
    localStorage.setItem('mx_user', JSON.stringify(updated));
    return updated;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user && !!API.getAccess(),
        login,
        register,
        logout,
        fetchProfile,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
