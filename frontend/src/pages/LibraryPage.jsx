import React, { useState, useEffect } from 'react';
import { API } from '../api/client';

export function LibraryPage() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState('textbook');
  const [newUrl, setNewUrl] = useState('');
  const [newFile, setNewFile] = useState(null);
  const [publishing, setPublishing] = useState(false);

  const categories = [
    { id: 'all', label: 'All Disciplines' },
    { id: 'Real Analysis', label: 'Real Analysis' },
    { id: 'Complex Analysis', label: 'Complex Analysis' },
    { id: 'Differential Forms', label: 'Differential Forms' },
    { id: 'Linear Algebra', label: 'Linear Algebra' },
    { id: 'Topology', label: 'Topology' },
    { id: 'Abstract Algebra', label: 'Abstract Algebra' },
    { id: 'Number Theory', label: 'Number Theory' },
    { id: 'Foundations', label: 'Foundations' },
  ];

  const fetchResources = async () => {
    try {
      setLoading(true);
      const res = await API.get('/api/library/resources/');
      if (res.ok) {
        const data = await res.json();
        const list = data.results || data;
        setResources(Array.isArray(list) ? list : []);
      } else {
        setResources([]);
      }
    } catch (err) {
      console.error('Failed to load library resources:', err);
      setResources([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
  }, []);

  const handlePublishResource = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setPublishing(true);
    try {
      const formData = new FormData();
      formData.append('title', newTitle.trim());
      formData.append('description', newDesc.trim());
      formData.append('resource_type', newType);
      if (newUrl.trim()) formData.append('url', newUrl.trim());
      if (newFile) formData.append('file', newFile);
      const res = await API.post('/api/library/resources/', formData);
      if (res.ok) {
        const saved = await res.json();
        setResources((prev) => [saved, ...prev]);
        setShowPublishModal(false);
        setNewTitle('');
        setNewDesc('');
        setNewUrl('');
        setNewFile(null);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || 'Could not publish manuscript. Please ensure you are logged in.');
      }
    } catch {
      alert('Network error publishing resource.');
    } finally {
      setPublishing(false);
    }
  };

  const handleToggleBookmark = async (id) => {
    try {
      const res = await API.post(`/api/library/resources/${id}/bookmark/`, {});
      if (res.ok) {
        const data = await res.json();
        setResources((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  is_bookmarked: data.bookmarked,
                  bookmark_count: data.bookmarked
                    ? (r.bookmark_count || 0) + 1
                    : Math.max(0, (r.bookmark_count || 0) - 1),
                }
              : r
          )
        );
      }
    } catch (err) {
      console.error('Bookmark error:', err);
    }
  };

  const filtered = resources.filter((r) => {
    const rCategory = typeof r.category === 'object' ? r.category?.name : r.category;
    const matchesCategory =
      selectedCategory === 'all' ||
      (rCategory && rCategory.toLowerCase() === selectedCategory.toLowerCase());

    if (!searchTerm.trim()) return matchesCategory;
    const q = searchTerm.toLowerCase();
    return (
      matchesCategory &&
      (r.title?.toLowerCase().includes(q) ||
        r.uploaded_by?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ width: '100%' }}>
      {/* Header Banner */}
      <div
        className="card"
        style={{
          padding: '28px 32px',
          marginBottom: '24px',
          backgroundColor: '#16161B',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="badge-academic" style={{ marginBottom: '10px' }}>
              Mathematical Manuscript Archives
            </div>
            <h1 style={{ fontSize: '26px', margin: '0 0 8px', fontWeight: 700 }}>
              Academic Library & Research Preprints
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14.5px', maxWidth: '640px', margin: 0, lineHeight: 1.55 }}>
              Access community preprints, lecture monographs, problem sets, and formal mathematical papers in real time.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <button
              id="publish-manuscript-btn"
              onClick={() => setShowPublishModal(true)}
              className="btn-primary"
              style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
              Publish Manuscript
            </button>
            <div style={{ width: '1px', height: '32px', backgroundColor: 'var(--border)' }} />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--primary)' }}>
                {resources.length}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>Catalogued Works</div>
            </div>
          </div>
        </div>

        {/* Search Row */}
        <div style={{ marginTop: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
            <span
              className="material-symbols-outlined"
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-subtle)',
                fontSize: '20px',
              }}
            >
              search
            </span>
            <input
              type="text"
              className="glass-input"
              placeholder="Search by title, author, theorem or keyword..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                paddingLeft: '42px',
                paddingRight: '16px',
                paddingTop: '11px',
                paddingBottom: '11px',
                fontSize: '14px',
                width: '100%',
              }}
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div
          className="manuscript-grid"
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingTop: '16px',
            marginTop: '8px',
            borderTop: '1px solid var(--border)',
            scrollbarWidth: 'none',
          }}
        >
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  padding: '5px 13px',
                  borderRadius: '6px',
                  border: isActive ? '1px solid var(--primary-border)' : '1px solid var(--border)',
                  backgroundColor: isActive ? 'var(--primary-subtle)' : 'transparent',
                  color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Manuscripts Grid */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <span className="material-symbols-outlined spin" style={{ fontSize: '36px', color: 'var(--primary)', marginBottom: '12px' }}>
            progress_activity
          </span>
          <p style={{ fontSize: '14px' }}>Querying live repository...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '56px 24px', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: '#16161B' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--primary)', opacity: 0.8 }}>
            auto_stories
          </span>
          <h3 style={{ marginTop: '16px', fontSize: '18px', color: 'var(--text)', fontWeight: 600 }}>
            {searchTerm || selectedCategory !== 'all' ? 'No matching manuscripts found' : 'No manuscripts published yet'}
          </h3>
          <p style={{ fontSize: '13.5px', marginTop: '6px', maxWidth: '460px', margin: '6px auto 20px', color: 'var(--text-muted)' }}>
            {searchTerm || selectedCategory !== 'all'
              ? 'Try modifying your search query or discipline filter.'
              : 'Be the first mathematician to deposit a monograph, lecture note, or proof draft to the live archives.'}
          </p>
          <button
            onClick={() => setShowPublishModal(true)}
            className="btn-primary"
            style={{ padding: '10px 22px', fontSize: '13.5px' }}
          >
            Deposit First Manuscript
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '20px',
          }}
        >
          {filtered.map((item) => (
            <article
              key={item.id}
              className="card"
              style={{
                padding: '22px 24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                backgroundColor: '#18181D',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: 'var(--primary)',
                      backgroundColor: 'var(--primary-subtle)',
                      padding: '3px 9px',
                      borderRadius: '4px',
                      border: '1px solid var(--primary-border)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {typeof item.category === 'object' ? item.category?.name || 'Pure Mathematics' : item.resource_type || 'Monograph'}
                  </span>
                  <button
                    onClick={() => handleToggleBookmark(item.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: item.is_bookmarked ? 'var(--primary)' : 'var(--text-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                    }}
                    title={item.is_bookmarked ? 'Remove bookmark' : 'Bookmark resource'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                      {item.is_bookmarked ? 'bookmark' : 'bookmark_border'}
                    </span>
                    <span>{item.bookmark_count || 0}</span>
                  </button>
                </div>

                <h3 style={{ fontSize: '16.5px', fontWeight: 600, marginBottom: '6px', lineHeight: 1.35, color: 'var(--text)' }}>
                  {item.title}
                </h3>

                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-subtle)' }}>person</span>
                  <span>{item.uploaded_by || 'Author'}</span>
                  <span style={{ color: 'var(--text-subtle)' }}>&bull;</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'}
                  </span>
                </div>

                {item.description && (
                  <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '16px' }}>
                    {item.description}
                  </p>
                )}
              </div>

              <div
                style={{
                  marginTop: '16px',
                  paddingTop: '14px',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-subtle)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>menu_book</span>
                  <span style={{ textTransform: 'capitalize' }}>{item.resource_type || 'Textbook'}</span>
                </div>

                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary"
                    style={{ padding: '6px 14px', fontSize: '12.5px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <span>Open Manuscript</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>open_in_new</span>
                  </a>
                ) : item.file ? (
                  <a
                    href={item.file}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary"
                    style={{ padding: '6px 14px', fontSize: '12.5px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>download</span>
                    <span>Download PDF</span>
                  </a>
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>Archived Entry</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Publish Manuscript Modal */}
      {showPublishModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(10, 10, 14, 0.82)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setShowPublishModal(false)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '520px',
              maxHeight: 'min(90vh, 90dvh)',
              overflowY: 'auto',
              padding: '24px 20px',
              backgroundColor: '#16161B',
              border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--text)' }}>
                  Publish Academic Manuscript
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Contribute notes, papers, or problem sets to the live mathematical repository.
                </p>
              </div>
              <button
                onClick={() => setShowPublishModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handlePublishResource} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Manuscript Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Differential Forms & Cohomology Notes"
                  className="glass-input"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', fontSize: '13.5px' }}
                />
              </div>

              <div className="mobile-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Resource Type
                  </label>
                  <select
                    className="glass-input"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', fontSize: '13.5px', backgroundColor: '#1A1A22' }}
                  >
                    <option value="textbook">Textbook / Monograph</option>
                    <option value="note">Lecture Notes</option>
                    <option value="problem_set">Problem Set</option>
                    <option value="formula_sheet">Formula Reference</option>
                    <option value="video">Seminar Recording</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    External URL / Preprint Link
                  </label>
                  <input
                    type="url"
                    placeholder="https://arxiv.org/..."
                    className="glass-input"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', fontSize: '13.5px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Upload from device
                  </label>
                  <label className="library-file-picker">
                    <span className="material-symbols-outlined">upload_file</span>
                    <span>{newFile ? newFile.name : 'Choose a file'}</span>
                    <input
                      type="file"
                      onChange={(e) => setNewFile(e.target.files?.[0] || null)}
                      hidden
                    />
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Abstract / Overview
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide an executive mathematical summary or prerequisites..."
                  className="glass-input"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', fontSize: '13.5px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  className="btn-secondary"
                  style={{ padding: '9px 18px', fontSize: '13.5px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={publishing || !newTitle.trim()}
                  className="btn-primary"
                  style={{ padding: '9px 20px', fontSize: '13.5px' }}
                >
                  {publishing ? 'Publishing...' : 'Publish to Repository'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default LibraryPage;
