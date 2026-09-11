import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { fetchProfile } = useAuth();
  const [statusMessage, setStatusMessage] = useState('Verifying credentials...');

  useEffect(() => {
    let isMounted = true;

    const processOAuth = async () => {
      const params = new URLSearchParams(location.search);
      const access = params.get('access');
      const refresh = params.get('refresh');
      const error = params.get('error');

      if (error) {
        navigate(`/login?error=${encodeURIComponent(error)}`, { replace: true });
        return;
      }

      if (!access || !refresh) {
        navigate('/login?error=' + encodeURIComponent('Authentication response was missing security tokens.'), { replace: true });
        return;
      }

      try {
        if (isMounted) setStatusMessage('Authorizing session...');
        API.setTokens(access, refresh);

        if (isMounted) setStatusMessage('Loading profile...');
        const user = await fetchProfile();

        if (user) {
          navigate('/feed', { replace: true });
        } else {
          // Tokens were set, proceed to feed even if profile took longer
          navigate('/feed', { replace: true });
        }
      } catch (err) {
        console.error('OAuth token processing failed:', err);
        navigate(`/login?error=${encodeURIComponent('Failed to initialize session: ' + err.message)}`, { replace: true });
      }
    };

    processOAuth();

    return () => {
      isMounted = false;
    };
  }, [location.search, navigate, fetchProfile]);

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 120px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        textAlign: 'center',
      }}
    >
      <div
        className="card"
        style={{
          padding: '40px 48px',
          maxWidth: '400px',
          backgroundColor: '#18181D',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '18px',
        }}
      >
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            border: '3px solid rgba(229, 169, 60, 0.2)',
            borderTopColor: 'var(--primary)',
            animation: 'spin 0.9s linear infinite',
          }}
        />
        <style>
          {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
        </style>
        <h2 className="font-display" style={{ fontSize: '20px', margin: 0, color: 'var(--text)' }}>
          Authenticating
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
          {statusMessage}
        </p>
      </div>
    </div>
  );
}

export default OAuthCallbackPage;
