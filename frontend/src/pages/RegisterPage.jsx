import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../api/client';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const frontendOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const googleOAuthUrl = `${API_BASE}/api/accounts/oauth/google/login/?frontend_redirect=${encodeURIComponent(frontendOrigin)}`;
  const microsoftOAuthUrl = `${API_BASE}/api/accounts/oauth/microsoft/login/?frontend_redirect=${encodeURIComponent(frontendOrigin)}`;

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('student');
  const [department, setDepartment] = useState('Mathematics');
  const [yearOfStudy, setYearOfStudy] = useState('1');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await register({
        username: username.trim(),
        email: email.trim(),
        password,
        password2: confirmPassword,
        role,
        department,
        year_of_study: parseInt(yearOfStudy, 10),
      });
      navigate('/feed', { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 120px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '36px',
          backgroundColor: '#18181D',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(229, 169, 60, 0.08)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1
            className="font-display"
            style={{
              fontSize: '28px',
              color: 'var(--text)',
              marginBottom: '6px',
            }}
          >
            Join Mathify
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Create your academic profile to publish proofs and collaborate.
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#FCA5A5',
              fontSize: '13px',
              marginBottom: '20px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Academic Role Selection */}
          <div>
            <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
              Academic Role
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div
                onClick={() => setRole('student')}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: role === 'student' ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                  backgroundColor: role === 'student' ? 'rgba(229, 169, 60, 0.08)' : 'var(--surface-input)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: role === 'student' ? 'var(--primary)' : 'var(--text)' }}>
                    Participant / Student
                  </span>
                  {role === 'student' && (
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--primary)' }}>
                      check_circle
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-subtle)', lineHeight: 1.3 }}>
                  Compete in sprints, solve questions, and earn Axiom Points.
                </p>
              </div>

              <div
                onClick={() => setRole('host')}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: role === 'host' ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                  backgroundColor: role === 'host' ? 'rgba(229, 169, 60, 0.08)' : 'var(--surface-input)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: role === 'host' ? 'var(--primary)' : 'var(--text)' }}>
                    Host / Lecturer
                  </span>
                  {role === 'host' && (
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--primary)' }}>
                      check_circle
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-subtle)', lineHeight: 1.3 }}>
                  Organize competitions, author challenge problems, and host sprints.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Username
            </label>
            <input
              type="text"
              className="glass-input"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. euler_31"
            />
          </div>

          <div>
            <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Academic Email
            </label>
            <input
              type="email"
              className="glass-input"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. student@university.edu"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Department
              </label>
              <select
                className="glass-input"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                style={{ cursor: 'pointer' }}
              >
                <option value="Mathematics" style={{ background: '#030712' }}>Mathematics</option>
                <option value="Physics" style={{ background: '#030712' }}>Physics</option>
                <option value="Computer Science" style={{ background: '#030712' }}>Computer Science</option>
                <option value="Engineering" style={{ background: '#030712' }}>Engineering</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Year
              </label>
              <select
                className="glass-input"
                value={yearOfStudy}
                onChange={(e) => setYearOfStudy(e.target.value)}
                style={{ cursor: 'pointer' }}
              >
                <option value="1" style={{ background: '#030712' }}>Year 1</option>
                <option value="2" style={{ background: '#030712' }}>Year 2</option>
                <option value="3" style={{ background: '#030712' }}>Year 3</option>
                <option value="4" style={{ background: '#030712' }}>Year 4 / Postgrad</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Password
              </label>
              <input
                type="password"
                className="glass-input"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div>
              <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Confirm Password
              </label>
              <input
                type="password"
                className="glass-input"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', padding: '12px', marginTop: '10px', fontSize: '15px' }}
          >
            {loading ? 'Registering...' : 'Create Account'}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', gap: '12px' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
          <span style={{ fontSize: '11.5px', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>or register with</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
        </div>

        {/* OAuth Social Logins */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <a
            href={googleOAuthUrl}
            className="btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '10px 14px',
              fontSize: '13.5px',
              fontWeight: 500,
              backgroundColor: '#141418',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              textDecoration: 'none',
              borderRadius: '8px',
              transition: 'border-color 0.15s ease',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Continue with Google</span>
          </a>

          <a
            href={microsoftOAuthUrl}
            className="btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '10px 14px',
              fontSize: '13.5px',
              fontWeight: 500,
              backgroundColor: '#141418',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              textDecoration: 'none',
              borderRadius: '8px',
              transition: 'border-color 0.15s ease',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 23 23">
              <path fill="#f35325" d="M1 1h10v10H1z" />
              <path fill="#81bc06" d="M12 1h10v10H12z" />
              <path fill="#05a6f0" d="M1 12h10v10H1z" />
              <path fill="#ffba08" d="M12 12h10v10H12z" />
            </svg>
            <span>Continue with Microsoft</span>
          </a>
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
