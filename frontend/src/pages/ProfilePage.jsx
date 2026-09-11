import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../api/client';
import Modal from '../components/common/Modal';

export function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [profile, setProfile] = useState(null);
  const [badges, setBadges] = useState([]);
  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [bio, setBio] = useState('');
  const [dept, setDept] = useState('');
  const [year, setYear] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadProfileData = async () => {
      try {
        setLoading(true);
        // Load detailed profile
        const profRes = await API.get('/api/accounts/me/profile/');
        if (profRes.ok) {
          const p = await profRes.json();
          setProfile(p);
          setBio(p.bio || '');
          setDept(p.department || '');
          setYear(p.year_of_study || '');
        }

        // Load Badges
        const badgesRes = await API.get('/api/rankings/badges/');
        if (badgesRes.ok) {
          const b = await badgesRes.json();
          setBadges(b.results || b);
        }

        // Load authored posts
        const currentId = API.getCurrentUserId();
        if (currentId) {
          const postsRes = await API.get(`/api/feed/posts/?author=${currentId}`);
          if (postsRes.ok) {
            const postData = await postsRes.json();
            setUserPosts(postData.results || postData);
          }
        }
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProfileData();
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await updateProfile({ bio, department: dept, year_of_study: year });
      setProfile((prev) => ({ ...prev, bio, department: dept, year_of_study: year }));
      setIsEditOpen(false);
    } catch (err) {
      alert(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const currentRole = profile?.role || user?.role || 'student';
  const currentUsername = profile?.user?.username || profile?.username || user?.username || 'Mathematician';
  const currentBio = profile?.bio || 'Passionate about advanced algebra, topology, and discrete mathematics.';
  const currentDept = profile?.department?.name || profile?.department || 'Department of Mathematics';

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      {/* Profile Header Card */}
      <div className="glass-card" style={{ padding: '28px', marginBottom: '24px', position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', smDirection: 'row', gap: '20px', alignItems: 'center' }}>
          {/* Avatar */}
          <div
            style={{
              width: '76px',
              height: '76px',
              borderRadius: '12px',
              backgroundColor: 'var(--surface-input)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
              fontWeight: 700,
              fontSize: '28px',
              flexShrink: 0,
            }}
          >
            {currentUsername[0]?.toUpperCase()}
          </div>

          {/* User Info */}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <h1 style={{ fontSize: '24px', marginBottom: '6px' }}>{currentUsername}</h1>
            
            {/* Academic Role Badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '10px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  backgroundColor: currentRole === 'host' ? 'rgba(229, 169, 60, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                  color: currentRole === 'host' ? 'var(--primary)' : '#60A5FA',
                  border: `1px solid ${currentRole === 'host' ? 'rgba(229, 169, 60, 0.35)' : 'rgba(59, 130, 246, 0.35)'}`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                  {currentRole === 'host' ? 'workspace_premium' : 'school'}
                </span>
                {currentRole === 'host' ? 'Host / Lecturer / Organizer' : 'Participant / Student'}
              </span>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '8px' }}>
              {currentDept} {profile?.year_of_study ? `• Year ${profile.year_of_study}` : ''}
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: '520px', margin: '0 auto 16px' }}>
              {currentBio}
            </p>

            <button
              onClick={() => setIsEditOpen(true)}
              className="btn-secondary"
              style={{ padding: '8px 18px', fontSize: '13px' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
              Edit Profile
            </button>
          </div>
        </div>

        {/* Academic Statistics Bar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            marginTop: '24px',
            paddingTop: '20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary)' }}>
              {profile?.points ?? profile?.score ?? 140}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Axiom Points</div>
          </div>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--secondary)' }}>
              {badges.length || 3}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Badges Unlocked</div>
          </div>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent)' }}>
              {userPosts.length}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Proofs Published</div>
          </div>
        </div>
      </div>

      {/* Badges Showcase */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--accent-gold)' }}>military_tech</span>
          Honors & Badges
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
          {badges.map((b) => (
            <div
              key={b.id || b.name}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '14px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 184, 0, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-gold)',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                  {b.icon || 'workspace_premium'}
                </span>
              </div>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>{b.name || 'Proof Master'}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-subtle)', lineHeight: 1.3 }}>
                {b.description || 'Awarded for solving complex challenges'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Authored Proofs & Posts */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Published Works & Notes</h2>
        {userPosts.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-subtle)', textAlign: 'center', padding: '20px 0' }}>
            No posts published yet. Share a proof from the Feed to showcase your work!
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {userPosts.map((p) => (
              <div
                key={p.id}
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid var(--border)',
                }}
              >
                <p style={{ fontSize: '14px', marginBottom: '8px' }}>{p.content}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-subtle)' }}>
                  <span>{new Date(p.created_at).toLocaleDateString()}</span>
                  <span>{p.likes_count || 0} likes</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Academic Profile">
        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Bio / Research Interests
            </label>
            <textarea
              className="glass-input"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="e.g. Studying algebraic geometry and quantum algorithms."
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Department
            </label>
            <input
              type="text"
              className="glass-input"
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              placeholder="e.g. Department of Mathematics"
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Year of Study
            </label>
            <input
              type="number"
              className="glass-input"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="e.g. 2"
              min={1}
              max={6}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="btn-secondary"
              style={{ fontSize: '13px', padding: '8px 16px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
              style={{ fontSize: '13px', padding: '8px 20px' }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default ProfilePage;
