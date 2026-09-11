import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API } from '../api/client';

export function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all-time');
  const [activeComp, setActiveComp] = useState(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        let res = await API.get(`/api/rankings/leaderboard/?period=${activeTab}`);
        if (!res.ok) {
          res = await API.get('/api/rankings/leaderboard/');
        }
        if (res.ok) {
          const data = await res.json();
          const list = data.results || data;
          setLeaderboard(Array.isArray(list) ? list : []);
        } else {
          setLeaderboard([]);
        }
      } catch (err) {
        console.error('Failed to load leaderboard:', err);
        setLeaderboard([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();

    const fetchActiveCompetition = async () => {
      try {
        const res = await API.get('/api/rankings/competitions/');
        if (res.ok) {
          const data = await res.json();
          const list = data.results || data;
          if (Array.isArray(list) && list.length > 0) {
            setActiveComp(list[0]);
          } else {
            setActiveComp(null);
          }
        }
      } catch {
        setActiveComp(null);
      }
    };
    fetchActiveCompetition();
  }, [activeTab]);

  const displayList = leaderboard;
  const topThree = leaderboard.slice(0, 3);

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
              Academic Rankings
            </div>
            <h1 style={{ fontSize: '26px', margin: '0 0 8px', fontWeight: 700 }}>
              Global Axiom Leaderboard & Rankings
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14.5px', maxWidth: '600px', margin: 0, lineHeight: 1.55 }}>
              Benchmark peer rankings based strictly on verified solutions to mathematical competition questions.
            </p>
          </div>

          {/* Quick tab switcher */}
          <div style={{ display: 'flex', gap: '8px', backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <button
              onClick={() => setActiveTab('all-time')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'all-time' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'all-time' ? '#121215' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              All-Time
            </button>
            <button
              onClick={() => setActiveTab('season')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'season' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'season' ? '#121215' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Fall 2026 Season
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Rankings on Left, Scoring Guidelines on Right */}
      <div className="studio-grid">
        {/* Left Column: Podium & List */}
        <div>
          {displayList.length === 0 ? (
            <div className="card" style={{ padding: '48px 24px', textAlign: 'center', backgroundColor: '#18181D', marginBottom: '24px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--primary)', marginBottom: '12px' }}>
                military_tech
              </span>
              <h3 style={{ fontSize: '18px', margin: '0 0 8px', fontWeight: 700 }}>No Scholars Ranked Yet</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '440px', margin: '0 auto 20px', lineHeight: 1.5 }}>
                Answer active competition questions correctly to earn Axiom Points and claim rank #1 on the global leaderboard.
              </p>
              <Link to="/competitions" className="btn-primary" style={{ display: 'inline-flex', padding: '9px 20px', fontSize: '13px', textDecoration: 'none' }}>
                Enter Competitions
              </Link>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '14px',
                marginBottom: '24px',
                alignItems: 'flex-end',
              }}
            >
              {/* 2nd Place */}
              <div
                className="card"
                style={{
                  padding: '20px 16px',
                  textAlign: 'center',
                  borderTop: '3px solid #C0C0C0',
                  backgroundColor: '#18181D',
                  order: 1,
                }}
              >
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#C0C0C0', marginBottom: '6px' }}>
                  #2 Silver
                </div>
                <div style={{ fontWeight: 600, fontSize: '14.5px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {topThree[1] ? (topThree[1].name || topThree[1].username) : 'Awaiting Contender'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '8px' }}>
                  {topThree[1] ? (topThree[1].institution || `@${topThree[1].username}`) : 'Unclaimed'}
                </div>
                <div style={{ fontSize: '15px', color: 'var(--primary)', fontWeight: 700 }}>
                  {topThree[1] ? `${(topThree[1].points || 0).toLocaleString()} pts` : '—'}
                </div>
              </div>

              {/* 1st Place */}
              <div
                className="card"
                style={{
                  padding: '28px 18px',
                  textAlign: 'center',
                  borderTop: '3px solid var(--primary)',
                  backgroundColor: '#1C1C22',
                  order: 2,
                  transform: 'translateY(-6px)',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(229, 169, 60, 0.12)',
                }}
              >
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)', marginBottom: '6px' }}>
                  #1 Gold Laureate
                </div>
                <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {topThree[0] ? (topThree[0].name || topThree[0].username) : 'Awaiting Contender'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '10px' }}>
                  {topThree[0] ? (topThree[0].institution || `@${topThree[0].username}`) : 'Unclaimed'}
                </div>
                <div style={{ fontSize: '18px', color: 'var(--primary)', fontWeight: 800 }}>
                  {topThree[0] ? `${(topThree[0].points || 0).toLocaleString()} pts` : '—'}
                </div>
              </div>

              {/* 3rd Place */}
              <div
                className="card"
                style={{
                  padding: '20px 16px',
                  textAlign: 'center',
                  borderTop: '3px solid #CD7F32',
                  backgroundColor: '#18181D',
                  order: 3,
                }}
              >
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#CD7F32', marginBottom: '6px' }}>
                  #3 Bronze
                </div>
                <div style={{ fontWeight: 600, fontSize: '14.5px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {topThree[2] ? (topThree[2].name || topThree[2].username) : 'Awaiting Contender'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '8px' }}>
                  {topThree[2] ? (topThree[2].institution || `@${topThree[2].username}`) : 'Unclaimed'}
                </div>
                <div style={{ fontSize: '15px', color: 'var(--text-muted)', fontWeight: 700 }}>
                  {topThree[2] ? `${(topThree[2].points || 0).toLocaleString()} pts` : '—'}
                </div>
              </div>
            </div>
          )}

          {/* Full Rankings Table List */}
          <div className="card" style={{ padding: '8px', backgroundColor: '#18181D' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 18px',
                borderBottom: '1px solid var(--border)',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-subtle)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <span>Rank & Scholar</span>
              <span>Axiom Score</span>
            </div>

            {displayList.map((item, idx) => {
              const rank = idx + 1;
              const isTop3 = rank <= 3;
              const pts = item.points ?? item.score ?? 0;
              const name = item.name || item.username;
              const handle = item.username ? `@${item.username}` : `Scholar #${rank}`;

              return (
                <div
                  key={item.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderBottom: idx !== displayList.length - 1 ? '1px solid var(--border)' : 'none',
                    backgroundColor: isTop3 ? 'rgba(229, 169, 60, 0.03)' : 'transparent',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '13px',
                        backgroundColor: rank === 1 ? 'var(--primary)' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : 'rgba(255, 255, 255, 0.05)',
                        color: rank <= 3 ? '#121215' : 'var(--text-subtle)',
                      }}
                    >
                      {rank}
                    </div>

                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>
                        {name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>
                        {handle} &bull; {item.institution || 'Pure Mathematics'}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--primary)' }}>
                      {pts.toLocaleString()} pts
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
                      Verified Solutions
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Scoring Rules & Competition Highlights */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Points System Rule */}
          <div className="card" style={{ padding: '24px', backgroundColor: '#18181D' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '20px' }}>
                verified
              </span>
              Axiom Scoring Index
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '16px' }}>
              Points are awarded strictly for solving and answering mathematical competition problems.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: 'rgba(229, 169, 60, 0.08)', borderRadius: '6px', border: '1px solid var(--primary-border)' }}>
                <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500 }}>Competition Question Answered</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>+10 pts</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: '#141418', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Other Actions (Feed, Library, etc.)</span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-subtle)' }}>0 pts</span>
              </div>
            </div>
          </div>

          {/* Active Competition Live Card */}
          <div className="card" style={{ padding: '24px', backgroundColor: '#16161B', border: '1px solid var(--primary-border)' }}>
            <div className="badge-academic" style={{ marginBottom: '10px' }}>
              {activeComp ? 'Live Sprint' : 'Competition Hub'}
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>
              {activeComp ? activeComp.name : 'No Active Competition Running'}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '16px' }}>
              {activeComp
                ? (activeComp.description || 'Answer challenge problems to earn Axiom Points.')
                : 'Visit the Competitions page to participate in live problem challenges or host a new sprint.'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '14px' }}>
              <span>{activeComp ? `${activeComp.questions_count || 0} Problems` : 'Sprint Arena'}</span>
              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Earn Points</span>
            </div>
            <Link
              to="/competitions"
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px', fontSize: '13px', textDecoration: 'none' }}
            >
              <span>{activeComp ? 'Enter Competition' : 'Explore Competitions'}</span>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LeaderboardPage;
