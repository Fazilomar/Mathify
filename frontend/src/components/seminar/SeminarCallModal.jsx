import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export function SeminarCallModal({ group, onClose }) {
  const { user } = useAuth();
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [mediaError, setMediaError] = useState(null);
  const [isSpeakingLocal, setIsSpeakingLocal] = useState(false);

  const [participants, setParticipants] = useState([
    { id: user?.id || 1, name: user?.username || 'You', isMe: true, isSpeaking: false, role: 'Scholar' },
  ]);

  const [remoteStreams, setRemoteStreams] = useState({});

  const localStreamRef = useRef(null);
  const cameraTrackRef = useRef(null);
  const screenTrackRef = useRef(null);
  const screenAudioTrackRef = useRef(null);
  const localVideoRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  const peerConnectionsRef = useRef({});
  const lastSignalIdRef = useRef(0);
  const isMountedRef = useRef(true);

  // -------------------------------------------------------------
  // 1. Initialize Local Media (Webcam & Microphone)
  // -------------------------------------------------------------
  useEffect(() => {
    isMountedRef.current = true;

    const startLocalMedia = async () => {
      try {
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: { echoCancellation: true, noiseSuppression: true },
          });
        } catch (videoErr) {
          console.warn('Camera failed/denied, falling back to audio-only:', videoErr);
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setCamEnabled(false);
        }

        if (!isMountedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        cameraTrackRef.current = stream.getVideoTracks()[0] || null;

        if (localVideoRef.current && cameraTrackRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        setupAudioAnalyser(stream);

        Object.values(peerConnectionsRef.current).forEach((pc) => {
          stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        });
      } catch (err) {
        console.error('Failed to get media devices:', err);
        if (isMountedRef.current) {
          setMediaError('Unable to access camera or microphone. Check browser permissions.');
          setCamEnabled(false);
          setMicEnabled(false);
        }
      }
    };

    startLocalMedia();

    return () => {
      isMountedRef.current = false;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
      }
      if (screenAudioTrackRef.current) {
        screenAudioTrackRef.current.stop();
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => { });
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [camEnabled, screenSharing]);

  // -------------------------------------------------------------
  // 2. Real Voice Activity & Speaking Detection
  // -------------------------------------------------------------
  const setupAudioAnalyser = (stream) => {
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkVolume = () => {
        if (!isMountedRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setIsSpeakingLocal(avg > 18);
        animFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (e) {
      console.warn('AudioContext setup error:', e);
    }
  };

  // -------------------------------------------------------------
  // 3. WebRTC Signaling & Multi-User Peer Connections
  // -------------------------------------------------------------
  const sendSignal = async (recipientUsername, signalType, payload) => {
    if (!group?.id) return;
    try {
      await API.post(`/api/social/groups/${group.id}/call_signals/`, {
        recipient: recipientUsername,
        type: signalType,
        payload,
      });
    } catch (err) {
      console.warn('Signal send error:', err);
    }
  };

  const closeAndRemovePeer = useCallback((peerUsername) => {
    const pc = peerConnectionsRef.current[peerUsername];
    if (pc) {
      try {
        pc.close();
      } catch {
        // already closed
      }
      delete peerConnectionsRef.current[peerUsername];
    }
    if (isMountedRef.current) {
      setRemoteStreams((prev) => {
        if (!(peerUsername in prev)) return prev;
        const next = { ...prev };
        delete next[peerUsername];
        return next;
      });
    }
  }, []);

  const getOrCreatePeerConnection = (peerUsername) => {
    if (peerConnectionsRef.current[peerUsername]) {
      return peerConnectionsRef.current[peerUsername];
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current[peerUsername] = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(peerUsername, 'candidate', event.candidate);
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      if (isMountedRef.current) {
        setRemoteStreams((prev) => ({
          ...prev,
          [peerUsername]: remoteStream,
        }));
      }
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        closeAndRemovePeer(peerUsername);
      }
    };

    return pc;
  };

  // Synchronize participants & establish peer connections
  const syncCall = useCallback(async () => {
    if (!group?.id) return;
    try {
      const res = await API.get(`/api/social/groups/${group.id}/current_call/`);
      if (!isMountedRef.current) return;
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.participants)) {
          const currentUsername = user?.username || 'You';
          const list = data.participants.map((uname, idx) => ({
            id: idx + 1,
            name: uname,
            isMe: uname === currentUsername,
            isSpeaking: false,
            role: uname === data.initiator_username ? 'Initiator' : 'Scholar',
          }));

          if (!list.some((p) => p.isMe)) {
            list.unshift({ id: 0, name: currentUsername, isMe: true, isSpeaking: false, role: 'Scholar' });
          }

          if (isMountedRef.current) setParticipants(list);

          // Close and clean up peers who left the call
          const currentRemoteUsernames = new Set(
            data.participants.filter((u) => u !== currentUsername)
          );
          Object.keys(peerConnectionsRef.current).forEach((existingPeer) => {
            if (!currentRemoteUsernames.has(existingPeer)) {
              closeAndRemovePeer(existingPeer);
            }
          });

          // Initiate WebRTC offer if I am alphabetically greater (deterministic offerer)
          data.participants.forEach((remoteUser) => {
            if (remoteUser !== currentUsername) {
              const pc = getOrCreatePeerConnection(remoteUser);
              if (currentUsername > remoteUser && pc.signalingState === 'stable' && !pc.currentRemoteDescription) {
                pc.createOffer()
                  .then((offer) => pc.setLocalDescription(offer))
                  .then(() => {
                    sendSignal(remoteUser, 'offer', pc.localDescription);
                  })
                  .catch((err) => console.warn('Offer creation failed:', err));
              }
            }
          });
        }
      }
    } catch { }
  }, [group?.id, user?.username, closeAndRemovePeer]);

  // Poll for incoming WebRTC signals
  const pollSignals = useCallback(async () => {
    if (!group?.id) return;
    try {
      const url = `/api/social/groups/${group.id}/call_signals/?since_id=${lastSignalIdRef.current}`;
      const res = await API.get(url);
      if (!isMountedRef.current) return;
      if (res.ok) {
        const signals = await res.json();
        if (Array.isArray(signals)) {
          for (const sig of signals) {
            if (sig.id > lastSignalIdRef.current) {
              lastSignalIdRef.current = sig.id;
            }

            const sender = sig.sender;
            if (!sender || sender === user?.username) continue;
            if (!isMountedRef.current) return;

            const pc = getOrCreatePeerConnection(sender);

            if (sig.type === 'offer') {
              await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await sendSignal(sender, 'answer', answer);
            } else if (sig.type === 'answer') {
              if (pc.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
              }
            } else if (sig.type === 'candidate' && sig.payload) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(sig.payload));
              } catch (e) {
                console.warn('Error adding ICE candidate:', e);
              }
            }
          }
        }
      }
    } catch { }
  }, [group?.id, user?.username]);

  // Call lifecycle & periodic polling
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    if (group?.id) {
      API.post(`/api/social/groups/${group.id}/current_call/`, {})
        .then(() => syncCall())
        .catch(() => { });
    }

    const pollSync = setInterval(syncCall, 3500);
    const pollSig = setInterval(pollSignals, 1200);

    return () => {
      clearInterval(timer);
      clearInterval(pollSync);
      clearInterval(pollSig);

      Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
      peerConnectionsRef.current = {};

      if (group?.id) {
        API.post(`/api/social/groups/${group.id}/leave_call/`, {}).catch(() => { });
      }
    };
  }, [group?.id, syncCall, pollSignals]);

  // -------------------------------------------------------------
  // 4. Hardware Controls (Mic, Cam, Screen Share)
  // -------------------------------------------------------------
  const handleToggleMic = () => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !micEnabled;
      setMicEnabled(!micEnabled);
    }
  };

  const handleToggleCam = async () => {
    if (!localStreamRef.current) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !camEnabled;
      setCamEnabled(!camEnabled);
    } else if (!camEnabled) {
      try {
        const vStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newTrack = vStream.getVideoTracks()[0];
        localStreamRef.current.addTrack(newTrack);
        cameraTrackRef.current = newTrack;
        setCamEnabled(true);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        Object.values(peerConnectionsRef.current).forEach((pc) => {
          pc.addTrack(newTrack, localStreamRef.current);
        });
      } catch {
        alert('Could not enable camera. Verify camera device permissions.');
      }
    }
  };

  const handleToggleScreenShare = async () => {
    if (screenSharing) {
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
        screenTrackRef.current = null;
      }
      if (screenAudioTrackRef.current) {
        screenAudioTrackRef.current.stop();
        screenAudioTrackRef.current = null;
      }
      if (cameraTrackRef.current) {
        replaceVideoTrack(cameraTrackRef.current);
      }
      setScreenSharing(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const sTrack = screenStream.getVideoTracks()[0];
        screenTrackRef.current = sTrack;

        const sAudioTrack = screenStream.getAudioTracks()[0] || null;
        screenAudioTrackRef.current = sAudioTrack;

        sTrack.onended = () => {
          if (screenAudioTrackRef.current) {
            screenAudioTrackRef.current.stop();
            screenAudioTrackRef.current = null;
          }
          if (cameraTrackRef.current) {
            replaceVideoTrack(cameraTrackRef.current);
          }
          setScreenSharing(false);
        };

        replaceVideoTrack(sTrack);
        setScreenSharing(true);
      } catch (err) {
        console.warn('Screen share cancelled or failed:', err);
      }
    }
  };

  const replaceVideoTrack = (newTrack) => {
    Object.values(peerConnectionsRef.current).forEach((pc) => {
      const senders = pc.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
      if (videoSender) {
        videoSender.replaceTrack(newTrack);
      }
    });

    if (localVideoRef.current && localStreamRef.current) {
      const oldTracks = localStreamRef.current.getVideoTracks();
      oldTracks.forEach((t) => localStreamRef.current.removeTrack(t));
      localStreamRef.current.addTrack(newTrack);
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  };

  const handleEndCall = () => {
    if (group?.id) {
      API.post(`/api/social/groups/${group.id}/leave_call/`, {}).catch(() => { });
    }
    onClose();
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(10, 10, 14, 0.92)',
        backdropFilter: 'blur(12px)',
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
          maxWidth: '960px',
          height: '86vh',
          maxHeight: '760px',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#16161B',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.8)',
        }}
      >
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
                <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 700 }}>
                  {group?.name || 'Mathematical Seminar Call'}
                </h3>
                <span className="badge-academic" style={{ fontSize: '10.5px', padding: '2px 8px' }}>
                  Live WebRTC P2P
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

        {mediaError && (
          <div
            style={{
              padding: '8px 20px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#F87171',
              fontSize: '12.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>error</span>
            <span>{mediaError}</span>
          </div>
        )}

        <div
          style={{
            flex: 1,
            padding: '20px',
            display: 'grid',
            gridTemplateColumns: participants.length > 2 ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '16px',
            overflowY: 'auto',
            backgroundColor: '#121216',
          }}
        >
          {participants.map((p) => {
            const isMe = p.isMe;
            const hasRemoteStream = !isMe && remoteStreams[p.name];
            const isSpeaking = isMe ? isSpeakingLocal && micEnabled : p.isSpeaking;

            return (
              <div
                key={p.id || p.name}
                style={{
                  position: 'relative',
                  borderRadius: '12px',
                  backgroundColor: '#181822',
                  border: isSpeaking ? '2px solid var(--primary)' : '1px solid var(--border)',
                  boxShadow: isSpeaking ? '0 0 18px rgba(229, 169, 60, 0.3)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  minHeight: '220px',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                {isMe ? (
                  camEnabled ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transform: screenSharing ? 'none' : 'scaleX(-1)',
                      }}
                    />
                  ) : null
                ) : (
                  hasRemoteStream ? (
                    <video
                      ref={(el) => {
                        if (el && remoteStreams[p.name] && el.srcObject !== remoteStreams[p.name]) {
                          el.srcObject = remoteStreams[p.name];
                        }
                      }}
                      autoPlay
                      playsInline
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : null
                )}

                {((isMe && !camEnabled) || (!isMe && !hasRemoteStream)) && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 2,
                    }}
                  >
                    <div
                      style={{
                        width: '68px',
                        height: '68px',
                        borderRadius: '50%',
                        backgroundColor: isMe ? 'var(--primary-subtle)' : '#262632',
                        border: '2px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px',
                        fontWeight: 700,
                        color: isMe ? 'var(--primary)' : 'var(--text-muted)',
                        fontFamily: 'serif',
                        marginBottom: '10px',
                      }}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text)' }}>
                      {p.name} {isMe && '(You)'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                      {p.role} &bull; {isMe ? (micEnabled ? 'Audio Active' : 'Muted') : 'Connected'}
                    </div>
                  </div>
                )}

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
                      zIndex: 4,
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

                <div
                  style={{
                    position: 'absolute',
                    bottom: '10px',
                    left: '12px',
                    right: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    zIndex: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: '5px',
                      backgroundColor: 'rgba(10, 10, 14, 0.75)',
                      backdropFilter: 'blur(4px)',
                      color: isSpeaking ? 'var(--primary)' : '#E2E8F0',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    {p.name} {isMe ? '(You)' : ''}
                  </span>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    {isMe && !micEnabled && (
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: '15px',
                          color: '#EF4444',
                          backgroundColor: 'rgba(10, 10, 14, 0.75)',
                          padding: '3px',
                          borderRadius: '4px',
                        }}
                      >
                        mic_off
                      </span>
                    )}
                    {isMe && !camEnabled && (
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: '15px',
                          color: '#EF4444',
                          backgroundColor: 'rgba(10, 10, 14, 0.75)',
                          padding: '3px',
                          borderRadius: '4px',
                        }}
                      >
                        videocam_off
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

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
            onClick={handleToggleMic}
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
            onClick={handleToggleCam}
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
            onClick={handleToggleScreenShare}
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
            title={screenSharing ? 'Stop Sharing Screen' : 'Share Screen'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              {screenSharing ? 'stop_screen_share' : 'screen_share'}
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

export default SeminarCallModal;
