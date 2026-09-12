import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { API } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { SeminarCallModal } from '../components/seminar/SeminarCallModal';

export function MeetPage() {
  const { meetingCode } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [meeting, setMeeting] = useState(null);
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const fetchMeeting = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await API.get(`/api/social/calls/by-code/${meetingCode}/`);
        if (!res.ok) {
          throw new Error('Meeting not found or has ended.');
        }
        const data = await res.json();
        if (isMounted) {
          setMeeting(data);
          if (data.group) {
            // Load group details
            const gRes = await API.get(`/api/social/groups/${data.group}/`);
            if (gRes.ok) {
              const gData = await gRes.json();
              if (isMounted) setGroup(gData);
            } else {
              if (isMounted) setGroup({ id: data.group, name: data.group_name || 'Study Group' });
            }
          }
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Could not load meeting.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (meetingCode) {
      fetchMeeting();
    }

    return () => {
      isMounted = false;
    };
  }, [meetingCode]);

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(229, 169, 60, 0.2)', borderTopColor: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Connecting to Mathify Meet...</span>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '36px', textAlign: 'center', backgroundColor: '#18181D', border: '1px solid var(--border)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#EF4444', marginBottom: '12px' }}>
            videocam_off
          </span>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text)' }}>
            Meeting Unavailable
          </h2>
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '24px' }}>
            The meeting code <strong style={{ color: 'var(--primary)' }}>{meetingCode}</strong> does not exist or this seminar has already concluded.
          </p>
          <button onClick={() => navigate('/groups')} className="btn-primary" style={{ width: '100%', padding: '12px' }}>
            Browse Study Groups
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="card" style={{ maxWidth: '460px', width: '100%', padding: '36px', textAlign: 'center', backgroundColor: '#18181D', border: '1px solid rgba(229, 169, 60, 0.2)' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', backgroundColor: 'rgba(229, 169, 60, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '30px' }}>videocam</span>
          </div>

          <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text)' }}>
            {meeting.title}
          </h2>
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: '0 0 20px 0' }}>
            Hosted by <strong style={{ color: 'var(--text)' }}>@{meeting.initiator_username}</strong> in <strong style={{ color: 'var(--primary)' }}>{meeting.group_name}</strong>
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Link to={`/login?redirect=/meet/${meetingCode}`} className="btn-primary" style={{ padding: '12px', fontSize: '14px', textDecoration: 'none' }}>
              Sign In to Join Seminar
            </Link>
            <Link to={`/register?redirect=/meet/${meetingCode}`} className="btn-secondary" style={{ padding: '12px', fontSize: '14px', textDecoration: 'none' }}>
              Create an Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SeminarCallModal
      group={group || { id: meeting.group, name: meeting.group_name }}
      meeting={meeting}
      initialPreJoin={true}
      onClose={() => navigate('/groups')}
    />
  );
}

export default MeetPage;
