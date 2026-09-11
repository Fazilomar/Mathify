import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API } from '../../api/client';

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [notificationsList, setNotificationsList] = useState([]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchNotifications = async () => {
      try {
        const res = await API.get('/api/notifications/?unread=true');
        if (res.ok) {
          const data = await res.json();
          const items = data.results || (Array.isArray(data) ? data : []);
          setUnreadCount(data.count ?? items.length);
          if (items.length > 0) {
            setNotificationsList(items);
          }
        }
      } catch {
        // quiet fail
      }
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 4000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  useEffect(() => {
    setShowProfileMenu(false);
    setShowNotifMenu(false);
  }, [location.pathname]);

  const handleToggleNotifications = async () => {
    const nextState = !showNotifMenu;
    setShowNotifMenu(nextState);
    setShowProfileMenu(false);
    if (nextState) {
      try {
        const res = await API.get('/api/notifications/');
        if (res.ok) {
          const data = await res.json();
          const items = data.results || (Array.isArray(data) ? data : []);
          setNotificationsList(items);
        }
      } catch {}
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await API.post('/api/notifications/read-all/', {});
      setUnreadCount(0);
      setNotificationsList((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {}
  };

  const navLinks = [
    { label: 'Feed', path: '/feed' },
    { label: 'Competitions', path: '/competitions' },
    { label: 'Leaderboard', path: '/leaderboard' },
    { label: 'Proof Studio', path: '/studio' },
    { label: 'AI Tutor', path: '/tutor' },
    { label: 'Library', path: '/library' },
    { label: 'Groups', path: '/groups' },
  ];

  return (
    <header
      className="academic-nav"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 'var(--nav-height)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
      }}
    >
      {/* Brand Logo */}
      <Link
        to={isAuthenticated ? '/feed' : '/'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '9px',
          textDecoration: 'none',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            backgroundColor: 'var(--primary-subtle)',
            border: '1px solid var(--primary-border)',
            color: 'var(--primary)',
            fontSize: '15px',
            fontWeight: 700,
            fontFamily: 'serif',
          }}
        >
          &forall;
        </span>
        <span
          className="font-display"
          style={{
            fontSize: '19px',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
          }}
        >
          Mathify
        </span>
      </Link>

      {/* Desktop Navigation Links */}
      <nav className="desktop-nav">
        {navLinks.map((item) => {
          const isActive =
            location.pathname === item.path ||
            ((item.path === '/studio' || item.path === '/proofs') &&
              (location.pathname === '/studio' || location.pathname === '/proofs'));
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                fontSize: '13.5px',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                padding: '6px 12px',
                borderRadius: '7px',
                backgroundColor: isActive ? 'var(--primary-subtle)' : 'transparent',
                transition: 'all 0.15s ease',
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Right Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {isAuthenticated ? (
          <>
            {/* Notification Bell */}
            <div style={{ position: 'relative' }}>
              <button
                className="btn-icon"
                title="Notifications"
                onClick={handleToggleNotifications}
                style={{
                  position: 'relative',
                  backgroundColor: unreadCount > 0 ? 'rgba(229, 169, 60, 0.12)' : 'transparent',
                  border: unreadCount > 0 ? '1px solid var(--primary-border)' : '1px solid transparent',
                  boxShadow: unreadCount > 0 ? '0 0 12px rgba(229, 169, 60, 0.25)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: unreadCount > 0 ? 'var(--primary)' : 'var(--text)' }}>
                  notifications
                </span>
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '5px',
                      right: '5px',
                      minWidth: '14px',
                      height: '14px',
                      padding: '0 3px',
                      borderRadius: '999px',
                      backgroundColor: 'var(--primary)',
                      color: '#121215',
                      fontSize: '9px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {showNotifMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: '320px',
                    backgroundColor: '#16161B',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '12px',
                    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
                    zIndex: 200,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingBottom: '8px',
                      borderBottom: '1px solid var(--border)',
                      marginBottom: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                        Live Alerts
                      </span>
                      {unreadCount > 0 && (
                        <span className="badge-academic" style={{ fontSize: '10px', padding: '1px 6px' }}>
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          fontSize: '11px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          padding: 0,
                        }}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {notificationsList.length === 0 ? (
                      <div style={{ padding: '18px 0', textAlign: 'center', color: 'var(--text-subtle)', fontSize: '12.5px' }}>
                        No new notifications
                      </div>
                    ) : (
                      notificationsList.map((n) => (
                        <div
                          key={n.id}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            backgroundColor: n.is_read ? 'transparent' : 'rgba(229, 169, 60, 0.08)',
                            border: n.is_read ? '1px solid transparent' : '1px solid var(--primary-border)',
                            fontSize: '12.5px',
                            display: 'flex',
                            gap: '8px',
                            alignItems: 'flex-start',
                          }}
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{
                              fontSize: '16px',
                              color: n.is_read ? 'var(--text-subtle)' : 'var(--primary)',
                              marginTop: '2px',
                            }}
                          >
                            {n.notification_type === 'like' ? 'favorite' : n.notification_type === 'comment' ? 'forum' : 'notifications'}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ color: 'var(--text)', lineHeight: 1.35 }}>
                              {n.message || n.text || 'New interaction on your mathematical proof'}
                            </div>
                            <div style={{ fontSize: '10.5px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                              {n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Avatar & Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowProfileMenu((prev) => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  padding: '4px 10px 4px 5px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: 'var(--text)',
                }}
              >
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '5px',
                    backgroundColor: 'var(--surface-input)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary)',
                    fontWeight: 700,
                    fontSize: '12px',
                    overflow: 'hidden',
                  }}
                >
                  {user?.avatar ? (
                    <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    user?.username?.[0]?.toUpperCase() || 'M'
                  )}
                </div>
                <span style={{ fontSize: '13px', fontWeight: 500, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.username || 'User'}
                </span>
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: user?.role === 'host' ? 'rgba(229, 169, 60, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                    color: user?.role === 'host' ? 'var(--primary)' : '#60A5FA',
                    border: `1px solid ${user?.role === 'host' ? 'rgba(229, 169, 60, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                  }}
                >
                  {user?.role === 'host' ? 'Host' : 'Student'}
                </span>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-subtle)' }}>expand_more</span>
              </button>

              {/* Dropdown Menu */}
              {showProfileMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    width: '180px',
                    backgroundColor: 'var(--surface-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '5px',
                    boxShadow: 'var(--shadow-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    zIndex: 200,
                  }}
                >
                  <Link
                    to="/profile"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: 'var(--text)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>person</span>
                    My Profile
                  </Link>

                  <button
                    onClick={logout}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#E0684B',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      width: '100%',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(224,104,75,0.08)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>logout</span>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link to="/login" className="btn-secondary" style={{ padding: '6px 14px', fontSize: '13px' }}>
              Sign In
            </Link>
            <Link to="/register" className="btn-primary" style={{ padding: '6px 14px', fontSize: '13px' }}>
              Get Started
            </Link>
          </div>
        )}
      </div>

      <style>{`
        @media (min-width: 860px) {
          .desktop-nav {
            display: flex !important;
          }
        }
      `}</style>
    </header>
  );
}

export default Navbar;
