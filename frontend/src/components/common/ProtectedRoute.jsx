import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Guards protected feature routes, ensuring only authenticated users can access them.
 * Redirects unauthenticated visitors to /login with state.from preserved.
 */
export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '65vh',
          gap: '12px',
          color: 'var(--primary)',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '36px', animation: 'spin 1s linear infinite' }}>
          progress_activity
        </span>
        <span style={{ fontSize: '13px', color: 'var(--text-subtle)' }}>Verifying credentials...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

/**
 * Guards public auth-only routes (/login, /register).
 * If the user is already authenticated, redirects them straight into /feed.
 */
export function PublicOnlyRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (isAuthenticated) {
    return <Navigate to="/feed" replace />;
  }

  return children;
}

export default ProtectedRoute;
