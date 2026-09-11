import React, { useRef, useState, useEffect } from 'react';

export function WhiteboardModal({ group, onClose }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pen'); // 'pen' | 'eraser'
  const [color, setColor] = useState('#E5A93C'); // Warm Gold
  const [lineWidth, setLineWidth] = useState(3);
  const [history, setHistory] = useState([]);

  const academicColors = [
    { name: 'Warm Gold', value: '#E5A93C' },
    { name: 'Pure Ivory', value: '#F5F5F7' },
    { name: 'Slate Gray', value: '#94A3B8' },
    { name: 'Crimson Accent', value: '#F87171' },
    { name: 'Amber Amber', value: '#F59E0B' },
  ];

  const quickFormulas = [
    { label: "Euler's Identity", text: "e^{iπ} + 1 = 0" },
    { label: "Gaussian Integral", text: "∫ e^{-x²} dx = √π" },
    { label: "Riemann Zeta", text: "ζ(s) = ∑ 1/nˢ" },
    { label: "Cauchy-Schwarz", text: "|⟨u, v⟩|² ≤ ⟨u, u⟩ ⟨v, v⟩" },
    { label: "Pythagorean", text: "a² + b² = c²" },
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Handle high-DPI screens
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    // Initial dark chalkboard canvas background
    ctx.fillStyle = '#141418';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw subtle coordinate grid lines
    ctx.strokeStyle = '#1F1F26';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < rect.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, rect.height);
      ctx.stroke();
    }
    for (let y = 0; y < rect.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
      ctx.stroke();
    }

    saveState();
  }, []);

  const saveState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setHistory((prev) => [...prev.slice(-15), canvas.toDataURL()]);
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'eraser') {
      ctx.strokeStyle = '#141418';
    } else {
      ctx.strokeStyle = color;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveState();
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#141418';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Redraw grid
    ctx.strokeStyle = '#1F1F26';
    ctx.lineWidth = 1;
    for (let x = 0; x < rect.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, rect.height);
      ctx.stroke();
    }
    for (let y = 0; y < rect.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
      ctx.stroke();
    }
    saveState();
  };

  const handleInsertFormula = (formulaText) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();

    const x = 50 + Math.random() * (rect.width - 240);
    const y = 80 + Math.random() * (rect.height - 160);

    ctx.save();
    ctx.font = 'bold 20px "KaTeX_Main", "Times New Roman", serif';
    ctx.fillStyle = color;
    ctx.fillText(formulaText, x, y);
    ctx.restore();
    saveState();
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `mathify-seminar-proof-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(10, 10, 14, 0.88)',
        backdropFilter: 'blur(10px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '1080px',
          height: '88vh',
          maxHeight: '780px',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#16161B',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#141418',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: 'var(--primary-subtle)',
                border: '1px solid var(--primary-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>draw</span>
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
                Synchronous Mathematical Whiteboard
              </h3>
              <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)' }}>
                {group?.name || 'Seminar Collaboration Room'} &bull; Real-Time Canvas
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleExport}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px' }}
              title="Download Snapshot PNG"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span>
              Export Snapshot
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-subtle)',
                cursor: 'pointer',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
            </button>
          </div>
        </div>

        {/* Whiteboard Toolbar */}
        <div
          style={{
            padding: '10px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#18181D',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {/* Tool Selector & Colors */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Pen / Eraser toggle */}
            <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <button
                onClick={() => setTool('pen')}
                style={{
                  padding: '6px 12px',
                  backgroundColor: tool === 'pen' ? 'var(--primary)' : '#202028',
                  color: tool === 'pen' ? '#0F0F12' : 'var(--text)',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>edit</span>
                Pen
              </button>
              <button
                onClick={() => setTool('eraser')}
                style={{
                  padding: '6px 12px',
                  backgroundColor: tool === 'eraser' ? 'var(--primary)' : '#202028',
                  color: tool === 'eraser' ? '#0F0F12' : 'var(--text)',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>ink_eraser</span>
                Eraser
              </button>
            </div>

            {/* Colors */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {academicColors.map((c) => (
                <button
                  key={c.name}
                  onClick={() => {
                    setColor(c.value);
                    setTool('pen');
                  }}
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    backgroundColor: c.value,
                    border: color === c.value && tool === 'pen' ? '2px solid #FFFFFF' : '1px solid var(--border)',
                    boxShadow: color === c.value && tool === 'pen' ? `0 0 8px ${c.value}` : 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  title={c.name}
                />
              ))}
            </div>

            {/* Stroke Width */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>Width:</span>
              {[2, 4, 8].map((w) => (
                <button
                  key={w}
                  onClick={() => setLineWidth(w)}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '4px',
                    backgroundColor: lineWidth === w ? 'var(--primary-subtle)' : '#202028',
                    border: lineWidth === w ? '1px solid var(--primary-border)' : '1px solid var(--border)',
                    color: lineWidth === w ? 'var(--primary)' : 'var(--text-subtle)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {w}px
                </button>
              ))}
            </div>
          </div>

          {/* Quick LaTeX Formula Stamps */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>Stamp Formula:</span>
            {quickFormulas.map((q) => (
              <button
                key={q.label}
                onClick={() => handleInsertFormula(q.text)}
                className="symbol-chip"
                style={{ fontSize: '11.5px', padding: '3px 8px' }}
                title={`Stamp ${q.label}`}
              >
                {q.text}
              </button>
            ))}

            <button
              onClick={handleClear}
              className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: '11.5px', marginLeft: '8px' }}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}>
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
            }}
          />
        </div>
      </div>
    </div>
  );
}
