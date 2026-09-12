import React, { useState } from 'react';
import { API } from '../../api/client';

export function ScheduleMeetingModal({ group, onClose, onScheduled }) {
  const [title, setTitle] = useState(`${group?.name || 'Study'} Seminar`);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a seminar title.');
      return;
    }
    if (!date || !time) {
      setError('Please select both date and time for the scheduled seminar.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const scheduledDateTime = new Date(`${date}T${time}`).toISOString();

      const res = await API.post(`/api/social/groups/${group.id}/meetings/`, {
        title: title.trim(),
        description: description.trim(),
        scheduled_for: scheduledDateTime,
        is_instant: false,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to schedule seminar');
      }

      const meetingData = await res.json();
      if (onScheduled) {
        onScheduled(meetingData);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Error scheduling seminar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: '#18181D',
          borderRadius: '16px',
          border: '1px solid rgba(229, 169, 60, 0.25)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9), 0 0 40px rgba(229, 169, 60, 0.1)',
          padding: '28px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(229, 169, 60, 0.12)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>calendar_month</span>
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                Schedule Seminar
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {group?.name}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-subtle)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#FCA5A5',
              fontSize: '12.5px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Seminar Title
            </label>
            <input
              type="text"
              className="glass-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Calculus III Exam Sprint"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Date
              </label>
              <input
                type="date"
                className="glass-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                style={{ cursor: 'pointer' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Time
              </label>
              <input
                type="time"
                className="glass-input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                style={{ cursor: 'pointer' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Agenda / Description <span style={{ color: 'var(--text-subtle)', fontSize: '11px' }}>(Optional)</span>
            </label>
            <textarea
              className="glass-input"
              rows="3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Topics, problems, or chapters to discuss..."
              style={{ resize: 'vertical', minHeight: '64px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              style={{
                flex: 1,
                padding: '10px',
                fontSize: '13.5px',
                borderRadius: '8px',
                backgroundColor: '#27272A',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{
                flex: 2,
                padding: '10px',
                fontSize: '13.5px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>event_available</span>
              <span>{loading ? 'Scheduling...' : 'Schedule Seminar'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ScheduleMeetingModal;
