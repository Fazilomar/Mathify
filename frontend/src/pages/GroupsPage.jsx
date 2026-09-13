import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../api/client';
import { SeminarCallModal } from '../components/seminar/SeminarCallModal';
import { WhiteboardModal } from '../components/seminar/WhiteboardModal';
import { ScheduleMeetingModal } from '../components/seminar/ScheduleMeetingModal';
import MathRenderer from '../components/common/MathRenderer';

export function GroupsPage() {
  const { user, isAuthenticated } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatAttachment, setChatAttachment] = useState(null);
  const [members, setMembers] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [showMembers, setShowMembers] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [roomFilter, setRoomFilter] = useState('');
  const [mobileTab, setMobileTab] = useState('chat'); // 'rooms' | 'chat'
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showWhiteboardModal, setShowWhiteboardModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState(null);
  const [meetingDropdownOpen, setMeetingDropdownOpen] = useState(false);
  const [copiedToast, setCopiedToast] = useState('');
  const [confirmEndMeeting, setConfirmEndMeeting] = useState(null);


  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomTopic, setNewRoomTopic] = useState('');
  const [newRoomType, setNewRoomType] = useState('study');
  const [newRoomPrivate, setNewRoomPrivate] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);

  const chatScrollRef = useRef(null);

  const quickSymbols = [
    { label: '∀', code: '\\forall ' },
    { label: '∃', code: '\\exists ' },
    { label: '∈', code: '\\in ' },
    { label: '∉', code: '\\notin ' },
    { label: '⟹', code: '\\implies ' },
    { label: '⟺', code: '\\iff ' },
    { label: '∑', code: '\\sum ' },
    { label: '∫', code: '\\int ' },
    { label: 'ℝ', code: '\\mathbb{R}' },
    { label: 'ℂ', code: '\\mathbb{C}' },
    { label: 'ℤ', code: '\\mathbb{Z}' },
    { label: 'ℕ', code: '\\mathbb{N}' },
    { label: 'π', code: '\\pi ' },
    { label: '∞', code: '\\infty ' },
    { label: '√', code: '\\sqrt{} ' },
  ];

  const fetchGroups = useCallback(async (silent = false, signal) => {
    try {
      if (!silent) setLoading(true);
      const res = await API.get('/api/social/groups/', { signal });
      if (res.ok) {
        const data = await res.json();
        const list = data.results || data;
        const validList = Array.isArray(list) ? list : [];
        setGroups(validList);
        if (validList.length > 0) {
          setActiveGroup((prev) => {
            if (prev && validList.some((g) => g.id === prev.id)) {
              return validList.find((g) => g.id === prev.id);
            }
            return validList[0];
          });
        } else {
          setActiveGroup(null);
        }
      } else if (!silent) {
        setGroups([]);
        setActiveGroup(null);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (!silent) {
        setGroups([]);
        setActiveGroup(null);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let intervalId = null;

    fetchGroups(false, controller.signal);

    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchGroups(true, controller.signal);
        }
      }, 4000);
    };
    const stopPolling = () => {
      clearInterval(intervalId);
      intervalId = null;
    };

    startPolling();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchGroups(true, controller.signal);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      controller.abort();
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchGroups]);

  const [messagesRefreshKey, setMessagesRefreshKey] = useState(0);

  const updateMeetingStatusLocally = useCallback((meetingCode, newStatus = 'ended') => {
    if (!meetingCode) return;
    setMessages((prev) =>
      prev.map((m) => {
        if (typeof m.text === 'string' && m.text.startsWith('[MEETING]:')) {
          const parts = m.text.split(':');
          if (parts[2] === meetingCode) {
            parts[5] = newStatus;
            return { ...m, text: parts.join(':') };
          }
        }
        return m;
      })
    );
  }, []);

  useEffect(() => {
    if (!activeGroup?.id) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    let highestId = 0;
    const controller = new AbortController();

    const fetchMessages = async (isInitial = false) => {
      try {
        const url = isInitial
          ? `/api/social/groups/${activeGroup.id}/messages/`
          : `/api/social/groups/${activeGroup.id}/messages/?since_id=${highestId}`;
        const res = await API.get(url, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.results || []);
          if (list.length > 0) {
            const formatted = list.map((m) => ({
              id: m.id,
              sender: m.sender || 'Scholar',
              senderId: m.sender_id,
              avatar: m.sender_avatar,
              text: m.content,
              media: m.media,
              time: m.created_at
                ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }));

            for (const item of list) {
              highestId = Math.max(highestId, item.id);
            }

            if (isMounted) {
              setMessages((prev) => {
                if (isInitial) return formatted;
                const existingIds = new Set(prev.map((p) => p.id));
                const newItems = formatted.filter((f) => !existingIds.has(f.id));
                return newItems.length > 0 ? [...prev, ...newItems] : prev;
              });
            }
          } else if (isInitial && isMounted) {
            setMessages([]);
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    };

    fetchMessages(true);

    let pollInterval = null;
    let pollCount = 0;
    const startPolling = () => {
      if (pollInterval) return;
      pollInterval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          pollCount++;
          // Every 4 polls (~8s), run a full sync so meeting status changes from other users are picked up in real-time
          if (pollCount % 4 === 0) {
            fetchMessages(true);
          } else {
            fetchMessages(false);
          }
        }
      }, 2000);
    };
    const stopPolling = () => {
      clearInterval(pollInterval);
      pollInterval = null;
    };
    startPolling();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchMessages(false);
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isMounted = false;
      controller.abort();
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [activeGroup?.id, messagesRefreshKey]);

  const fetchGroupMembers = async () => {
    if (!activeGroup?.id) return;
    const res = await API.get(`/api/social/groups/${activeGroup.id}/members/`);
    if (res.ok) setMembers(await res.json());
  };

  const fetchJoinRequests = async () => {
    if (!activeGroup?.id) return;
    const res = await API.get(`/api/social/groups/${activeGroup.id}/join_requests/`);
    if (res.ok) setJoinRequests(await res.json());
  };

  const handleJoinGroup = async () => {
    if (!activeGroup?.id) return;
    const res = await API.post(`/api/social/groups/${activeGroup.id}/join/`, {});
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      setActiveGroup((prev) => ({ ...prev, is_member: data.status === 'approved' || !prev.is_private, request_status: data.status || null }));
      fetchGroups(true);
    }
  };

  const handleRequestDecision = async (requestId, decision) => {
    if (!activeGroup?.id) return;
    const res = await API.post(`/api/social/groups/${activeGroup.id}/join-requests/${requestId}/${decision}/`, {});
    if (res.ok) {
      setJoinRequests((prev) => prev.filter((item) => item.id !== requestId));
      fetchGroups(true);
      fetchGroupMembers();
    }
  };

  const [showStartInstantModal, setShowStartInstantModal] = useState(false);
  const [customMeetingTitle, setCustomMeetingTitle] = useState('');

  const openStartInstantModal = () => {
    setCustomMeetingTitle(`${activeGroup?.name || 'Academic'} Seminar`);
    setShowStartInstantModal(true);
  };

  const handleStartInstantMeeting = async (customTitle) => {
    if (!activeGroup) return;
    const finalTitle = (customTitle || customMeetingTitle || `${activeGroup.name} Seminar`).trim();
    setShowStartInstantModal(false);
    try {
      const res = await API.post(`/api/social/groups/${activeGroup.id}/meetings/`, {
        is_instant: true,
        title: finalTitle,
      });
      if (res.ok) {
        const data = await res.json();
        setActiveMeeting(data);
        setShowCallModal(true);
        fetchGroups(true);
        setMessagesRefreshKey((k) => k + 1);
      } else {
        setShowCallModal(true);
      }
    } catch (e) {
      console.warn('Error starting meeting:', e);
      setShowCallModal(true);
    }
  };

  const handleJoinMeeting = (mtg) => {
    setActiveMeeting(mtg);
    setShowCallModal(true);
  };

  const [isEndingMeeting, setIsEndingMeeting] = useState(false);

  // Deduplicate meeting cards so only the latest state is displayed per meeting code
  const displayedMessages = useMemo(() => {
    const latestMeetingIndex = new Map();
    messages.forEach((m, idx) => {
      if (typeof m.text === 'string' && m.text.startsWith('[MEETING]:')) {
        const parts = m.text.split(':');
        const code = parts[2];
        if (code) {
          latestMeetingIndex.set(code, idx);
        }
      }
    });

    return messages.filter((m, idx) => {
      if (typeof m.text === 'string' && m.text.startsWith('[MEETING]:')) {
        const parts = m.text.split(':');
        const code = parts[2];
        if (code && latestMeetingIndex.get(code) !== idx) {
          return false;
        }
      }
      return true;
    });
  }, [messages]);

  const handleEndMeetingDirect = (mtg) => {
    if (!mtg) return;
    setConfirmEndMeeting(mtg);
  };

  const executeEndMeeting = async () => {
    if (!confirmEndMeeting || isEndingMeeting) return;
    setIsEndingMeeting(true);
    const mtg = confirmEndMeeting;
    const code = mtg.meeting_code;
    if (code) {
      updateMeetingStatusLocally(code, 'ended');
    }
    try {
      if (mtg.id) {
        await API.post(`/api/social/calls/${mtg.id}/end/`);
      } else if (activeGroup?.id) {
        await API.post(`/api/social/groups/${activeGroup.id}/end_call/`);
      }
      setActiveMeeting(null);
      setConfirmEndMeeting(null);
      if (activeGroup) {
        setActiveGroup((prev) => prev ? { ...prev, active_meeting: null } : null);
      }
      setMessagesRefreshKey((k) => k + 1);
      fetchGroups(true);
    } catch (err) {
      console.error('Error ending meeting:', err);
      setConfirmEndMeeting(null);
    } finally {
      setIsEndingMeeting(false);
    }
  };



  const copyMeetingLink = (code) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origin}/meet/${code}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedToast('Meeting link copied to clipboard!');
      setTimeout(() => setCopiedToast(''), 2500);
    });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const text = chatInput.trim();
    if ((!text && !chatAttachment) || !activeGroup?.id) return;
    setChatInput('');

    const tempId = Date.now();
    const optimisticMsg = {
      id: tempId,
      sender: user?.username || 'You',
      text,
      media: chatAttachment ? URL.createObjectURL(chatAttachment) : null,
      senderId: user?.id,
      avatar: user?.avatar,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sending', // 'sending' | 'sent' | 'failed'
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    const attachment = chatAttachment;
    setChatAttachment(null);
    await sendMessage(tempId, text, attachment);
  };

  const sendMessage = async (tempId, text, attachment = null) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === tempId ? { ...m, status: 'sending' } : m))
    );
    try {
      const body = new FormData();
      if (text) body.append('content', text);
      if (attachment) body.append('media', attachment);
      const res = await API.post(`/api/social/groups/${activeGroup.id}/messages/`, body);
      if (res.ok) {
        const saved = await res.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                id: saved.id,
                sender: saved.sender || user?.username || 'You',
                senderId: saved.sender_id,
                avatar: saved.sender_avatar,
                text: saved.content,
                media: saved.media,
                time: new Date(saved.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                status: 'sent',
              }
              : m
          )
        );

        if (!activeGroup.is_member) {
          setActiveGroup((prev) => (prev ? { ...prev, is_member: true, member_count: (prev.member_count || 1) + 1 } : prev));
          setGroups((prev) =>
            prev.map((g) => (g.id === activeGroup.id ? { ...g, is_member: true, member_count: (g.member_count || 1) + 1 } : g))
          );
        }
        fetchGroups(true);
      } else {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m)));
      }
    } catch (err) {
      console.error('Failed to post message:', err);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m)));
    }
  };

  const handleRetryMessage = (msg) => {
    sendMessage(msg.id, msg.text, null);
  };

  const handleDismissFailed = (msgId) => {
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    setCreatingRoom(true);

    try {
      const res = await API.post('/api/social/groups/', {
        name: newRoomName.trim(),
        description: newRoomTopic.trim(),
        group_type: newRoomType,
        is_private: newRoomPrivate,
      });
      if (res.ok) {
        const newGroup = await res.json();
        setGroups((prev) => [newGroup, ...prev]);
        setActiveGroup(newGroup);
        setShowCreateModal(false);
        setNewRoomName('');
        setNewRoomTopic('');
        setNewRoomPrivate(false);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || 'Could not create study room. Ensure you are signed in.');
      }
    } catch {
      alert('Network error while establishing study room.');
    } finally {
      setCreatingRoom(false);
    }
  };

  const filteredGroups = groups.filter((g) => {
    if (!roomFilter.trim()) return true;
    const q = roomFilter.toLowerCase();
    return g.name?.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q);
  });

  return (
    <div className="groups-shell" style={{ width: '100%' }}>
      {/* Header Banner - Desktop Only */}
      <div
        className="card groups-banner-card desktop-only-banner"
        style={{
          padding: '24px 32px',
          marginBottom: '20px',
          backgroundColor: '#16161B',
        }}
      >
        <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="badge-academic" style={{ marginBottom: '8px' }}>Synchronous Research</div>
            <h1 style={{ fontSize: '24px', margin: '0 0 6px', fontWeight: 700 }}>Live Mathematical Study Rooms & Whiteboards</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '640px', margin: 0 }}>
              Collaborate in peer-led mathematical study groups, conduct real-time LaTeX whiteboard derivations, and participate in departmental seminar calls.
            </p>
          </div>

          <div className="mobile-stack" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <button
              id="create-room-btn"
              onClick={() => setShowCreateModal(true)}
              className="btn-primary"
              style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
              Create Study Room
            </button>
            <div style={{ width: '1px', height: '32px', backgroundColor: 'var(--border)' }} />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}>{groups.length} Active</div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)' }}>Study Rooms</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dual-Pane / Off-Canvas Mobile Drawer Layout */}
      <div className="groups-layout">
        {/* Backdrop for mobile rooms drawer */}
        {sidebarOpen && (
          <div
            className="groups-sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Left Column: Active Rooms Directory (Off-Canvas Drawer on Mobile) */}
        <aside
          className={`groups-sidebar-col card ${sidebarOpen ? 'open' : ''}`}
          style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#18181D', minHeight: 0 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Active Study Rooms</h2>
              <span style={{ fontSize: '11.5px', color: 'var(--text-subtle)' }}>{filteredGroups.length} rooms available</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => { setShowCreateModal(true); setSidebarOpen(false); }}
                className="btn-primary"
                style={{ padding: '5px 10px', fontSize: '12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>add</span>
                New
              </button>
              <button
                type="button"
                className="groups-sidebar-close"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close rooms list"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="glass-input"
              placeholder="Filter rooms by topic..."
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              style={{ padding: '8px 12px', fontSize: '13px', width: '100%' }}
            />
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {loading ? (
              <div style={{ padding: '36px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <span className="material-symbols-outlined spin" style={{ fontSize: '28px', color: 'var(--primary)', marginBottom: '8px' }}>progress_activity</span>
                <p style={{ fontSize: '13px' }}>Loading active rooms...</p>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div style={{ padding: '36px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--primary)', opacity: 0.8, marginBottom: '8px' }}>meeting_room</span>
                <p style={{ fontSize: '13.5px', color: 'var(--text)', fontWeight: 500, margin: '4px 0' }}>No study rooms found</p>
                <p style={{ fontSize: '12px', color: 'var(--text-subtle)', margin: '0 0 16px' }}>Establish the first room to collaborate live.</p>
                <button onClick={() => { setShowCreateModal(true); setSidebarOpen(false); }} className="btn-primary" style={{ padding: '8px 14px', fontSize: '12.5px', width: '100%' }}>
                  Create Study Room
                </button>
              </div>
            ) : (
              filteredGroups.map((g) => {
                const isSelected = activeGroup?.id === g.id;
                return (
                  <div
                    key={g.id}
                    onClick={() => {
                      setActiveGroup(g);
                      setSidebarOpen(false);
                    }}
                    style={{
                      padding: '14px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      border: isSelected ? '1px solid var(--primary-border)' : '1px solid var(--border)',
                      backgroundColor: isSelected ? 'var(--primary-subtle)' : '#141418',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: isSelected ? 'var(--primary)' : 'var(--text)', lineHeight: 1.3 }}>
                        {g.name}
                      </div>
                      <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', backgroundColor: 'rgba(229, 169, 60, 0.12)', border: '1px solid var(--primary-border)', color: 'var(--primary)', fontWeight: 600, textTransform: 'capitalize', flexShrink: 0, marginLeft: '6px' }}>
                        {g.group_type || 'Study'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: 1.35 }}>
                      <MathRenderer content={g.description || 'General mathematical collaboration & problem solving'} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: 'var(--text-subtle)' }}>
                      <span>Host: {g.created_by || 'Scholar'}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {g.active_meeting && (
                          <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.35)', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
                            Live
                          </span>
                        )}
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>group</span>
                          {g.member_count || 1} member{g.member_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Column: Selected Group Live Discussion & Collaboration */}
        <div
          className="groups-chat-col card"
          style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', backgroundColor: '#18181D', minHeight: 0 }}
        >
          {activeGroup ? (
            <>
              <div style={{ paddingBottom: '14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                  <button
                    type="button"
                    className="groups-sidebar-toggle"
                    onClick={() => setSidebarOpen((prev) => !prev)}
                    title="View all study rooms"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>meeting_room</span>
                    <span>Rooms</span>
                    {groups.length > 0 && (
                      <span className="groups-room-count-pill">
                        {groups.length}
                      </span>
                    )}
                  </button>
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
                      <h2 style={{ fontSize: '16px', margin: 0, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeGroup.name}</h2>
                      <span className="badge-academic desktop-only-text" style={{ fontSize: '10.5px', padding: '1px 7px', textTransform: 'capitalize' }}>
                        {activeGroup.group_type || 'Study Room'}
                      </span>
                      <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border)', color: 'var(--text-subtle)', display: 'inline-flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>group</span>
                        {activeGroup.member_count || 1}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <MathRenderer content={activeGroup.description || 'Active live collaboration thread.'} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                    <span className="group-privacy-badge">
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{activeGroup.is_private ? 'lock' : 'public'}</span>
                      {activeGroup.is_private ? 'Private group' : 'Public group'}
                    </span>
                    {!activeGroup.is_member && activeGroup.created_by_id !== API.getCurrentUserId() && (
                      <button type="button" className="btn-primary" onClick={handleJoinGroup} style={{ padding: '5px 10px', fontSize: '11.5px' }}>
                        {activeGroup.request_status === 'pending' ? 'Request pending' : activeGroup.is_private ? 'Request to join' : 'Join group'}
                      </button>
                    )}
                    <button type="button" className="btn-secondary" onClick={() => { setShowMembers(true); fetchGroupMembers(); }} style={{ padding: '5px 10px', fontSize: '11.5px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>group</span> Members
                    </button>
                    {activeGroup.created_by_id === API.getCurrentUserId() && activeGroup.is_private && (
                      <button type="button" className="btn-secondary" onClick={() => { setShowRequests(true); fetchJoinRequests(); }} style={{ padding: '5px 10px', fontSize: '11.5px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>person_add</span> Requests
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <button
                    className="btn-secondary"
                    style={{ padding: '7px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => setShowWhiteboardModal(true)}
                    title="Open Live Whiteboard"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>draw</span>
                    <span className="desktop-only-text">Whiteboard</span>
                  </button>

                  <div style={{ position: 'relative' }}>
                    <div style={{ display: 'inline-flex', borderRadius: '6px', overflow: 'hidden' }}>
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ padding: '7px 11px', fontSize: '12.5px', borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                        onClick={openStartInstantModal}
                        title="Start Instant Seminar Meeting"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>videocam</span>
                        <span className="desktop-only-text" style={{ marginLeft: '4px' }}>Start Meeting</span>
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ padding: '7px 8px', fontSize: '12.5px', borderLeft: '1px solid rgba(0, 0, 0, 0.2)', borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                        onClick={() => setMeetingDropdownOpen((prev) => !prev)}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_drop_down</span>
                      </button>
                    </div>

                    {meetingDropdownOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: 'calc(100% + 6px)',
                          backgroundColor: '#1E1E26',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          boxShadow: '0 12px 28px rgba(0, 0, 0, 0.6)',
                          zIndex: 60,
                          minWidth: '190px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          onClick={() => {
                            setMeetingDropdownOpen(false);
                            openStartInstantModal();
                          }}
                          style={{
                            padding: '10px 14px',
                            fontSize: '12.5px',
                            color: 'var(--text)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            borderBottom: '1px solid var(--border)',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(229, 169, 60, 0.1)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '17px', color: 'var(--primary)' }}>videocam</span>
                          <span>Start Instant Meeting</span>
                        </div>
                        <div
                          onClick={() => {
                            setMeetingDropdownOpen(false);
                            setShowScheduleModal(true);
                          }}
                          style={{
                            padding: '10px 14px',
                            fontSize: '12.5px',
                            color: 'var(--text)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(229, 169, 60, 0.1)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '17px', color: 'var(--primary)' }}>calendar_month</span>
                          <span>Schedule Seminar</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {((activeGroup && activeGroup.active_meeting) || activeMeeting) && (() => {
                const currentMeeting = activeGroup?.active_meeting || activeMeeting;
                const isHost =
                  currentMeeting.initiator === user?.username ||
                  currentMeeting.initiator_username === user?.username ||
                  activeGroup?.created_by === user?.id ||
                  activeGroup?.created_by?.id === user?.id;

                return (
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '14px',
                      marginBottom: '6px',
                      gap: '12px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                           Live Seminar: {currentMeeting.title}
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          Hosted by @{currentMeeting.initiator || currentMeeting.initiator_username || 'Host'} • {currentMeeting.participants_count || 1} connected
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleJoinMeeting(currentMeeting)}
                        className="btn-primary"
                        style={{ padding: '6px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>login</span>
                        Join Meeting
                      </button>
                      <button
                        type="button"
                        onClick={() => copyMeetingLink(currentMeeting.meeting_code)}
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: '#27272A', color: 'var(--text)', border: '1px solid var(--border)' }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>content_copy</span>
                        Copy Link
                      </button>
                      {isHost && (
                        <button
                          type="button"
                          onClick={() => handleEndMeetingDirect(currentMeeting)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            backgroundColor: 'rgba(239, 68, 68, 0.2)',
                            color: '#F87171',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                          title="End meeting for all scholars"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>call_end</span>
                          End Meeting
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {displayedMessages.length === 0 ? (
                  <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', padding: '32px 16px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--primary)', opacity: 0.8, marginBottom: '8px' }}>forum</span>
                    <p style={{ fontSize: '14px', color: 'var(--text)', fontWeight: 500, margin: '4px 0' }}>
                      No messages yet in #{activeGroup.name}
                    </p>
                    <p style={{ fontSize: '12.5px', color: 'var(--text-subtle)' }}>
                      Start the seminar discussion by sharing a lemma, question, or proof step below.
                    </p>
                  </div>
                ) : (
                  displayedMessages.map((m) => {
                    const isMeetingCard = typeof m.text === 'string' && m.text.startsWith('[MEETING]:');
                    if (isMeetingCard) {
                      const parts = m.text.split(':');
                      const mtgId = parts[1];
                      const mtgCode = parts[2];
                      const mtgTitle = parts[3] || 'Academic Seminar';
                      const mtgHost = parts[4] || m.sender;
                      const mtgStatus = parts[5] || 'active';
                      const mtgSched = parts.slice(6).join(':');

                      return (
                        <div
                          key={m.id}
                          style={{
                            padding: '16px',
                            borderRadius: '12px',
                            backgroundColor: '#1B1B22',
                            border: mtgStatus === 'active' ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                            boxShadow: mtgStatus === 'active' ? '0 4px 20px rgba(229, 169, 60, 0.12)' : 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div
                                style={{
                                  width: '36px',
                                  height: '36px',
                                  borderRadius: '8px',
                                  backgroundColor: mtgStatus === 'active' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(229, 169, 60, 0.15)',
                                  color: mtgStatus === 'active' ? '#22C55E' : 'var(--primary)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                                  {mtgStatus === 'active' ? 'videocam' : mtgStatus === 'scheduled' ? 'calendar_month' : 'videocam_off'}
                                </span>
                              </div>
                              <div>
                                <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: 'var(--text)' }}>
                                  {mtgTitle}
                                </h4>
                                <span style={{ fontSize: '11.5px', color: 'var(--text-subtle)' }}>
                                  Host: @{mtgHost} • Code: <strong style={{ color: 'var(--primary)' }}>{mtgCode}</strong>
                                </span>
                              </div>
                            </div>

                            <span
                              style={{
                                fontSize: '11px',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontWeight: 600,
                                backgroundColor: mtgStatus === 'active' ? 'rgba(239, 68, 68, 0.15)' : mtgStatus === 'scheduled' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                color: mtgStatus === 'active' ? '#EF4444' : mtgStatus === 'scheduled' ? '#60A5FA' : 'var(--text-subtle)',
                                border: mtgStatus === 'active' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border)',
                              }}
                            >
                              {mtgStatus === 'active' ? 'LIVE NOW' : mtgStatus === 'scheduled' ? 'SCHEDULED' : 'ENDED'}
                            </span>
                          </div>

                          {mtgSched && (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--primary)' }}>schedule</span>
                              <span>Scheduled: {new Date(mtgSched).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                            {mtgStatus !== 'ended' && (
                              <button
                                type="button"
                                onClick={() => handleJoinMeeting({ id: mtgId, meeting_code: mtgCode, title: mtgTitle, initiator_username: mtgHost })}
                                className="btn-primary"
                                style={{ padding: '6px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>login</span>
                                <span>{mtgStatus === 'active' ? 'Join Meeting' : 'Open Green Room'}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => copyMeetingLink(mtgCode)}
                              className="btn-secondary"
                              style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#27272A', color: 'var(--text)', border: '1px solid var(--border)' }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>content_copy</span>
                              <span>Copy Link</span>
                            </button>
                            {mtgStatus === 'active' && (mtgHost === user?.username || activeGroup?.created_by === user?.id) && (
                              <button
                                type="button"
                                onClick={() => handleEndMeetingDirect({ id: mtgId, title: mtgTitle })}
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  backgroundColor: 'rgba(239, 68, 68, 0.18)',
                                  color: '#F87171',
                                  border: '1px solid rgba(239, 68, 68, 0.35)',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                }}
                                title="End meeting for all participants"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>call_end</span>
                                <span>End</span>
                              </button>
                            )}
                          </div>

                        </div>
                      );
                    }

                    return (
                      <div
                        key={m.id}
                        className={`group-message ${m.senderId && Number(m.senderId) === Number(API.getCurrentUserId() || user?.id) ? 'is-own' : ''}`}
                        style={{
                          padding: '10px 14px',
                          backgroundColor: m.status === 'failed' ? 'rgba(220, 60, 60, 0.08)' : undefined,
                          border: m.status === 'failed' ? '1px solid rgba(220, 60, 60, 0.4)' : undefined,
                          borderRadius: '8px',
                          fontSize: '13.5px',
                          opacity: m.status === 'sending' ? 0.6 : 1,
                        }}
                      >
                        <div className="group-message-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                          <span className="group-message-sender" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'var(--primary)', fontSize: '12.5px' }}>
                            <span className="group-avatar">
                              {m.avatar ? <img src={m.avatar} alt="" /> : (m.sender?.[0]?.toUpperCase() || 'S')}
                            </span>
                            {m.sender}
                          </span>
                          <span style={{ color: 'var(--text-subtle)', fontSize: '11px' }}>{m.time}</span>
                        </div>
                        <div style={{ color: 'var(--text)', marginTop: '2px' }}>
                          <MathRenderer content={m.text} />
                        </div>
                        {m.status === 'sending' && (
                          <div style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '4px' }}>Sending...</div>
                        )}
                        {m.status === 'failed' && (
                          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                            <span style={{ fontSize: '11px', color: '#e05c5c' }}>Failed to send</span>
                            <button
                              type="button"
                              onClick={() => handleRetryMessage(m)}
                              style={{ fontSize: '11px', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                            >
                              Retry
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDismissFailed(m.id)}
                              style={{ fontSize: '11px', color: 'var(--text-subtle)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={chatScrollRef} />
              </div>

              <div style={{ paddingTop: '14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', overflowX: 'auto', scrollbarWidth: 'none' }}>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-subtle)', alignSelf: 'center', marginRight: '4px' }}>LaTeX:</span>
                  {quickSymbols.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => setChatInput((prev) => (prev ? `${prev} $${s.code}$ ` : `$${s.code}$ `))}
                      className="symbol-chip"
                      style={{ fontSize: '12px', padding: '2px 8px' }}
                      title={s.code}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSendMessage} className="group-chat-form" style={{ display: 'flex', gap: '10px' }}>
                  <label className="group-attach-button" title="Attach a file">
                    <span className="material-symbols-outlined">add</span>
                    <input type="file" onChange={(e) => setChatAttachment(e.target.files?.[0] || null)} hidden />
                  </label>
                  <input
                    type="text"
                    className="glass-input"
                    placeholder={`Message #${activeGroup.name} (use $...$ for LaTeX)...`}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    style={{ fontSize: '13.5px', flex: 1 }}
                  />
                  <button type="submit" className="btn-primary group-send-button" aria-label="Send message" title="Send message">
                    <span className="material-symbols-outlined">arrow_upward</span>
                  </button>
                </form>
                {chatAttachment && <div className="group-selected-file"><span className="material-symbols-outlined">attach_file</span>{chatAttachment.name}<button type="button" onClick={() => setChatAttachment(null)}>close</button></div>}
              </div>}
            </>
          ) : (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', padding: '40px 20px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--primary)', opacity: 0.8, marginBottom: '12px' }}>groups</span>
              <h3 style={{ fontSize: '16px', color: 'var(--text)', margin: '0 0 6px' }}>No study room selected</h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', maxWidth: '360px', margin: '0 auto 18px' }}>
                Select an existing study room on the left, or establish a new mathematical seminar room.
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="btn-secondary"
                  style={{ padding: '9px 18px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>meeting_room</span>
                  Browse Rooms ({groups.length})
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary"
                  style={{ padding: '9px 18px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>add</span>
                  Create Study Room
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(10, 10, 14, 0.82)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: '500px', maxHeight: 'min(90vh, 90dvh)', overflowY: 'auto', padding: '24px 20px', backgroundColor: '#16161B', border: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--text)' }}>Establish Study Room</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Create an open mathematical seminar room for live discussion and whiteboarding.
                </p>
              </div>

              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateGroup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>Room Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Differential Forms & Cohomology Working Group"
                  className="glass-input"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', fontSize: '13.5px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>Focus / Description</label>
                <textarea
                  rows={3}
                  placeholder="e.g., Stokes theorem derivations, de Rham complexes, and problem sessions..."
                  className="glass-input"
                  value={newRoomTopic}
                  onChange={(e) => setNewRoomTopic(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', fontSize: '13.5px', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>Seminar Type</label>
                <select
                  className="glass-input"
                  value={newRoomType}
                  onChange={(e) => setNewRoomType(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', fontSize: '13.5px', backgroundColor: '#1A1A22' }}
                >
                  <option value="study">Study Group</option>
                  <option value="department">Department Seminar</option>
                  <option value="competition">Competition / Olympiad Working Group</option>
                </select>
              </div>

              <label className="group-privacy-option">
                <input type="checkbox" checked={newRoomPrivate} onChange={(e) => setNewRoomPrivate(e.target.checked)} />
                <span><strong>Private group</strong><small>People can see the preview, but must request approval before joining the chat.</small></span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary" style={{ padding: '9px 18px', fontSize: '13.5px' }}>
                  Cancel
                </button>
                <button type="submit" disabled={creatingRoom || !newRoomName.trim()} className="btn-primary" style={{ padding: '9px 20px', fontSize: '13.5px' }}>
                  {creatingRoom ? 'Establishing...' : 'Establish Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMembers && activeGroup && (
        <div className="group-panel-overlay" onClick={() => setShowMembers(false)}>
          <div className="group-panel card" onClick={(e) => e.stopPropagation()}>
            <div className="group-panel-heading"><h3>Group members</h3><button onClick={() => setShowMembers(false)} aria-label="Close members"><span className="material-symbols-outlined">close</span></button></div>
            {members.map((member) => <div className="group-member-row" key={member.id}><span className="group-avatar">{member.avatar ? <img src={member.avatar} alt="" /> : member.username?.[0]?.toUpperCase()}</span><span>{member.username || member.user}</span>{member.user_id === activeGroup.created_by_id && <span className="badge-academic">Creator</span>}</div>)}
          </div>
        </div>
      )}

      {showRequests && activeGroup && (
        <div className="group-panel-overlay" onClick={() => setShowRequests(false)}>
          <div className="group-panel card" onClick={(e) => e.stopPropagation()}><div className="group-panel-heading"><h3>Join requests</h3><button onClick={() => setShowRequests(false)} aria-label="Close requests"><span className="material-symbols-outlined">close</span></button></div>{joinRequests.length === 0 ? <p className="group-panel-empty">No pending requests.</p> : joinRequests.map((item) => <div className="group-member-row" key={item.id}><span className="group-avatar">{item.avatar ? <img src={item.avatar} alt="" /> : item.username?.[0]?.toUpperCase()}</span><span>{item.username}</span><button className="btn-primary" onClick={() => handleRequestDecision(item.id, 'approve')}>Approve</button><button className="btn-secondary" onClick={() => handleRequestDecision(item.id, 'decline')}>Decline</button></div>)}</div>
        </div>
      )}

      {showScheduleModal && activeGroup && (
        <ScheduleMeetingModal
          group={activeGroup}
          onClose={() => setShowScheduleModal(false)}
          onScheduled={() => {
            fetchGroups(true);
          }}
        />
      )}

      {showCallModal && activeGroup && (
        <SeminarCallModal
          group={activeGroup}
          meeting={activeMeeting}
          initialPreJoin={true}
          onMeetingEnded={(code) => {
            if (code) updateMeetingStatusLocally(code, 'ended');
            if (activeMeeting?.meeting_code) updateMeetingStatusLocally(activeMeeting.meeting_code, 'ended');
            setActiveMeeting(null);
            setActiveGroup((prev) => (prev ? { ...prev, active_meeting: null } : null));
            setMessagesRefreshKey((k) => k + 1);
            fetchGroups(true);
          }}
          onClose={() => {
            setShowCallModal(false);
            setActiveMeeting(null);
            setMessagesRefreshKey((k) => k + 1);
            fetchGroups(true);
          }}
        />
      )}

      {/* Start Live Seminar Custom Topic Modal */}
      {showStartInstantModal && activeGroup && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(10, 10, 14, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setShowStartInstantModal(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: '480px',
              width: '100%',
              backgroundColor: '#16161B',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '28px',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.9)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--primary-subtle)',
                    border: '1px solid var(--primary-border)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>videocam</span>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>
                    Start Live Seminar
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    #{activeGroup.name}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowStartInstantModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', padding: '4px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleStartInstantMeeting();
              }}
            >
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Seminar Topic / Title
                </label>
                <input
                  type="text"
                  value={customMeetingTitle}
                  onChange={(e) => setCustomMeetingTitle(e.target.value)}
                  placeholder="e.g. Real Analysis Problem Solving, Topology Q&A"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    fontSize: '14px',
                    backgroundColor: '#1E1E26',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--text)',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Quick Topic Chips */}
              <div style={{ marginBottom: '22px' }}>
                <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)', marginBottom: '8px' }}>
                  Quick topics:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {[
                    'Theorem Derivations',
                    'Problem Set Solving',
                    'Paper & Proof Review',
                    'Open Q&A Discussion',
                  ].map((topic) => (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => setCustomMeetingTitle(`${activeGroup.name}: ${topic}`)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11.5px',
                        backgroundColor: '#1F1F28',
                        color: 'var(--text-muted)',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--primary)';
                        e.currentTarget.style.borderColor = 'var(--primary-border)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-muted)';
                        e.currentTarget.style.borderColor = 'var(--border)';
                      }}
                    >
                      + {topic}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowStartInstantModal(false)}
                  className="btn-secondary"
                  style={{ padding: '10px 18px', fontSize: '13.5px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!customMeetingTitle.trim()}
                  className="btn-primary"
                  style={{ padding: '10px 20px', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>videocam</span>
                  <span>Launch Seminar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showWhiteboardModal && activeGroup && (
        <WhiteboardModal group={activeGroup} onClose={() => setShowWhiteboardModal(false)} />
      )}

      {copiedToast && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: 'rgba(34, 197, 94, 0.95)',
            color: '#FFFFFF',
            padding: '10px 18px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            zIndex: 9999,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
          <span>{copiedToast}</span>
        </div>
      )}

      {/* Modern Confirmation Popup for Ending Seminar */}
      {confirmEndMeeting && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(10, 10, 14, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setConfirmEndMeeting(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: '440px',
              width: '100%',
              backgroundColor: '#1A1A22',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.9)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
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
                  End Seminar for Everyone?
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  This will immediately terminate the call and disconnect all active scholars.
                </p>
              </div>
            </div>

            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border)',
                fontSize: '13px',
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--primary)' }}>
                meeting_room
              </span>
              <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {confirmEndMeeting.title || 'Seminar'}
              </strong>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setConfirmEndMeeting(null)}
                style={{
                  flex: 1,
                  padding: '11px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: '#27272A',
                  color: 'var(--text)',
                  fontWeight: 600,
                  fontSize: '13.5px',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isEndingMeeting}
                onClick={executeEndMeeting}
                style={{
                  flex: 1.2,
                  padding: '11px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#EF4444',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '13.5px',
                  cursor: isEndingMeeting ? 'not-allowed' : 'pointer',
                  opacity: isEndingMeeting ? 0.6 : 1,
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>call_end</span>
                <span>{isEndingMeeting ? 'Ending...' : 'End Meeting'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

  );
}

export default GroupsPage;
