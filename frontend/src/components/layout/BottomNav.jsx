import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

export function BottomNav() {
  const location = useLocation();

  const tabs = [
    { label: 'Feed', path: '/feed', icon: 'dynamic_feed' },
    { label: 'Contests', path: '/competitions', icon: 'emoji_events' },
    { label: 'Studio', path: '/studio', icon: 'history_edu' },
    { label: 'AI Tutor', path: '/tutor', icon: 'smart_toy' },
  ];

  // Don't show bottom nav on login/register pages
  if (['/login', '/register'].includes(location.pathname)) {
    return null;
  }

  const handleOpenMore = () => {
    window.dispatchEvent(new CustomEvent('nav:open-drawer'));
  };

  return (
    <nav
      className="bottom-nav-mobile"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'var(--bottom-nav-height)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        backgroundColor: 'rgba(14, 14, 17, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--border)',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 100,
      }}
    >
      {tabs.map((tab) => {
        const isActive =
          location.pathname === tab.path ||
          location.pathname.startsWith(`${tab.path}/`) ||
          ((tab.path === '/studio' || tab.path === '/proofs') &&
            (location.pathname === '/studio' || location.pathname === '/proofs'));

        return (
          <NavLink
            key={tab.path}
            to={tab.path}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              padding: '6px 4px',
              textDecoration: 'none',
              color: isActive ? 'var(--primary)' : 'var(--text-muted)',
              transition: 'color 0.15s ease',
              position: 'relative',
              flex: 1,
              maxWidth: '75px',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: '22px',
                fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
              }}
            >
              {tab.icon}
            </span>
            <span
              style={{
                fontSize: '10.5px',
                fontWeight: isActive ? 600 : 500,
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </span>
            {isActive && (
              <span
                style={{
                  position: 'absolute',
                  bottom: '2px',
                  width: '16px',
                  height: '2px',
                  borderRadius: '1px',
                  backgroundColor: 'var(--primary)',
                }}
              />
            )}
          </NavLink>
        );
      })}

      {/* 5th Tab: Menu (opens comprehensive drawer with Leaderboard, Library, Groups, Profile) */}
      <button
        onClick={handleOpenMore}
        aria-label="Open full platform menu"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3px',
          padding: '6px 4px',
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          flex: 1,
          maxWidth: '75px',
          position: 'relative',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
          menu
        </span>
        <span
          style={{
            fontSize: '10.5px',
            fontWeight: 500,
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
          }}
        >
          More
        </span>
      </button>
    </nav>
  );
}

export default BottomNav;
