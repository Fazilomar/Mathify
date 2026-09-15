import React, { useEffect } from 'react';

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed? This action cannot be undone.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger', // 'danger' | 'warning' | 'info'
  isLoading = false,
  icon,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose?.();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          badgeBg: 'rgba(239, 68, 68, 0.12)',
          badgeBorder: 'rgba(239, 68, 68, 0.28)',
          badgeColor: '#EF4444',
          badgeShadow: '0 0 24px rgba(239, 68, 68, 0.25)',
          confirmBg: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
          confirmHoverBg: 'linear-gradient(135deg, #F87171 0%, #EF4444 100%)',
          confirmShadow: '0 4px 18px rgba(239, 68, 68, 0.38)',
          cardBorder: 'rgba(239, 68, 68, 0.25)',
          glowColor: 'rgba(239, 68, 68, 0.12)',
          defaultIcon: 'delete_forever',
        };
      case 'warning':
        return {
          badgeBg: 'rgba(245, 158, 11, 0.12)',
          badgeBorder: 'rgba(245, 158, 11, 0.3)',
          badgeColor: '#F59E0B',
          badgeShadow: '0 0 24px rgba(245, 158, 11, 0.25)',
          confirmBg: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
          confirmHoverBg: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
          confirmShadow: '0 4px 18px rgba(245, 158, 11, 0.35)',
          cardBorder: 'rgba(245, 158, 11, 0.25)',
          glowColor: 'rgba(245, 158, 11, 0.12)',
          defaultIcon: 'warning',
        };
      case 'info':
      default:
        return {
          badgeBg: 'rgba(229, 169, 60, 0.12)',
          badgeBorder: 'rgba(229, 169, 60, 0.3)',
          badgeColor: 'var(--primary, #E5A93C)',
          badgeShadow: '0 0 24px rgba(229, 169, 60, 0.25)',
          confirmBg: 'linear-gradient(135deg, #E5A93C 0%, #C88D23 100%)',
          confirmHoverBg: 'linear-gradient(135deg, #F0BA57 0%, #E5A93C 100%)',
          confirmShadow: '0 4px 18px rgba(229, 169, 60, 0.35)',
          cardBorder: 'rgba(229, 169, 60, 0.25)',
          glowColor: 'rgba(229, 169, 60, 0.12)',
          defaultIcon: 'help_outline',
        };
    }
  };

  const vStyles = getVariantStyles();
  const displayIcon = icon || vStyles.defaultIcon;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backgroundColor: 'rgba(7, 8, 12, 0.84)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        animation: 'fadeInScale 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose?.();
        }
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '430px',
          backgroundColor: '#16161D',
          backgroundImage: 'linear-gradient(180deg, rgba(28, 28, 36, 0.95) 0%, rgba(18, 18, 24, 0.98) 100%)',
          borderRadius: '18px',
          border: `1px solid ${vStyles.cardBorder}`,
          boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.9), 0 0 35px ${vStyles.glowColor}`,
          padding: '24px',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        {/* Subtle decorative top ambient light */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '20%',
            right: '20%',
            height: '2px',
            background: `radial-gradient(ellipse at center, ${vStyles.badgeColor} 0%, transparent 80%)`,
            opacity: 0.8,
            pointerEvents: 'none',
          }}
        />

        {/* Header with Icon and Close Button */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: vStyles.badgeBg,
              border: `1px solid ${vStyles.badgeBorder}`,
              color: vStyles.badgeColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: vStyles.badgeShadow,
              flexShrink: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '26px' }}>
              {displayIcon}
            </span>
          </div>

          <button
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close dialog"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-subtle, #94A3B8)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.color = '#FFFFFF';
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-subtle, #94A3B8)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h3
            id="confirm-modal-title"
            style={{
              margin: 0,
              fontSize: '18.5px',
              fontWeight: 700,
              color: '#F8FAFC',
              letterSpacing: '-0.015em',
            }}
          >
            {title}
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: '#94A3B8',
              lineHeight: 1.6,
            }}
          >
            {message}
          </p>
        </div>

        {/* Danger irreversible pill badge */}
        {variant === 'danger' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.16)',
              fontSize: '12.5px',
              color: '#F87171',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px', flexShrink: 0 }}>
              info
            </span>
            <span>This action is permanent and cannot be undone.</span>
          </div>
        )}

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '8px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            style={{
              padding: '9px 16px',
              borderRadius: '10px',
              backgroundColor: '#20202A',
              border: '1px solid rgba(255, 255, 255, 0.09)',
              color: '#CBD5E1',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = '#2A2A37';
                e.currentTarget.style.color = '#FFFFFF';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#20202A';
              e.currentTarget.style.color = '#CBD5E1';
            }}
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              padding: '9px 20px',
              borderRadius: '10px',
              background: vStyles.confirmBg,
              border: 'none',
              color: '#FFFFFF',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              boxShadow: vStyles.confirmShadow,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
              opacity: isLoading ? 0.75 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = vStyles.confirmHoverBg;
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = vStyles.confirmBg;
              e.currentTarget.style.transform = 'none';
            }}
          >
            {isLoading ? (
              <>
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: '16px',
                    animation: 'spin 1s linear infinite',
                  }}
                >
                  progress_activity
                </span>
                <span>Processing...</span>
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
