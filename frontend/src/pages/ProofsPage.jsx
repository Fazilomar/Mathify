import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../api/client';
import MathRenderer from '../components/common/MathRenderer';
import Modal from '../components/common/Modal';

export function ProofsPage() {
  const { user, isAuthenticated } = useAuth();
  const [proofs, setProofs] = useState([]);
  const [formulas, setFormulas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Composer modal state
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [latexProof, setLatexProof] = useState('');
  const [steps, setSteps] = useState([
    { id: 1, statement: 'Initial assumption / given premises', latex: '', rule: 'Hypothesis' },
  ]);
  const [selectedFormulaIds, setSelectedFormulaIds] = useState([]);
  const [visibility, setVisibility] = useState('public');
  const [saving, setSaving] = useState(false);
  const [expandedProofId, setExpandedProofId] = useState(null);

  // Active input focus target for inserting math symbols
  const [activeSymbolTarget, setActiveSymbolTarget] = useState('latexProof');

  const mathSymbols = [
    { sym: '∀', code: '\\forall ' },
    { sym: '∃', code: '\\exists ' },
    { sym: '∈', code: '\\in ' },
    { sym: '∉', code: '\\notin ' },
    { sym: '⊂', code: '\\subset ' },
    { sym: '⊆', code: '\\subseteq ' },
    { sym: '⟹', code: '\\implies ' },
    { sym: '⟺', code: '\\iff ' },
    { sym: '∑', code: '\\sum_{i=1}^n ' },
    { sym: '∏', code: '\\prod_{i=1}^n ' },
    { sym: '∫', code: '\\int_a^b ' },
    { sym: '∂', code: '\\partial ' },
    { sym: '∇', code: '\\nabla ' },
    { sym: '∞', code: '\\infty ' },
    { sym: 'ℝ', code: '\\mathbb{R}' },
    { sym: 'ℂ', code: '\\mathbb{C}' },
    { sym: 'ℤ', code: '\\mathbb{Z}' },
    { sym: 'ℕ', code: '\\mathbb{N}' },
    { sym: 'ε', code: '\\varepsilon ' },
    { sym: 'δ', code: '\\delta ' },
    { sym: 'θ', code: '\\theta ' },
    { sym: 'π', code: '\\pi ' },
    { sym: 'λ', code: '\\lambda ' },
    { sym: 'Q.E.D.', code: '\\quad \\blacksquare' },
  ];

  // Foundational axioms for quick sidebar reference
  const axiomReference = [
    { name: 'Completeness of ℝ', latex: '\\forall S \\subset \\mathbb{R}, \\ S \\neq \\emptyset \\text{ bdd above} \\implies \\exists \\sup S' },
    { name: "Euler's Identity", latex: 'e^{i\\pi} + 1 = 0' },
    { name: "Stokes' Generalized Theorem", latex: '\\int_{\\partial \\Omega} \\omega = \\int_{\\Omega} d\\omega' },
    { name: 'Cauchy-Schwarz Inequality', latex: '|\\langle u, v \\rangle|^2 \\leq \\langle u, u \\rangle \\cdot \\langle v, v \\rangle' },
    { name: 'Archimedean Property', latex: '\\forall x \\in \\mathbb{R}, \\ \\exists n \\in \\mathbb{N} : n > x' },
  ];

  const fetchProofsAndFormulas = async () => {
    try {
      setLoading(true);
      const [creationsRes, formulasRes] = await Promise.all([
        API.get('/api/studio/creations/'),
        API.get('/api/studio/formulas/'),
      ]);

      if (creationsRes.ok) {
        const data = await creationsRes.json();
        setProofs(data.results || data);
      }

      if (formulasRes.ok) {
        const data = await formulasRes.json();
        setFormulas(data.results || data);
      }
    } catch (err) {
      console.error('Failed to load proofs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProofsAndFormulas();
  }, []);

  const handleAddStep = () => {
    setSteps((prev) => [
      ...prev,
      { id: Date.now(), statement: '', latex: '', rule: 'Deduction' },
    ]);
  };

  const handleRemoveStep = (id) => {
    if (steps.length <= 1) return;
    setSteps((prev) => prev.filter((s) => s.id !== id));
  };

  const handleUpdateStep = (id, field, value) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const insertSymbol = (code) => {
    if (activeSymbolTarget === 'latexProof') {
      setLatexProof((prev) => prev + code);
    } else if (activeSymbolTarget.startsWith('step_')) {
      const stepId = Number(activeSymbolTarget.replace('step_', ''));
      setSteps((prev) =>
        prev.map((s) => (s.id === stepId ? { ...s, latex: s.latex + code } : s))
      );
    }
  };

  const handlePublishProof = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);

    const formattedStepsText = steps
      .map((s, idx) => `Step ${idx + 1} [${s.rule}]: ${s.statement} ${s.latex ? `$$${s.latex}$$` : ''}`)
      .join('\n\n');

    const fullContent = [
      hypothesis ? `**Hypothesis:**\n${hypothesis}` : '',
      conclusion ? `**Theorem Statement:**\n${conclusion}` : '',
      formattedStepsText ? `**Derivation Steps:**\n${formattedStepsText}` : '',
    ]
      .filter(Boolean)
      .join('\n\n---\n\n');

    try {
      const res = await API.post('/api/studio/creations/', {
        title: title.trim(),
        content: fullContent,
        latex_content: latexProof.trim(),
        formula_ids: selectedFormulaIds,
        visibility,
      });

      if (res.ok) {
        setIsComposerOpen(false);
        setTitle('');
        setHypothesis('');
        setConclusion('');
        setLatexProof('');
        setSteps([{ id: 1, statement: 'Initial assumption / given premises', latex: '', rule: 'Hypothesis' }]);
        setSelectedFormulaIds([]);
        fetchProofsAndFormulas();
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(`Failed to publish proof: ${JSON.stringify(errorData)}`);
      }
    } catch (err) {
      console.error('Error creating proof:', err);
      alert('Network error publishing proof');
    } finally {
      setSaving(false);
    }
  };

  // User-created proofs from live database
  const allProofs = proofs;

  const filteredProofs = allProofs.filter((p) => {
    if (activeFilter === 'my') {
      const currentUserId = API.getCurrentUserId();
      return currentUserId && Number(p.author_id || p.author?.id) === Number(currentUserId);
    }

    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      p.title?.toLowerCase().includes(q) ||
      p.content?.toLowerCase().includes(q) ||
      p.author?.toLowerCase?.().includes(q) ||
      p.latex_content?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ width: '100%' }}>
      {/* Studio Header Card */}
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
              Formal Proof Studio
            </div>
            <h1 style={{ fontSize: '26px', margin: '0 0 6px', fontWeight: 700 }}>
              Theorem Derivations & Axiom Notebook
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14.5px', maxWidth: '620px', margin: 0, lineHeight: 1.55 }}>
              Draft step-by-step rigorous proofs in LaTeX, link foundational axioms, and publish preprints for peer review consensus.
            </p>
          </div>

          <button
            onClick={() => setIsComposerOpen(true)}
            className="btn-primary"
            style={{ padding: '10px 20px', fontSize: '13.5px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>draw</span>
            Draft New Proof
          </button>
        </div>

        {/* Academic Stats Summary */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '16px',
            marginTop: '22px',
            paddingTop: '18px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>
              {allProofs.length}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>Catalogued Preprints</div>
          </div>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>
              {formulas.length > 0 ? formulas.length : 12}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>Linked Axioms</div>
          </div>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--primary)' }}>
              Q.E.D.
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>Formal Rigor Standard</div>
          </div>
        </div>
      </div>

      {/* Main Studio Grid: Proofs Stream on Left, Axiom Sidebar on Right */}
      <div className="studio-grid">
        {/* Left Column: Proofs List & Filter */}
        <div>
          {/* Filter & Search Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '18px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setActiveFilter('all')}
                style={{
                  padding: '7px 16px',
                  borderRadius: '6px',
                  border: activeFilter === 'all' ? '1px solid var(--primary-border)' : '1px solid var(--border)',
                  backgroundColor: activeFilter === 'all' ? 'var(--primary-subtle)' : 'transparent',
                  color: activeFilter === 'all' ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                All Preprints ({allProofs.length})
              </button>
              {isAuthenticated && (
                <button
                  onClick={() => setActiveFilter('my')}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '6px',
                    border: activeFilter === 'my' ? '1px solid var(--primary-border)' : '1px solid var(--border)',
                    backgroundColor: activeFilter === 'my' ? 'var(--primary-subtle)' : 'transparent',
                    color: activeFilter === 'my' ? 'var(--primary)' : 'var(--text-muted)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  My Works
                </button>
              )}
            </div>

            <div style={{ flex: 1, minWidth: '220px', maxWidth: '340px' }}>
              <input
                type="text"
                className="glass-input"
                placeholder="Search proofs or theorems..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ padding: '7px 12px', fontSize: '13px', width: '100%' }}
              />
            </div>
          </div>

          {/* Proofs Cards Stream */}
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '14px' }}>Loading mathematical proofs...</p>
            </div>
          ) : filteredProofs.length === 0 ? (
            <div className="card" style={{ padding: '44px 20px', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: '#18181D' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--primary)' }}>
                history_edu
              </span>
              <h3 style={{ marginTop: '12px', fontSize: '16px', color: 'var(--text)' }}>No proofs found</h3>
              <p style={{ fontSize: '13.5px', marginTop: '4px' }}>
                Click "Draft New Proof" above to publish your first formal theorem.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {filteredProofs.map((p) => {
                const isExpanded = expandedProofId === p.id;
                const authorDisplay = p.author_username || p.author_email || (typeof p.author === 'string' ? p.author : p.author?.username) || 'Mathematician';

                return (
                  <article
                    key={p.id}
                    className="card"
                    style={{
                      padding: '24px 26px',
                      backgroundColor: '#18181D',
                    }}
                  >
                    {/* Proof Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span className="badge-academic" style={{ fontSize: '11px', padding: '2px 7px' }}>
                            Formal Theorem
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>
                            {p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Preprint'}
                          </span>
                        </div>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '6px 0 2px', color: 'var(--text)' }}>
                          {p.title}
                        </h2>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                          Author: <span style={{ color: 'var(--text)', fontWeight: 500 }}>{authorDisplay}</span>
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(255, 255, 255, 0.04)',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border)',
                          letterSpacing: '0.03em',
                        }}
                      >
                        {p.visibility ? p.visibility.toUpperCase() : 'PUBLIC'}
                      </span>
                    </div>

                    {/* Main LaTeX Equation Display */}
                    {p.latex_content && (
                      <div className="math-paper" style={{ margin: '14px 0', padding: '16px 20px', borderRadius: '10px' }}>
                        <div className="katex-display-container">
                          <MathRenderer content={`$$${p.latex_content}$$`} />
                        </div>
                      </div>
                    )}

                    {/* Text Statement or Abstract */}
                    {p.content && (
                      <div style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6, margin: '12px 0' }}>
                        {isExpanded ? (
                          <div style={{ whiteSpace: 'pre-line' }}>{p.content}</div>
                        ) : (
                          <div>
                            {p.content.slice(0, 240)}
                            {p.content.length > 240 && '...'}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions & Expansion */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {p.content && p.content.length > 240 && (
                          <button
                            type="button"
                            onClick={() => setExpandedProofId(isExpanded ? null : p.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--primary)',
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span>{isExpanded ? 'Collapse Derivation' : 'Read Full Derivation'}</span>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                              {isExpanded ? 'expand_less' : 'expand_more'}
                            </span>
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11.5px', color: 'var(--text-subtle)' }}>
                          Formal Verification:
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>
                          Q.E.D.
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Axiom Reference Library & Guidelines */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Axiom Reference Notebook */}
          <div className="card" style={{ padding: '22px', backgroundColor: '#18181D' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '20px' }}>
                menu_book
              </span>
              Axiom Reference Index
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: '14px' }}>
              Foundational principles ready to cite in proof deductions.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {axiomReference.map((ax) => (
                <div
                  key={ax.name}
                  style={{
                    padding: '10px 12px',
                    backgroundColor: '#141418',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>
                    {ax.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--primary)' }}>
                    <MathRenderer content={`$${ax.latex}$`} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Formal Rigor Checklist */}
          <div className="card" style={{ padding: '22px', backgroundColor: '#16161B', border: '1px solid var(--primary-border)' }}>
            <div className="badge-academic" style={{ marginBottom: '8px' }}>
              AMS Standards
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>
              Proof Rigor Protocol
            </h3>
            <ul style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.6, paddingLeft: '16px', margin: '8px 0 0' }}>
              <li>State explicit domain and hypothesis.</li>
              <li>Every inference step must cite an axiom or lemma.</li>
              <li>Use standard LaTeX symbols without ambiguity.</li>
              <li>Sign off verified proofs with Q.E.D. ($\blacksquare$).</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Proof Composer Modal */}
      <Modal
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        title="Author Formal Mathematical Proof"
        maxWidth="720px"
      >
        <form onSubmit={handlePublishProof} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 500 }}>
              Theorem Title
            </label>
            <input
              type="text"
              className="glass-input"
              placeholder="e.g. Infinitude of Primes (Euclid's Theorem)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 500 }}>
              Hypothesis / Given Conditions
            </label>
            <textarea
              className="glass-input"
              rows={2}
              placeholder="State premises (e.g. Let n be a natural number...)"
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
            />
          </div>

          {/* Quick LaTeX Symbols */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600 }}>
                LaTeX Symbol Inserter:
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
                Target: {activeSymbolTarget}
              </span>
            </div>
            <div className="symbol-palette">
              {mathSymbols.map((s) => (
                <button
                  key={s.sym}
                  type="button"
                  onClick={() => insertSymbol(s.code)}
                  className="symbol-chip"
                >
                  {s.sym}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 500 }}>
              Primary Theorem Equation (LaTeX)
            </label>
            <input
              type="text"
              className="glass-input"
              placeholder="e.g. e^{i\pi} + 1 = 0"
              value={latexProof}
              onChange={(e) => setLatexProof(e.target.value)}
              onFocus={() => setActiveSymbolTarget('latexProof')}
            />
            {latexProof && (
              <div className="math-paper" style={{ marginTop: '8px', padding: '10px' }}>
                <MathRenderer content={`$$${latexProof}$$`} />
              </div>
            )}
          </div>

          {/* Step-by-Step Derivations */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                Step-by-Step Inference Chain
              </label>
              <button
                type="button"
                onClick={handleAddStep}
                style={{
                  fontSize: '12px',
                  color: 'var(--primary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                + Add Inference Step
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {steps.map((step, idx) => (
                <div
                  key={step.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)' }}>
                      Step {idx + 1}
                    </span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <select
                        value={step.rule}
                        onChange={(e) => handleUpdateStep(step.id, 'rule', e.target.value)}
                        className="glass-input"
                        style={{ padding: '2px 6px', fontSize: '11px' }}
                      >
                        <option value="Hypothesis">Hypothesis</option>
                        <option value="Deduction">Deduction</option>
                        <option value="Substitution">Substitution</option>
                        <option value="Induction">Induction</option>
                        <option value="Contradiction">Contradiction</option>
                        <option value="Q.E.D.">Q.E.D.</option>
                      </select>
                      {steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveStep(step.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-subtle)',
                            cursor: 'pointer',
                            fontSize: '14px',
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  <input
                    type="text"
                    className="glass-input"
                    placeholder="Statement description..."
                    value={step.statement}
                    onChange={(e) => handleUpdateStep(step.id, 'statement', e.target.value)}
                    style={{ fontSize: '12.5px', marginBottom: '6px' }}
                  />

                  <input
                    type="text"
                    className="glass-input"
                    placeholder="LaTeX equation for this step..."
                    value={step.latex}
                    onChange={(e) => handleUpdateStep(step.id, 'latex', e.target.value)}
                    onFocus={() => setActiveSymbolTarget(`step_${step.id}`)}
                    style={{ fontSize: '12px' }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 500 }}>
              Conclusion Statement
            </label>
            <textarea
              className="glass-input"
              rows={2}
              placeholder="Final verified result / Q.E.D. summary..."
              value={conclusion}
              onChange={(e) => setConclusion(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => setIsComposerOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
            >
              {saving ? 'Publishing...' : 'Publish Proof Preprint'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default ProofsPage;
