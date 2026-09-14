import React, { useState, useEffect, useRef, useMemo } from 'react';

const EMOJI_CATEGORIES = [
  {
    id: 'favorites',
    name: 'Top Reactions',
    icon: 'star',
    emojis: ['👏', '💡', '🔥', '❤️', '👍', '🤯', '😂', '🎯', '✨', '💯', '🎉', '🧠'],
  },
  {
    id: 'expressions',
    name: 'Faces & Expressions',
    icon: 'mood',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥹', '😊',
      '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😋', '😜', '🤪',
      '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞',
      '😔', '😟', '😕', '🙁', '😣', '😖', '😫', '😩', '🥺', '😢',
      '😭', '😮', '😯', '😲', '😳', '🤯', '😱', '😨', '😰', '🤔',
      '🫣', '🤫', '🫠', '🫡', '🤗', '😬', '😮‍💨', '😴', '🤤', '😵',
    ],
  },
  {
    id: 'gestures',
    name: 'Gestures & People',
    icon: 'front_hand',
    emojis: [
      '👍', '👎', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪',
      '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇',
      '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '🫡',
    ],
  },
  {
    id: 'academic',
    name: 'Math, Logic & Science',
    icon: 'functions',
    emojis: [
      '📐', '📏', '🔬', '🔭', '📡', '💡', '🔦', '🧮', '💻', '🖥️',
      '⌨️', '🖱️', '💾', '⚡', '⚙️', '🔧', '⚖️', '🔗', '🧲', '🧪',
      '🧫', '🧬', '📊', '📈', '📉', '📚', '📖', '📜', '📄', '📝',
      '✏️', '🖊️', '🔍', '🔎', '🚀', '🪐', '🌌', '🎲', '♟️', '⌛',
    ],
  },
  {
    id: 'celebrations',
    name: 'Celebration & Vibes',
    icon: 'celebration',
    emojis: [
      '🔥', '✨', '🎉', '🎊', '🎈', '🎆', '🎇', '🏆', '🥇', '🥈',
      '🥉', '🏅', '🎖️', '👑', '💎', '💯', '⭐', '🌟', '💫', '🎯',
      '🥂', '🍻', '☕', '🍵', '🍾', '🍕', '🍩', '🍪', '🍫', '🍿',
    ],
  },
  {
    id: 'symbols',
    name: 'Symbols & Marks',
    icon: 'category',
    emojis: [
      '✔️', '❌', '❓', '❗', '❕', '❔', '‼️', '⁉️', '➕', '➖',
      '➗', '✖️', '♾️', '💲', '🪙', '💬', '💭', '🔔', '🟢', '🔴',
      '🟡', '🔵', '🟣', '🟠', '🟩', '🟥', '🟨', '🟦', '🏁', '🚩',
    ],
  },
];

export function EmojiReactionPicker({ isOpen, onClose, onSelectEmoji }) {
  const [activeTab, setActiveTab] = useState('favorites');
  const [searchQuery, setSearchQuery] = useState('');
  const pickerRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose?.();
      }
    };

    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose?.();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const filteredEmojis = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;

    const all = [];
    EMOJI_CATEGORIES.forEach((cat) => {
      cat.emojis.forEach((em) => {
        if (!all.includes(em)) all.push(em);
      });
    });

    return all;
  }, [searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      ref={pickerRef}
      role="dialog"
      aria-label="Emoji reaction picker"
      style={{
        position: 'absolute',
        bottom: '76px',
        right: '20px',
        width: '340px',
        maxHeight: '420px',
        backgroundColor: 'rgba(22, 22, 29, 0.97)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--border, rgba(255, 255, 255, 0.12))',
        borderRadius: '16px',
        boxShadow: '0 20px 45px rgba(0, 0, 0, 0.75), 0 0 25px rgba(229, 169, 60, 0.12)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10001,
        overflow: 'hidden',
        animation: 'fadeInScale 0.16s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Header & Search */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary, #E5A93C)' }}>
            Room Reactions
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-subtle, #94A3B8)',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              borderRadius: '4px',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        {/* Search input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.09)',
            borderRadius: '8px',
            padding: '4px 8px',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-subtle)' }}>
            search
          </span>
          <input
            type="text"
            placeholder="Search emoji..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '12px',
              outline: 'none',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-subtle)',
                cursor: 'pointer',
                padding: 0,
                fontSize: '11px',
              }}
            >
              clear
            </button>
          )}
        </div>
      </div>

      {/* Category Tab Bar (Only when not searching) */}
      {!searchQuery && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 10px',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            overflowX: 'auto',
          }}
        >
          {EMOJI_CATEGORIES.map((cat) => {
            const active = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                title={cat.name}
                onClick={() => setActiveTab(cat.id)}
                style={{
                  background: active ? 'rgba(229, 169, 60, 0.16)' : 'transparent',
                  border: active ? '1px solid rgba(229, 169, 60, 0.35)' : '1px solid transparent',
                  color: active ? 'var(--primary, #E5A93C)' : 'var(--text-subtle, #94A3B8)',
                  borderRadius: '6px',
                  padding: '4px 7px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>
                  {cat.icon}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Emoji Grid Container */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '6px',
          maxHeight: '260px',
        }}
      >
        {filteredEmojis ? (
          filteredEmojis.map((emoji, idx) => (
            <button
              key={`${emoji}-${idx}`}
              onClick={() => {
                onSelectEmoji?.(emoji);
                onClose?.();
              }}
              style={{
                background: 'transparent',
                border: 'none',
                borderRadius: '8px',
                fontSize: '22px',
                cursor: 'pointer',
                padding: '6px 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.12s ease, background 0.12s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.28)';
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {emoji}
            </button>
          ))
        ) : (
          (() => {
            const currentCat = EMOJI_CATEGORIES.find((c) => c.id === activeTab) || EMOJI_CATEGORIES[0];
            return currentCat.emojis.map((emoji, idx) => (
              <button
                key={`${emoji}-${idx}`}
                onClick={() => {
                  onSelectEmoji?.(emoji);
                  onClose?.();
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '22px',
                  cursor: 'pointer',
                  padding: '6px 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.12s ease, background 0.12s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.28)';
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {emoji}
              </button>
            ));
          })()
        )}
      </div>
    </div>
  );
}

export default EmojiReactionPicker;
