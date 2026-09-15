import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../api/client';
import MathRenderer from '../components/common/MathRenderer';

export function FeedPage() {
  const { user, isAuthenticated } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Composer state
  const [content, setContent] = useState('');
  const [latex, setLatex] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewTab, setPreviewTab] = useState('write');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Active comments drawer
  const [activeCommentsPostId, setActiveCommentsPostId] = useState(null);
  const [commentsMap, setCommentsMap] = useState({});
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [newPostsAvailable, setNewPostsAvailable] = useState(0);

  const categories = [
    { id: 'all', label: 'All Fields' },
    { id: 'pure', label: 'Pure Math' },
    { id: 'applied', label: 'Applied' },
    { id: 'physics', label: 'Theoretical Physics' },
    { id: 'cs', label: 'Computer Science' },
  ];

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await API.get('/api/feed/posts/');
      if (res.ok) {
        const data = await res.json();
        setPosts(data.results || data);
        setNewPostsAvailable(0);
      } else {
        setError('Unable to load feed. Please try again.');
      }
    } catch {
      setError('Network error loading posts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  // Real-time check for new preprints / publications
  useEffect(() => {
    let isMounted = true;
    const checkNewPosts = async () => {
      if (posts.length === 0) return;
      try {
        const res = await API.get('/api/feed/posts/');
        if (res.ok) {
          const data = await res.json();
          const items = data.results || data;
          if (Array.isArray(items) && items.length > 0) {
            const currentLatestId = posts[0]?.id;
            const newItems = items.filter((p) => p.id > currentLatestId);
            if (isMounted && newItems.length > 0) {
              setNewPostsAvailable(newItems.length);
            }
          }
        }
      } catch {}
    };

    const interval = setInterval(checkNewPosts, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [posts]);

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!content.trim() && !latex.trim() && !selectedFile) return;

    try {
      setSubmitting(true);
      const formData = new FormData();
      if (content.trim()) formData.append('content', content.trim());
      if (latex.trim()) formData.append('latex_content', latex.trim());
      if (selectedFile) formData.append('media', selectedFile);

      const res = await API.post('/api/feed/posts/', formData);
      if (res.ok) {
        const newPost = await res.json();
        const hydratedPost = {
          ...newPost,
          author: newPost.author || user?.username,
          author_username: newPost.author_username || (typeof newPost.author === 'string' ? newPost.author : newPost.author?.username) || user?.username,
          author_id: newPost.author_id || user?.id,
          author_avatar: newPost.author_avatar || user?.avatar || null,
        };
        setPosts((prev) => [hydratedPost, ...prev]);
        setContent('');
        setLatex('');
        setSelectedFile(null);
        setPreviewTab('write');
      }
    } catch (err) {
      console.error('Failed to create post:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      // Optimistic UI update
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id === postId) {
            const isLiked = !p.is_liked;
            return {
              ...p,
              is_liked: isLiked,
              likes_count: isLiked ? p.likes_count + 1 : Math.max(0, p.likes_count - 1),
            };
          }
          return p;
        })
      );

      const res = await API.post(`/api/feed/posts/${postId}/like/`, {});
      if (res.ok) {
        const data = await res.json();
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, is_liked: data.liked ?? data.is_liked, likes_count: data.likes_count ?? p.likes_count }
              : p
          )
        );
      }
    } catch (err) {
      console.error('Like failed:', err);
      fetchPosts(); // Rollback on error
    }
  };

  const toggleComments = async (postId) => {
    if (activeCommentsPostId === postId) {
      setActiveCommentsPostId(null);
      return;
    }
    setActiveCommentsPostId(postId);

    if (!commentsMap[postId]) {
      try {
        const res = await API.get(`/api/feed/posts/${postId}/comments/`);
        if (res.ok) {
          const data = await res.json();
          setCommentsMap((prev) => ({
            ...prev,
            [postId]: data.results || data,
          }));
        }
      } catch (err) {
        console.error('Failed to load comments:', err);
      }
    }
  };

  const handleAddComment = async (postId) => {
    if (!commentText.trim()) return;
    try {
      setCommentSubmitting(true);
      const res = await API.post(`/api/feed/posts/${postId}/comments/`, {
        content: commentText.trim(),
      });
      if (res.ok) {
        const newComment = await res.json();
        setCommentsMap((prev) => ({
          ...prev,
          [postId]: [...(prev[postId] || []), newComment],
        }));
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p))
        );
        setCommentText('');
      }
    } catch (err) {
      console.error('Comment failed:', err);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this publication? This action cannot be undone.')) {
      return;
    }
    setDeletingId(postId);
    try {
      const res = await API.delete(`/api/feed/posts/${postId}/`);
      if (res.ok || res.status === 204) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Unable to delete publication: ${errData.detail || 'Permission denied'}`);
      }
    } catch (err) {
      console.error('Failed to delete post:', err);
      alert('Network error attempting to delete publication.');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredPosts = posts.filter((p) => {
    if (searchTerm) {
      const authorName = p.author_username || (typeof p.author === 'string' ? p.author : p.author?.username) || '';
      const matchContent = p.content?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchLatex = p.latex_content?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchAuthor = authorName.toLowerCase().includes(searchTerm.toLowerCase());
      return matchContent || matchLatex || matchAuthor;
    }
    return true;
  });

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', width: '100%' }}>
      {/* Category Pills */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '12px',
          marginBottom: '16px',
          scrollbarWidth: 'none',
        }}
      >
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            style={{
              padding: '7px 14px',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              border: activeCategory === cat.id ? '1px solid var(--primary-border)' : '1px solid var(--border)',
              backgroundColor: activeCategory === cat.id ? 'var(--primary-subtle)' : 'rgba(255, 255, 255, 0.03)',
              color: activeCategory === cat.id ? 'var(--primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Post Composer */}
      {isAuthenticated && (
        <div
          className="card"
          style={{
            padding: '20px',
            marginBottom: '24px',
            backgroundColor: '#18181D',
          }}
        >
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#22222A',
                border: '1px solid var(--border)',
                color: 'var(--primary)',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {user?.username?.[0]?.toUpperCase() || 'M'}
            </div>
            <div className="feed-composer-body" style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                <button
                  type="button"
                  onClick={() => setPreviewTab('write')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: previewTab === 'write' ? '2px solid var(--primary)' : '2px solid transparent',
                    color: previewTab === 'write' ? 'var(--primary)' : 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '13px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                  }}
                >
                  Write Post
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('preview')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: previewTab === 'preview' ? '2px solid var(--primary)' : '2px solid transparent',
                    color: previewTab === 'preview' ? 'var(--primary)' : 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '13px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                  }}
                >
                  LaTeX Preview
                </button>
              </div>

              {previewTab === 'write' ? (
                <form onSubmit={handleCreatePost} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <textarea
                    className="glass-input"
                    rows={3}
                    placeholder="Share a proof, theorem, or mathematical puzzle..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    style={{ resize: 'vertical' }}
                  />

                  <input
                    type="text"
                    className="glass-input"
                    placeholder="LaTeX equation (e.g. \sum_{n=1}^\infty \frac{1}{n^2} = \frac{\pi^2}{6})"
                    value={latex}
                    onChange={(e) => setLatex(e.target.value)}
                    style={{ fontFamily: 'monospace', fontSize: '13px' }}
                  />

                  {/* Attachment indicator */}
                  {selectedFile && (
                    <div className="feed-attachment-row" style={{ fontSize: '12px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>attach_file</span>
                      <span className="feed-attachment-name" title={selectedFile.name}>{selectedFile.name}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        style={{ background: 'transparent', border: 'none', color: '#F87171', cursor: 'pointer', flexShrink: 0, padding: '4px 0' }}
                      >
                        remove
                      </button>
                    </div>
                  )}

                  <div className="feed-composer-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                    <label
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        fontSize: '13px',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>image</span>
                      Attach Media
                      <input
                        type="file"
                        accept="image/*,video/*"
                        style={{ display: 'none' }}
                        onChange={(e) => setSelectedFile(e.target.files[0])}
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={submitting || (!content.trim() && !latex.trim() && !selectedFile)}
                      className="btn-primary"
                      style={{ padding: '8px 18px', fontSize: '13px' }}
                    >
                      {submitting ? 'Publishing...' : 'Publish'}
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', minHeight: '80px' }}>
                  {latex ? (
                    <MathRenderer content={latex} displayMode={true} />
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Type a formula in the LaTeX input to preview.</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Feed Stream */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '36px', animation: 'spin 1s linear infinite' }}>
            progress_activity
          </span>
          <p style={{ marginTop: '12px', fontSize: '14px' }}>Loading math feed...</p>
        </div>
      ) : error ? (
        <div className="glass-card" style={{ padding: '24px', textAlign: 'center', color: '#F87171' }}>
          {error}
          <div style={{ marginTop: '12px' }}>
            <button onClick={fetchPosts} className="btn-secondary" style={{ fontSize: '13px' }}>
              Retry
            </button>
          </div>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--primary)' }}>
            post_add
          </span>
          <h3 style={{ marginTop: '12px', fontSize: '16px' }}>No posts yet</h3>
          <p style={{ fontSize: '13px', marginTop: '6px' }}>Be the first to share a theorem or mathematical thought!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {newPostsAvailable > 0 && (
            <button
              onClick={() => {
                fetchPosts();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              style={{
                width: '100%',
                padding: '10px 16px',
                backgroundColor: 'var(--primary-subtle)',
                border: '1px solid var(--primary-border)',
                borderRadius: '10px',
                color: 'var(--primary)',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(229, 169, 60, 0.2)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>bolt</span>
              <span>{newPostsAvailable} new preprint{newPostsAvailable > 1 ? 's' : ''} published &bull; Click to update feed</span>
            </button>
          )}
          {filteredPosts.map((post) => {
            const authorDisplay = post.author_username || (typeof post.author === 'string' ? post.author : post.author?.username) || 'Mathematician';
            const currentUserId = API.getCurrentUserId() || user?.id;
            const isAuthor = Boolean(
              currentUserId && (
                Number(post.author_id) === Number(currentUserId) ||
                (user?.username && (post.author === user.username || post.author_username === user.username))
              )
            );

            return (
              <article key={post.id} className="glass-card" style={{ padding: '20px' }}>
                {/* Post Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--surface-input)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary)',
                        fontWeight: 600,
                        fontSize: '13px',
                        overflow: 'hidden',
                      }}
                    >
                      {post.author_avatar ? (
                        <img src={post.author_avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        authorDisplay?.[0]?.toUpperCase() || 'M'
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>
                        {authorDisplay}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>
                        {post.created_at ? new Date(post.created_at).toLocaleDateString() : 'Just now'}
                      </div>
                    </div>
                  </div>

                  {/* Delete Button for Post Author */}
                  {isAuthor && (
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      disabled={deletingId === post.id}
                      title="Delete publication"
                      style={{
                        background: 'transparent',
                        border: '1px solid transparent',
                        color: 'var(--text-subtle)',
                        cursor: deletingId === post.id ? 'not-allowed' : 'pointer',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        fontWeight: 500,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (deletingId !== post.id) {
                          e.currentTarget.style.color = '#EF4444';
                          e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
                          e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-subtle)';
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.borderColor = 'transparent';
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>
                        {deletingId === post.id ? 'hourglass_empty' : 'delete'}
                      </span>
                      <span>{deletingId === post.id ? 'Deleting...' : 'Delete'}</span>
                    </button>
                  )}
                </div>

                {/* Post Body */}
                {post.content && (
                  <p style={{ fontSize: '15px', color: 'var(--text)', lineHeight: 1.6, marginBottom: '12px' }}>
                    {post.content}
                  </p>
                )}

              {/* LaTeX Formula */}
              {post.latex_content && (
                <div style={{ margin: '14px 0' }}>
                  <div className="math-blackboard">
                    <MathRenderer content={post.latex_content} displayMode={true} />
                  </div>
                </div>
              )}

              {/* Media Attachment */}
              {post.media && (
                <div className="feed-media-attachment" style={{ margin: '14px 0', borderRadius: '12px', overflow: 'hidden', maxHeight: '420px', background: 'rgba(0,0,0,0.4)' }}>
                  {/\.(mp4|webm|ogg)$/i.test(post.media) ? (
                    <video src={post.media} controls style={{ width: '100%', maxWidth: '100%', height: 'auto', maxHeight: '420px', display: 'block' }} />
                  ) : (
                    <img src={post.media} alt="Post attachment" style={{ width: '100%', maxWidth: '100%', height: 'auto', objectFit: 'cover', display: 'block' }} />
                  )}
                </div>
              )}

              {/* Post Actions: Like & Comment */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  marginTop: '12px',
                }}
              >
                <button
                  onClick={() => handleLike(post.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: post.is_liked ? 'var(--primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: '18px',
                      fontVariationSettings: post.is_liked ? "'FILL' 1" : "'FILL' 0",
                    }}
                  >
                    favorite
                  </span>
                  {post.likes_count || 0}
                </button>

                <button
                  onClick={() => toggleComments(post.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: activeCommentsPostId === post.id ? 'var(--primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    mode_comment
                  </span>
                  {post.comments_count || 0}
                </button>
              </div>

              {/* Expandable Comments Drawer */}
              {activeCommentsPostId === post.id && (
                <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {/* Add Comment Input */}
                  {isAuthenticated ? (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                      <input
                        type="text"
                        className="glass-input"
                        placeholder="Write a comment..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddComment(post.id);
                        }}
                        style={{ fontSize: '13px' }}
                      />
                      <button
                        onClick={() => handleAddComment(post.id)}
                        disabled={commentSubmitting || !commentText.trim()}
                        className="btn-primary"
                        style={{ padding: '6px 14px', fontSize: '13px' }}
                      >
                        {commentSubmitting ? '...' : 'Reply'}
                      </button>
                    </div>
                  ) : (
                    <p style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '12px' }}>
                      Sign in to participate in the discussion.
                    </p>
                  )}

                  {/* Comment List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(commentsMap[post.id] || []).length === 0 ? (
                      <span style={{ fontSize: '13px', color: 'var(--text-subtle)' }}>No comments yet.</span>
                    ) : (
                      commentsMap[post.id].map((c) => (
                        <div
                          key={c.id}
                          style={{
                            padding: '10px 14px',
                            background: 'rgba(0, 0, 0, 0.25)',
                            borderRadius: '10px',
                            fontSize: '13px',
                          }}
                        >
                          <div style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '2px', fontSize: '12px' }}>
                            {c.author_username || 'Peer'}
                          </div>
                          <div style={{ color: 'var(--text)' }}>{c.content}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default FeedPage;
