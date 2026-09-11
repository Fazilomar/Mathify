import React, { useState, useEffect } from 'react';
import { API } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export function SeminarCallModal({ group, onClose }) {
  const { user } = useAuth();
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [participants, setParticipants] = useState([
    { id: user?.id || 1, name: user?.username || 'You', isMe: true, isSpeaking: true, role: 'Presenter' },
  ]);

  const syncCall = async () => {
    if (!group?.id) return;
    try {
      const res = await API.get(`/api/social/groups/${group.id}/current_call/`);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.participants)) {
          const list = data.participants.map((uname, idx) => ({
            id: idx + 1,
            name: uname,
            isMe: uname === user?.username,
            isSpeaking: false,
            role: uname === data.initiator_username ? 'Initiator' : 'Scholar',
          }));
          if (!list.some((p) => p.isMe)) {
            list.unshift({ id: 0, name: user?.username || 'You', isMe: true, isSpeaking: true, role: 'Scholar' });
          }
          setParticipants(list);
        }
      }
    } catch {}
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    // Call backend to announce presence and join call
    if (group?.id) {
      API.post(`/api/social/groups/${group.id}/current_call/`, {})
        .then(() => syncCall())
        .catch(() => {});
    }

    const poll = setInterval(syncCall, 3000);

    return () => {
      clearInterval(timer);
      clearInterval(poll);
      if (group?.id) {
        API.post(`/api/social/groups/${group.id}/leave_call/`, {}).catch(() => {});
      }
    };
  }, [group?.id]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleEndCall = () => {
    if (group?.id) {
      API.post(`/api/social/groups/${group.id}/leave_call/`, {}).catch(() => {});
    }
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(10, 10, 14, 0.88)',
        backdropFilter: 'blur(10px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '920px',
          height: '84vh',
          maxHeight: '740px',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#16161B',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7)',
        }}
      >
        {/* Call Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#141418',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: '#EF4444',
                boxShadow: '0 0 8px #EF4444',
                animation: 'pulse 1.5s infinite',
              }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
                  {group?.name || 'Mathematical Seminar Call'}
                </h3>
                <span className="badge-academic" style={{ fontSize: '10.5px', padding: '2px 8px' }}>
                  Live Synchronous
                </span>
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                Room Duration: {formatTime(elapsedSeconds)} &bull; {participants.length} connected
              </div>
            </div>
          </div>

          <button
            onClick={handleEndCall}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-subtle)',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>

        {/* Video / Audio Tiles Grid */}
        <div
          style={{
            flex: 1,
            padding: '20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '16px',
            overflowY: 'auto',
            backgroundColor: '#121216',
          }}
        >
          {participants.map((p) => {
            const isSpeaking = p.isSpeaking && (p.isMe ? micEnabled : true);
            return (
              <div
                key={p.id}
                style={{
                  position: 'relative',
                  borderRadius: '12px',
                  backgroundColor: '#1A1A22',
                  border: isSpeaking ? '2px solid var(--primary)' : '1px solid var(--border)',
                  boxShadow: isSpeaking ? '0 0 16px rgba(229, 169, 60, 0.25)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  minHeight: '200px',
                  transition: 'border-color 0.2s ease',
                }}
              >
                {/* Audio visualizer waves if speaking */}
                {isSpeaking && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      display: 'flex',
                      gap: '3px',
                      alignItems: 'flex-end',
                      height: '16px',
                    }}
                  >
                    {[12, 16, 10, 14].map((h, i) => (
                      <span
                        key={i}
                        style={{
                          width: '3px',
                          height: `${h}px`,
                          backgroundColor: 'var(--primary)',
                          borderRadius: '1px',
                          animation: `pulse ${0.6 + i * 0.2}s infinite alternate`,
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Avatar Icon */}
                <div
                  style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '50%',
                    backgroundColor: p.isMe ? 'var(--primary-subtle)' : '#262632',
                    border: '2px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    fontWeight: 700,
                    color: p.isMe ? 'var(--primary)' : 'var(--text-muted)',
                    fontFamily: 'serif',
                    marginBottom: '10px',
                  }}
                >
                  {p.name.charAt(0).toUpperCase()}
                </div>

                <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text)' }}>
                  {p.name} {p.isMe && '(You)'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                  {p.role} &bull; {p.isMe ? (micEnabled ? 'Audio Active' : 'Muted') : 'Connected'}
                </div>

                {/* Floating Bottom Status in Tile */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '10px',
                    left: '12px',
                    right: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: '10.5px',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      color: isSpeaking ? 'var(--primary)' : 'var(--text-subtle)',
                    }}
                  >
                    {isSpeaking ? 'Speaking' : 'Listening'}
                  </span>

                  {p.isMe && !micEnabled && (
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#EF4444' }}>
                      mic_off
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Seminar Room Control Bar */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '16px',
            backgroundColor: '#141418',
          }}
        >
          <button
            onClick={() => setMicEnabled(!micEnabled)}
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border)',
              backgroundColor: micEnabled ? '#22222A' : '#7F1D1D',
              color: micEnabled ? 'var(--text)' : '#F87171',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            title={micEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              {micEnabled ? 'mic' : 'mic_off'}
            </span>
          </button>

          <button
            onClick={() => setCamEnabled(!camEnabled)}
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border)',
              backgroundColor: camEnabled ? '#22222A' : '#7F1D1D',
              color: camEnabled ? 'var(--text)' : '#F87171',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            title={camEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              {camEnabled ? 'videocam' : 'videocam_off'}
            </span>
          </button>

          <button
            onClick={() => setScreenSharing(!screenSharing)}
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border)',
              backgroundColor: screenSharing ? 'var(--primary-subtle)' : '#22222A',
              color: screenSharing ? 'var(--primary)' : 'var(--text)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            title="Share Screen"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              screen_share
            </span>
          </button>

          <button
            onClick={handleEndCall}
            style={{
              padding: '0 20px',
              height: '46px',
              borderRadius: '23px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              border: 'none',
              backgroundColor: '#EF4444',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: '13.5px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
              transition: 'transform 0.15s ease',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              call_end
            </span>
            Leave Seminar
          </button>
        </div>
      </div>
    </div>
  );
}
