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

export function SeminarCallModal({ group, meeting, onClose, onMeetingEnded, initialPreJoin = true }) {
  const { user } = useAuth();
  const [isPreJoin, setIsPreJoin] = useState(initialPreJoin);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [mediaError, setMediaError] = useState(null);
  const [isSpeakingLocal, setIsSpeakingLocal] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 100 for green room audio meter
  const [copiedLink, setCopiedLink] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const meetingCode = meeting?.meeting_code || `mtf-${group?.id || 'meet'}`;
  const [meetingTitle, setMeetingTitle] = useState(meeting?.title || `${group?.name || 'Academic'} Seminar`);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(meetingTitle);

  const handleSaveTitle = async () => {
    const trimmed = editedTitle.trim();
    if (!trimmed) {
      setIsEditingTitle(false);
      return;
    }
    setMeetingTitle(trimmed);
    setIsEditingTitle(false);
    if (meeting?.id) {
      try {
        await API.patch(`/api/social/calls/${meeting.id}/`, { title: trimmed });
      } catch (e) {
        console.warn('Failed to update title:', e);
      }
    }
  };

  const isHost = Boolean(
    meeting?.initiator === user?.username ||
    meeting?.initiator?.username === user?.username ||
    meeting?.initiator?.id === user?.id ||
    meeting?.initiator_username === user?.username ||
    group?.created_by === user?.id ||
    group?.created_by?.id === user?.id ||
    group?.is_admin === true
  );


  const [participants, setParticipants] = useState([
    { id: user?.id || 1, name: user?.username || 'You', isMe: true, isSpeaking: false, role: 'Scholar' },
  ]);

  const [remoteStreams, setRemoteStreams] = useState({});

  const localStreamRef = useRef(null);
  const cameraTrackRef = useRef(null);
  const screenTrackRef = useRef(null);
  const screenAudioTrackRef = useRef(null);
  const localVideoRef = useRef(null);
  const preJoinVideoRef = useRef(null);
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

        if (preJoinVideoRef.current && cameraTrackRef.current) {
          preJoinVideoRef.current.srcObject = stream;
        }
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

  // Sync video elements when cam/screen state or prejoin state changes
  useEffect(() => {
    if (isPreJoin && preJoinVideoRef.current && localStreamRef.current) {
      preJoinVideoRef.current.srcObject = localStreamRef.current;
    } else if (!isPreJoin && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [isPreJoin, camEnabled, screenSharing]);

  // -------------------------------------------------------------
  // 2. Real Voice Activity & Speaking Detection + Volume Meter
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
        setAudioLevel(Math.min(100, Math.round((avg / 80) * 100)));
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
    setRemoteStreams((prev) => {
      if (!prev[peerUsername]) return prev;
      const next = { ...prev };
      delete next[peerUsername];
      return next;
    });
  }, []);

  const cleanupTracksAndConnections = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
    }
    if (screenAudioTrackRef.current) {
      screenAudioTrackRef.current.stop();
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    Object.values(peerConnectionsRef.current).forEach((pc) => {
      try { pc.close(); } catch { }
    });
  }, []);

  const getOrCreatePeerConnection = useCallback((peerUsername) => {
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
      const [stream] = event.streams;
      if (stream) {
        setRemoteStreams((prev) => ({
          ...prev,
          [peerUsername]: stream,
        }));
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        closeAndRemovePeer(peerUsername);
      }
    };

    return pc;
  }, [closeAndRemovePeer]);

  // Sync participants list with backend
  const syncCallParticipants = useCallback(async () => {
    if (!group?.id || isPreJoin) return;
    try {
      const res = await API.get(`/api/social/groups/${group.id}/call/`);
      if (res.ok) {
        const data = await res.json();
        if (data && (data.status === 'ended' || (data.status === 'idle' && !isPreJoin))) {
          cleanupTracksAndConnections();
          onClose();
          return;
        }
        if (data && data.participants) {
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
  }, [group?.id, user?.username, isPreJoin, closeAndRemovePeer, getOrCreatePeerConnection]);

  // Poll for incoming WebRTC signals
  const pollSignals = useCallback(async () => {
    if (!group?.id || isPreJoin) return;
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
            } else if (sig.type === 'join') {
              setParticipants((prev) => {
                if (prev.some((p) => p.name === sender)) return prev;
                return [...prev, { id: Date.now(), name: sender, isMe: false, isSpeaking: false, role: 'Scholar' }];
              });
              if (user?.username && user.username > sender) {
                pc.createOffer()
                  .then((offer) => pc.setLocalDescription(offer))
                  .then(() => sendSignal(sender, 'offer', pc.localDescription))
                  .catch((e) => console.warn('Offer error:', e));
              }
            } else if (sig.type === 'leave') {
              closeAndRemovePeer(sender);
              setParticipants((prev) => prev.filter((p) => p.name !== sender));
            } else if (sig.type === 'end_meeting') {
              onMeetingEnded?.(meetingCode, meeting?.id);
              cleanupTracksAndConnections();
              onClose();
              return;
            }
          }
        }
      }
    } catch { }

  }, [group?.id, user?.username, isPreJoin, closeAndRemovePeer, getOrCreatePeerConnection, cleanupTracksAndConnections, onClose]);


  // Activate signaling loop only once user enters the conference (isPreJoin === false)
  useEffect(() => {
    if (isPreJoin) return;

    if (group?.id) {
      API.post(`/api/social/groups/${group.id}/join_call/`, {}).catch(() => { });
      sendSignal(null, 'join', { username: user?.username });
    }

    syncCallParticipants();
    pollSignals();

    const syncInterval = setInterval(syncCallParticipants, 4000);
    const signalInterval = setInterval(pollSignals, 1500);

    return () => {
      clearInterval(syncInterval);
      clearInterval(signalInterval);
      if (group?.id && user?.username) {
        sendSignal(null, 'leave', { username: user.username });
        API.post(`/api/social/groups/${group.id}/leave_call/`, {}).catch(() => { });
      }
      Object.values(peerConnectionsRef.current).forEach((pc) => {
        try { pc.close(); } catch { }
      });
      peerConnectionsRef.current = {};
    };
  }, [isPreJoin, group?.id, user?.username]);

  // Timer for call elapsed seconds
  useEffect(() => {
    if (isPreJoin) return;
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isPreJoin]);

  // -------------------------------------------------------------
  // 4. Hardware Toggles (Mic, Camera, Screen Share)
  // -------------------------------------------------------------
  const handleToggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !micEnabled;
        setMicEnabled(audioTrack.enabled);
      }
    }
  };

  const handleToggleCam = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !camEnabled;
        setCamEnabled(videoTrack.enabled);
      }
    }
  };

  const handleToggleScreenShare = async () => {
    if (!screenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });

        const newVideoTrack = screenStream.getVideoTracks()[0];
        screenTrackRef.current = newVideoTrack;
        screenAudioTrackRef.current = screenStream.getAudioTracks()[0] || null;

        replaceVideoTrack(newVideoTrack);
        setScreenSharing(true);

        newVideoTrack.onended = () => {
          stopScreenShare();
        };
      } catch (err) {
        console.warn('Screen share canceled or denied:', err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }
    if (screenAudioTrackRef.current) {
      screenAudioTrackRef.current.stop();
      screenAudioTrackRef.current = null;
    }
    setScreenSharing(false);

    if (cameraTrackRef.current) {
      replaceVideoTrack(cameraTrackRef.current);
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

  const handleJoinLive = (startMuted = false) => {
    if (startMuted && micEnabled) {
      handleToggleMic();
    }
    setIsPreJoin(false);
  };

  const [isEndingMeeting, setIsEndingMeeting] = useState(false);

  const handleLeaveCall = async () => {
    if (isEndingMeeting) return;
    setIsEndingMeeting(true);
    try {
      await sendSignal(null, 'leave', { username: user?.username }).catch(() => {});
      if (meeting?.id) {
        await API.post(`/api/social/calls/${meeting.id}/leave/`, {}).catch(() => {});
      } else if (group?.id) {
        await API.post(`/api/social/groups/${group.id}/leave_call/`, {}).catch(() => {});
      }
      onMeetingEnded?.(meetingCode, meeting?.id);
    } finally {
      cleanupTracksAndConnections();
      onClose();
      setIsEndingMeeting(false);
    }
  };

  const handleEndMeetingForAll = async () => {
    if (isEndingMeeting) return;
    setIsEndingMeeting(true);
    try {
      await sendSignal(null, 'end_meeting', {}).catch(() => {});
      if (meeting?.id) {
        await API.post(`/api/social/calls/${meeting.id}/end/`, {});
      } else if (group?.id) {
        await API.post(`/api/social/groups/${group.id}/end_call/`, {});
      }
      onMeetingEnded?.(meetingCode, meeting?.id);
    } catch (err) {
      console.warn('Error ending meeting:', err);
    } finally {
      cleanupTracksAndConnections();
      onClose();
      setIsEndingMeeting(false);
    }
  };


  const handleCopyLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const shareUrl = `${origin}/meet/${meetingCode}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2400);
    });
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
        backgroundColor: 'rgba(10, 10, 14, 0.94)',
        backdropFilter: 'blur(12px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: isPreJoin ? '760px' : '1020px',
          height: isPreJoin ? 'auto' : '88vh',
          maxHeight: isPreJoin ? '680px' : '800px',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#16161B',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85)',
          transition: 'max-width 0.3s ease',
        }}
      >
        {/* ========================================================= */}
        {/* GOOGLE MEET STYLE GREEN ROOM / PRE-JOIN SCREEN           */}
        {/* ========================================================= */}
        {isPreJoin ? (
          <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '24px', color: 'var(--primary)' }}>
                    videocam
                  </span>
                  {isEditingTitle ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSaveTitle();
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <input
                        type="text"
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        autoFocus
                        onBlur={handleSaveTitle}
                        style={{
                          padding: '4px 8px',
                          fontSize: '18px',
                          fontWeight: 700,
                          backgroundColor: '#1E1E26',
                          color: 'var(--text)',
                          border: '1px solid var(--primary)',
                          borderRadius: '6px',
                          outline: 'none',
                        }}
                      />
                      <button
                        type="submit"
                        className="btn-primary"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                      >
                        Save
                      </button>
                    </form>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>
                        {meetingTitle}
                      </h2>
                      {isHost && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditedTitle(meetingTitle);
                            setIsEditingTitle(true);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-subtle)',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: '4px',
                          }}
                          title="Edit seminar topic"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>
                            edit
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Code: <strong style={{ color: 'var(--primary)' }}>{meetingCode}</strong></span>
                  <span>•</span>
                  <span>{group?.name}</span>
                </div>
              </div>

              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-subtle)',
                  cursor: 'pointer',
                  padding: '6px',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>close</span>
              </button>
            </div>

            {mediaError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#FCA5A5',
                  fontSize: '12.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
                <span>{mediaError}</span>
              </div>
            )}

            {/* Pre-Join Grid: Camera Preview & Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'center' }}>
              {/* Camera Preview Tile */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '16/9',
                  backgroundColor: '#09090D',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: isSpeakingLocal ? '2px solid #22C55E' : '1px solid var(--border)',
                  boxShadow: isSpeakingLocal ? '0 0 16px rgba(34, 197, 94, 0.35)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <video
                  ref={preJoinVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scaleX(-1)',
                    display: camEnabled ? 'block' : 'none',
                  }}
                />

                {!camEnabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '76px',
                        height: '76px',
                        borderRadius: '50%',
                        backgroundColor: '#27272A',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '28px',
                        fontWeight: 700,
                        border: '2px solid rgba(229, 169, 60, 0.3)',
                      }}
                    >
                      {user?.username ? user.username.slice(0, 2).toUpperCase() : 'ME'}
                    </div>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-subtle)' }}>Camera is off</span>
                  </div>
                )}

                {/* Hardware Toggle Overlay */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    zIndex: 2,
                    backgroundColor: 'rgba(0, 0, 0, 0.65)',
                    backdropFilter: 'blur(6px)',
                    padding: '6px 14px',
                    borderRadius: '24px',
                  }}
                >
                  <button
                    type="button"
                    onClick={handleToggleMic}
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      border: 'none',
                      backgroundColor: micEnabled ? '#22C55E' : '#EF4444',
                      color: '#FFF',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                    }}
                    title={micEnabled ? 'Mute' : 'Unmute'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '19px' }}>
                      {micEnabled ? 'mic' : 'mic_off'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleCam}
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      border: 'none',
                      backgroundColor: camEnabled ? '#3B82F6' : '#EF4444',
                      color: '#FFF',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                    }}
                    title={camEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '19px' }}>
                      {camEnabled ? 'videocam' : 'videocam_off'}
                    </span>
                  </button>
                </div>

                {/* Audio Level Visualizer Bar */}
                {micEnabled && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      height: '6px',
                      width: '54px',
                      borderRadius: '3px',
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${audioLevel}%`,
                        backgroundColor: '#22C55E',
                        transition: 'width 0.1s ease',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Ready Card & Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 600, color: 'var(--text)' }}>
                    Ready to join?
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Check your audio and video before entering the seminar. Other scholars in the room will see you once you click join.
                  </p>
                </div>

                {/* Copy Link Row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <span style={{ fontSize: '12px', color: 'var(--text-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    /meet/{meetingCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: copiedLink ? '#22C55E' : 'var(--primary)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                      {copiedLink ? 'check' : 'content_copy'}
                    </span>
                    <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => handleJoinLive(false)}
                    className="btn-primary"
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '15px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>login</span>
                    <span>Join Now</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleJoinLive(true)}
                    className="btn-secondary"
                    style={{
                      width: '100%',
                      padding: '10px',
                      fontSize: '13.5px',
                      backgroundColor: '#27272A',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>mic_off</span>
                    <span>Join with Mic Muted</span>
                  </button>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={handleLeaveCall}
                      style={{
                        flex: 1,
                        padding: '9px 12px',
                        fontSize: '12.5px',
                        backgroundColor: 'transparent',
                        color: 'var(--text-subtle)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
                      <span>Cancel</span>
                    </button>

                    {isHost && (
                      <button
                        type="button"
                        onClick={() => setShowEndConfirm(true)}
                        style={{
                          flex: 1,
                          padding: '9px 12px',
                          fontSize: '12.5px',
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          color: '#F87171',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          fontWeight: 600,
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>call_end</span>
                        <span>End Meeting</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>
        ) : (
          /* ========================================================= */
          /* LIVE ACTIVE WEBRTC CONFERENCE ROOM                        */
          /* ========================================================= */
          <>
            {/* Conference Top Bar */}
            <div
              style={{
                padding: '14px 20px',
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
                      {meetingTitle}
                    </h3>
                    <span className="badge-academic" style={{ fontSize: '10px', padding: '2px 6px' }}>
                      WebRTC P2P
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    Code: <strong style={{ color: 'var(--primary)' }}>{meetingCode}</strong> • {group?.name}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Copy Link Button */}
                <button
                  type="button"
                  onClick={handleCopyLink}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    backgroundColor: copiedLink ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid var(--border)',
                    color: copiedLink ? '#22C55E' : 'var(--text)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    {copiedLink ? 'check' : 'content_copy'}
                  </span>
                  <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                </button>

                {/* Call Timer */}
                <span style={{ fontSize: '12px', color: 'var(--text-subtle)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatTime(elapsedSeconds)}
                </span>
              </div>
            </div>

            {/* Video Tile Grid */}
            <div
              style={{
                flex: 1,
                padding: '16px',
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: participants.length <= 2 ? '1fr 1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '14px',
                alignContent: 'center',
              }}
            >
              {participants.map((p) => {
                const isLocal = p.isMe;
                const remoteStream = remoteStreams[p.name];
                const hasVideo = isLocal ? (camEnabled || screenSharing) : (remoteStream && remoteStream.getVideoTracks().length > 0);
                const speaking = isLocal ? isSpeakingLocal : p.isSpeaking;

                return (
                  <div
                    key={p.id}
                    style={{
                      position: 'relative',
                      width: '100%',
                      aspectRatio: '16/9',
                      backgroundColor: '#0A0A0F',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      border: speaking ? '2.5px solid #22C55E' : '1px solid var(--border)',
                      boxShadow: speaking ? '0 0 16px rgba(34, 197, 94, 0.4)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'border 0.2s ease',
                    }}
                  >
                    {isLocal ? (
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          transform: screenSharing ? 'none' : 'scaleX(-1)',
                          display: (camEnabled || screenSharing) ? 'block' : 'none',
                        }}
                      />
                    ) : remoteStream ? (
                      <video
                        autoPlay
                        playsInline
                        ref={(el) => {
                          if (el && el.srcObject !== remoteStream) {
                            el.srcObject = remoteStream;
                          }
                        }}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : null}

                    {!hasVideo && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <div
                          style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            backgroundColor: '#27272A',
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '22px',
                            fontWeight: 700,
                            border: '2px solid rgba(229, 169, 60, 0.3)',
                          }}
                        >
                          {p.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>Camera Off</span>
                      </div>
                    )}

                    {/* Participant Info Tag */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '10px',
                        left: '10px',
                        right: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        pointerEvents: 'none',
                      }}
                    >
                      <span
                        style={{
                          backgroundColor: 'rgba(10, 10, 14, 0.75)',
                          backdropFilter: 'blur(4px)',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'var(--text)',
                        }}
                      >
                        {p.name} {isLocal && '(You)'}
                      </span>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        {isLocal && !micEnabled && (
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
                        {!hasVideo && (
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

            {/* Conference Bottom Action Bar */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '16px',
                backgroundColor: '#141418',
              }}
            >
              <button
                type="button"
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
                type="button"
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
                type="button"
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

              {isHost ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={handleLeaveCall}
                    style={{
                      padding: '0 18px',
                      height: '46px',
                      borderRadius: '23px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      border: '1px solid var(--border)',
                      backgroundColor: '#27272A',
                      color: 'var(--text)',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    title="Leave meeting (meeting stays open for others)"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '19px' }}>logout</span>
                    <span>Leave</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowEndConfirm(true)}
                    style={{
                      padding: '0 22px',
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
                      transition: 'all 0.15s ease',
                    }}
                    title="End seminar for all participants"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>call_end</span>
                    <span>End Meeting</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleLeaveCall}
                  style={{
                    padding: '0 22px',
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
                    transition: 'all 0.15s ease',
                  }}
                  title="End meeting for yourself"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>call_end</span>
                  <span>End Meeting</span>
                </button>
              )}
            </div>
          </>
        )}

        {/* End Meeting for Everyone Confirmation Modal */}
        {showEndConfirm && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(8px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
            }}
          >
            <div
              style={{
                maxWidth: '400px',
                width: '100%',
                backgroundColor: '#1E1E26',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 24px 60px rgba(0,0,0,0.9)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    color: '#EF4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '26px' }}>call_end</span>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--text)' }}>
                    End Seminar?
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    Choose whether to end this seminar for everyone or only leave yourself.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  disabled={isEndingMeeting}
                  onClick={handleLeaveCall}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: '#EF4444',
                    color: '#FFF',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: isEndingMeeting ? 'not-allowed' : 'pointer',
                    opacity: isEndingMeeting ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>call_end</span>
                  <span>{isEndingMeeting ? 'Leaving...' : 'End Meeting for Myself'}</span>
                </button>

                <button
                  type="button"
                  disabled={isEndingMeeting}
                  onClick={handleEndMeetingForAll}
                  style={{
                    width: '100%',
                    padding: '11px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    backgroundColor: '#27272A',
                    color: '#F87171',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: isEndingMeeting ? 'not-allowed' : 'pointer',
                    opacity: isEndingMeeting ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>power_settings_new</span>
                  <span>{isEndingMeeting ? 'Ending...' : 'End Meeting for Everyone'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowEndConfirm(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-subtle)',
                    fontSize: '13px',
                    cursor: 'pointer',
                    padding: '8px',
                    marginTop: '2px',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

  );
}

export default SeminarCallModal;
