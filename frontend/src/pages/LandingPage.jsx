import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MathRenderer from '../components/common/MathRenderer';

export function LandingPage() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/feed" replace />;
  }

  // Curated Academic Demonstrations
  const theorems = [
    {
      title: "Euler's Identity",
      subject: "Complex Analysis",
      latex: "e^{i\\pi} + 1 = 0",
      description: "Unifies arithmetic, algebra, geometry, and analysis through the five fundamental mathematical constants.",
      author: "Leonhard Euler (1748)",
    },
    {
      title: "Stokes' Theorem",
      subject: "Differential Forms",
      latex: "\\int_{\\partial \\Omega} \\omega = \\int_{\\Omega} d\\omega",
      description: "A profound generalization of the fundamental theorem of calculus to smooth differential forms on manifolds.",
      author: "George Gabriel Stokes (1854)",
    },
    {
      title: "Cauchy-Schwarz Inequality",
      subject: "Inner Product Spaces",
      latex: "|\\langle u, v \\rangle|^2 \\leq \\langle u, u \\rangle \\cdot \\langle v, v \\rangle",
      description: "One of the most widely used inequalities in pure mathematics, linear algebra, and functional analysis.",
      author: "Augustin-Louis Cauchy & Hermann Schwarz",
    },
    {
      title: "Gaussian Integral",
      subject: "Integral Calculus",
      latex: "\\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}",
      description: "The normalization integral for the standard normal distribution, evaluated via double integrals in polar coordinates.",
      author: "Carl Friedrich Gauss (1809)",
    },
  ];

  const [activeIdx, setActiveIdx] = useState(0);
  const activeTheorem = theorems[activeIdx];

  const pillars = [
    {
      icon: 'history_edu',
      title: 'Formal Proof Studio',
      desc: 'Author rigorous mathematical proofs with explicit logical deduction steps, axiom citations, and peer verification.',
      link: '/studio',
      cta: 'Open Studio',
    },
    {
      icon: 'smart_toy',
      title: 'Axiom AI Math Mentor',
      desc: 'Engage with an AI tutor fine-tuned to explain complex lemmas, detect logical gaps, and guide derivations.',
      link: '/tutor',
      cta: 'Consult AI',
    },
    {
      icon: 'dynamic_feed',
      title: 'Academic Social Feed',
      desc: 'Share LaTeX mathematical notes, critique published derivations, and collaborate with peers across institutions.',
      link: '/feed',
      cta: 'Explore Feed',
    },
    {
      icon: 'military_tech',
      title: 'Axiom Competitions',
      desc: 'Tackle timed mathematical challenges, solve weekly Olympiad problem sets, and benchmark your progress.',
      link: '/leaderboard',
      cta: 'View Leaderboard',
    },
  ];

  return (
    <div style={{ maxWidth: '980px', margin: '0 auto', width: '100%', padding: '0 20px 80px' }}>
      {/* Hero Section */}
      <section style={{ textAlign: 'center', padding: '56px 0 44px' }}>
        <div
          className="badge-academic"
          style={{ marginBottom: '18px', padding: '4px 14px', fontSize: '12.5px' }}
        >
          <span style={{ fontFamily: 'serif', fontWeight: 700 }}>&forall;&exist;</span>
          Next-Generation Academic Mathematics Hub
        </div>

        <h1
          style={{
            fontSize: 'clamp(32px, 5vw, 54px)',
            lineHeight: 1.15,
            fontWeight: 700,
            letterSpacing: '-0.025em',
            marginBottom: '16px',
            color: 'var(--text)',
          }}
        >
          Rigorous Proofs.{' '}
          <span style={{ color: 'var(--primary)' }}>
            Collaborative Learning.
          </span>
        </h1>

        <p
          style={{
            fontSize: 'clamp(16px, 2vw, 18px)',
            color: 'var(--text-muted)',
            maxWidth: '620px',
            margin: '0 auto 32px',
            lineHeight: 1.6,
          }}
        >
          Mathify provides a dedicated academic workspace for authoring LaTeX proofs,
          discussing mathematical conjectures, and receiving guided assistance from an AI math tutor.
        </p>

        {/* Primary Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '48px' }}>
          <Link
            to={isAuthenticated ? '/studio' : '/register'}
            className="btn-primary"
            style={{ padding: '11px 22px', fontSize: '14.5px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>draw</span>
            Launch Proof Studio
          </Link>
          <Link
            to="/feed"
            className="btn-secondary"
            style={{ padding: '11px 20px', fontSize: '14.5px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>dynamic_feed</span>
            Browse Social Feed
          </Link>
        </div>

        {/* Concrete Live Mathematical Document Showcase */}
        <div
          className="card"
          style={{
            textAlign: 'left',
            padding: '24px 28px',
            maxWidth: '780px',
            margin: '0 auto',
            backgroundColor: '#16161B',
          }}
        >
          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '20px' }}>
                menu_book
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Theorem Showcase
              </span>
            </div>
            <span className="badge-academic" style={{ fontSize: '11px' }}>
              {activeTheorem.subject}
            </span>
          </div>

          {/* Theorem Selector Tabs */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '14px' }}>
            {theorems.map((t, idx) => (
              <button
                key={t.title}
                type="button"
                onClick={() => setActiveIdx(idx)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: idx === activeIdx ? '1px solid var(--primary-border)' : '1px solid var(--border)',
                  backgroundColor: idx === activeIdx ? 'var(--primary-subtle)' : 'transparent',
                  color: idx === activeIdx ? 'var(--primary)' : 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {t.title}
              </button>
            ))}
          </div>

          {/* Mathematical Statement Box */}
          <div className="math-paper" style={{ margin: '8px 0 14px', minHeight: '68px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MathRenderer content={activeTheorem.latex} displayMode={true} />
          </div>

          {/* Description & Metadata */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', fontSize: '13px' }}>
            <div style={{ maxWidth: '540px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {activeTheorem.description}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-subtle)', fontStyle: 'italic' }}>
              {activeTheorem.author}
            </div>
          </div>
        </div>
      </section>

      {/* Academic Pillars Grid */}
      <section style={{ padding: '48px 0 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>
            Core Academic Workspaces
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14.5px', maxWidth: '460px', margin: '0 auto' }}>
            A disciplined suite designed specifically for mathematical formulation, verification, and study.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '16px',
          }}
        >
          {pillars.map((item) => (
            <div
              key={item.title}
              className="card"
              style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--primary-subtle)',
                    border: '1px solid var(--primary-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary)',
                    marginBottom: '16px',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                    {item.icon}
                  </span>
                </div>

                <h3 style={{ fontSize: '17px', marginBottom: '8px', fontWeight: 600 }}>
                  {item.title}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', lineHeight: 1.6 }}>
                  {item.desc}
                </p>
              </div>

              <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                <Link
                  to={item.link}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    color: 'var(--primary)',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  {item.cta}
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Academic Institutional Banner */}
      <section
        className="card"
        style={{
          marginTop: '40px',
          padding: '36px 28px',
          textAlign: 'center',
          backgroundColor: '#16161B',
        }}
      >
        <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>
          Advancing Mathematical Thought
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '500px', margin: '0 auto 20px', lineHeight: 1.6 }}>
          Join mathematics students, researchers, and instructors authoring formal derivations and sharing academic resources.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <Link to="/register" className="btn-primary" style={{ padding: '9px 20px', fontSize: '14px' }}>
            Register Free Account
          </Link>
          <Link to="/studio" className="btn-secondary" style={{ padding: '9px 18px', fontSize: '14px' }}>
            Open Proof Studio
          </Link>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
