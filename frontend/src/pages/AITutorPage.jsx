import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../api/client';
import MathRenderer from '../components/common/MathRenderer';

export function AITutorPage() {
  const { user, isAuthenticated } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const starterPrompts = [
    { title: "Euler's Identity", prompt: "Explain Euler's identity e^{iπ} + 1 = 0 and its geometric meaning on the unit circle." },
    { title: "Cauchy-Schwarz Inequality", prompt: "How does the Cauchy-Schwarz inequality apply to inner product spaces and L² functions?" },
    { title: "Fourier Transform Derivation", prompt: "Derive the continuous Fourier Transform from the Fourier Series step-by-step with LaTeX." },
    { title: "Irrationality of √2", prompt: "Provide a rigorous step-by-step proof by contradiction that the square root of 2 is irrational." },
    { title: "Stokes' Generalized Theorem", prompt: "Explain Stokes' theorem on differential forms and how it generalizes Green and Gauss theorems." },
    { title: "Sylow Theorems", prompt: "State and explain the intuition behind Sylow's first theorem in group theory with an example." },
  ];

  const quickSymbols = ['\\forall', '\\exists', '\\in', '\\implies', '\\sum', '\\int', '\\mathbb{R}', '\\mathbb{C}'];

  const fetchSessions = async () => {
    try {
      const res = await API.get('/api/ai-tutor/sessions/');
      if (res.ok) {
        const data = await res.json();
        const list = data.results || data;
        setSessions(Array.isArray(list) ? list : []);
        if (list.length > 0 && !activeSessionId) {
          selectSession(list[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  };

  const selectSession = async (sessionId) => {
    setActiveSessionId(sessionId);
    setSidebarOpen(false);
    try {
      const res = await API.get(`/api/ai-tutor/sessions/${sessionId}/`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Failed to fetch session messages:', err);
    }
  };

  const createNewSession = async () => {
    try {
      const res = await API.post('/api/ai-tutor/sessions/', {
        title: `Research Session ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      });
      if (res.ok) {
        const newSession = await res.json();
        setSessions((prev) => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
        setMessages([]);
        setSidebarOpen(false);
      }
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchSessions();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const ensureActiveSession = async (text) => {
    if (activeSessionId) return activeSessionId;
    const res = await API.post('/api/ai-tutor/sessions/', {
      title: text.slice(0, 35) || 'Research Session',
    });
    if (!res.ok) throw new Error('Could not start an AI Tutor session.');
    const session = await res.json();
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    return session.id;
  };

  const handleSendMessage = async (msgText = inputMessage) => {
    const text = typeof msgText === 'string' ? msgText.trim() : inputMessage.trim();
    if ((!text && !selectedFile) || sending) return;

    const file = selectedFile;
    const displayText = text || `Please analyze the attached file: ${file.name}`;
    let sessionId;
    try {
      sessionId = await ensureActiveSession(displayText);
    } catch (err) {
      setMessages((prev) => [...prev, { id: Date.now(), role: 'assistant', content: `⚠️ ${err.message}` }]);
      return;
    }

    setInputMessage('');
    setSelectedFile(null);
    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: displayText,
      file_name: file?.name,
      file_mime: file?.type,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    const assistantMsgId = Date.now() + 1;
    // Append placeholder for streaming assistant reply
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      const payload = {
        content: displayText,
        ...(file ? {
          file_data: await fileToBase64(file),
          file_name: file.name,
          file_mime: file.type,
        } : {}),
      };
      const res = await API.req(`/api/ai-tutor/sessions/${sessionId}/send-stream/`, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Accept': 'text/event-stream',
        },
      });

      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop(); // Retain unfinished chunk

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              try {
                const payload = JSON.parse(trimmed.slice(6));
                if (payload.text) {
                  accumulatedText += payload.text;
                  const currentText = accumulatedText;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId
                        ? { ...m, content: currentText, isStreaming: true }
                        : m
                    )
                  );
                }
              } catch {
                // Ignore parse errors on partial frames
              }
            }
          }
        }

        // Finalize streaming state
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: accumulatedText || 'Mathematical derivation completed.', isStreaming: false }
              : m
          )
        );
      } else {
        const errorData = await res.json().catch(() => ({}));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: `⚠️ Error: ${errorData.error || errorData.detail || 'Could not reach AI Tutor. Please try again.'}`,
                  isStreaming: false,
                }
              : m
          )
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: '⚠️ Network connection failed. Please verify your connection.',
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="ai-tutor-shell" style={{ width: '100%', height: 'calc(100vh - var(--nav-height) - 76px)', minHeight: '560px' }}>
      <div
        className="ai-tutor-layout card"
        style={{
          display: 'flex',
          height: '100%',
          position: 'relative',
          borderRadius: '14px',
          overflow: 'hidden',
          backgroundColor: '#16161B',
        }}
      >
        {/* Sessions Sidebar */}
        <aside
          className="ai-tutor-sidebar"
          style={{
            width: '280px',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 50,
            backgroundColor: '#141418',
            transition: 'transform 0.25s ease',
            flexShrink: 0,
          }}
        >
          {/* Sidebar Top Header */}
          <div
            style={{
              padding: '16px 18px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                Research Sessions
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
                {sessions.length} recorded
              </span>
            </div>
            <button
              onClick={createNewSession}
              className="btn-primary"
              style={{ padding: '5px 11px', fontSize: '12px', borderRadius: '6px' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
              New
            </button>
          </div>

          {/* Sessions List or Sample Discussions */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {sessions.length === 0 ? (
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '12px', paddingLeft: '4px' }}>
                  Recommended Topics:
                </p>
                {starterPrompts.slice(0, 4).map((p) => (
                  <button
                    key={p.title}
                    onClick={() => handleSendMessage(p.prompt)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      fontSize: '12.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '6px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--primary)' }}>
                      school
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.title}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => selectSession(s.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: activeSessionId === s.id ? '1px solid var(--primary-border)' : '1px solid transparent',
                    backgroundColor: activeSessionId === s.id ? 'var(--primary-subtle)' : 'transparent',
                    color: activeSessionId === s.id ? 'var(--primary)' : 'var(--text)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: activeSessionId === s.id ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '4px',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>chat_bubble</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.title || `Session #${s.id}`}
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Main Chat Area */}
        <section className="ai-tutor-chat" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#18181D' }}>
          {/* Chat Header */}
          <header
            className="ai-tutor-chat-header"
            style={{
              padding: '12px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#16161B',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--primary-subtle)',
                  border: '1px solid var(--primary-border)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>smart_toy</span>
              </div>
              <div>
                <h2 style={{ fontSize: '14.5px', margin: 0, fontWeight: 700, color: 'var(--text)' }}>
                  Mathify AI Theorem Research Mentor
                </h2>
                <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary)' }} />
                  Gemini Flash Mathematical Reasoning Engine
                </div>
              </div>
            </div>

            <span className="badge-academic" style={{ fontSize: '11px', padding: '2px 8px' }}>
              LaTeX Enabled
            </span>
          </header>

          {/* Messages Stream */}
          <div className="ai-tutor-messages" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {messages.length === 0 ? (
              <div style={{ margin: 'auto', maxWidth: '640px', textAlign: 'center', width: '100%' }}>
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--primary-subtle)',
                    border: '1px solid var(--primary-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    color: 'var(--primary)',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>history_edu</span>
                </div>
                <h3 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px', color: 'var(--text)' }}>
                  How can I assist your mathematical research?
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '28px', lineHeight: 1.55 }}>
                  Ask for LaTeX derivations, topological decompositions, Olympiad step-by-step solutions, or lemma verifications.
                </p>

                {/* Responsive 2-column Starter Grid */}
                <div className="ai-tutor-prompts" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px', textAlign: 'left' }}>
                  {starterPrompts.map((p) => (
                    <button
                      key={p.title}
                      onClick={() => handleSendMessage(p.prompt)}
                      className="card"
                      style={{
                        padding: '14px 16px',
                        backgroundColor: '#141418',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '6px',
                        transition: 'border-color 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--primary)' }}>
                          {p.title}
                        </span>
                        <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--text-subtle)' }}>
                          arrow_forward
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        {p.prompt}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => {
                const isUser = m.role === 'user';
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      justifyContent: isUser ? 'flex-end' : 'flex-start',
                      width: '100%',
                    }}
                  >
                    <div
                      className="ai-tutor-message-bubble"
                      style={{
                        maxWidth: '82%',
                        padding: '14px 18px',
                        borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                        backgroundColor: isUser ? '#22222A' : '#141418',
                        border: isUser ? '1px solid var(--primary-border)' : '1px solid var(--border)',
                        color: 'var(--text)',
                        lineHeight: 1.55,
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 600, color: isUser ? 'var(--primary)' : 'var(--text-subtle)', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>{isUser ? (user?.username || 'You') : 'Mathify AI Mentor'}</span>
                        {m.isStreaming && (
                          <span style={{ fontSize: '10.5px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary)' }} />
                            Live derivation...
                          </span>
                        )}
                      </div>
                      {m.content ? (
                        <div style={{ position: 'relative' }}>
                                  {m.file_name && (
                                    <div className="ai-tutor-file-badge">
                                      <span className="material-symbols-outlined">attach_file</span>
                                      {m.file_name}
                                    </div>
                                  )}
                          <MathRenderer content={m.content} />
                          {m.isStreaming && (
                            <span
                              style={{
                                display: 'inline-block',
                                width: '7px',
                                height: '14px',
                                backgroundColor: 'var(--primary)',
                                marginLeft: '4px',
                                verticalAlign: 'middle',
                              }}
                            />
                          )}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontSize: '13px', padding: '4px 0' }}>
                          <span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite', fontSize: '16px' }}>
                            progress_activity
                          </span>
                          <span>Formulating mathematical proof...</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input & Toolbar */}
          <div className="ai-tutor-composer" style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', backgroundColor: '#16161B' }}>
            {/* Quick Math Symbols */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-subtle)', alignSelf: 'center', marginRight: '4px' }}>
                Insert Symbol:
              </span>
              {quickSymbols.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => setInputMessage((prev) => prev + ` $${sym}$ `)}
                  className="symbol-chip"
                  style={{ fontSize: '11.5px', padding: '2px 7px' }}
                >
                  ${sym}$
                </button>
              ))}
            </div>

            {selectedFile && (
              <div className="ai-tutor-selected-file">
                <span className="material-symbols-outlined">attach_file</span>
                <span title={selectedFile.name}>{selectedFile.name}</span>
                <button type="button" onClick={() => setSelectedFile(null)} aria-label="Remove attached file">×</button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="ai-tutor-input-row"
              style={{ display: 'flex', gap: '10px' }}
            >
              <input ref={fileInputRef} type="file" accept="image/*,video/*,application/pdf,text/plain" hidden onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
              <button
                type="button"
                className="ai-tutor-attach-button"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                aria-label="Attach an image, video, PDF, or text file"
                title="Attach file"
              >
                <span className="material-symbols-outlined">attach_file</span>
              </button>
              <input
                type="text"
                className="glass-input"
                placeholder="Ask a mathematical question or enter a LaTeX equation (e.g. $e^{i\pi} + 1 = 0$)..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={sending}
                style={{ fontSize: '14px', flex: 1, padding: '10px 14px' }}
              />
              <button
                type="submit"
                disabled={sending || (!inputMessage.trim() && !selectedFile)}
                className="btn-primary"
                style={{ padding: '10px 14px', fontSize: '13.5px' }}
                aria-label="Send message"
                title="Send message"
              >
                <span className="material-symbols-outlined">arrow_upward</span>
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

export default AITutorPage;
