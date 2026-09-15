import React, { useState, useEffect, useRef, useCallback } from 'react';

// Safe math evaluator for real-time mathematical plotting
function evaluateMathExpression(expr, variables = {}) {
  try {
    // Sanitize and replace math functions and constants
    let sanitized = expr
      .replace(/\s+/g, '')
      .replace(/\\sin/g, 'sin')
      .replace(/\\cos/g, 'cos')
      .replace(/\\tan/g, 'tan')
      .replace(/\\sqrt/g, 'sqrt')
      .replace(/\\exp/g, 'exp')
      .replace(/\\log/g, 'log')
      .replace(/\\ln/g, 'log')
      .replace(/\\pi/g, 'PI')
      .replace(/pi/gi, 'PI')
      .replace(/\\e\b/g, 'E')
      .replace(/\^/g, '**');

    // Handle implicit multiplication like 2x or 3sin(x)
    sanitized = sanitized
      .replace(/(\d+)([a-zA-Z(])/g, '$1*$2')
      .replace(/(\))([a-zA-Z0-9(])/g, '$1*$2');

    // Create function with Math scope
    const keys = Object.keys(variables);
    const values = Object.values(variables);

    const fn = new Function(
      'Math',
      ...keys,
      `
      const { sin, cos, tan, sqrt, exp, log, abs, pow, PI, E, min, max } = Math;
      try {
        const res = Number(${sanitized});
        return isFinite(res) ? res : NaN;
      } catch (e) {
        return NaN;
      }
      `
    );

    return fn(Math, ...values);
  } catch {
    return NaN;
  }
}

export function MathGraphStudio({ onSnapshot, initialMode = '2d' }) {
  const [mode, setMode] = useState(initialMode); // '2d' | '3d'
  const [expr2d, setExpr2d] = useState('sin(2*x) * exp(-0.15 * abs(x))');
  const [expr3d, setExpr3d] = useState('sin(sqrt(x*x + y*y)) / (sqrt(x*x + y*y) + 0.1)');
  const [xRange, setXRange] = useState({ min: -10, max: 10 });
  const [yRange, setYRange] = useState({ min: -6, max: 6 });
  const [resolution, setResolution] = useState(25); // 3D grid resolution
  const [copiedSnapshot, setCopiedSnapshot] = useState(false);

  // 3D rotation state (azimuth and elevation)
  const [rot, setRot] = useState({ yaw: 0.75, pitch: 0.55 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, yaw: 0.75, pitch: 0.55 });

  const canvasRef = useRef(null);

  const presets2d = [
    { label: 'Wave Packet', expr: 'sin(3*x) * exp(-0.1 * x*x)' },
    { label: 'Polynomial Roots', expr: '0.1 * (x + 4) * (x + 1) * (x - 2) * (x - 5)' },
    { label: 'Gaussian Bell', expr: '2.5 * exp(-0.5 * x*x)' },
    { label: 'Damped Oscillation', expr: '3 * exp(-0.3 * x) * cos(4 * x)' },
    { label: 'Sinc Function', expr: 'sin(x) / (x + 0.0001)' },
    { label: 'Rational Hyperbola', expr: '3 / (x*x + 1)' },
  ];

  const presets3d = [
    { label: 'Sinc Circular Ripple', expr: 'sin(sqrt(x*x + y*y)) / (sqrt(x*x + y*y) + 0.1)' },
    { label: 'Saddle (Hyperbolic Paraboloid)', expr: '(x*x - y*y) * 0.06' },
    { label: 'Elliptic Paraboloid', expr: '(x*x + y*y) * 0.05' },
    { label: 'Wave Intersections', expr: 'sin(x) * cos(y)' },
    { label: 'Gaussian Peak', expr: '2.5 * exp(-0.2 * (x*x + y*y))' },
    { label: 'Monkey Saddle', expr: '(x*x*x - 3*x*y*y) * 0.01' },
  ];

  // Render 2D Cartesian Function Plot
  const render2D = useCallback((ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#0F0F14';
    ctx.fillRect(0, 0, width, height);

    const xSpan = xRange.max - xRange.min;
    const ySpan = yRange.max - yRange.min;

    const toCanvasX = (x) => ((x - xRange.min) / xSpan) * width;
    const toCanvasY = (y) => height - ((y - yRange.min) / ySpan) * height;

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;

    // Vertical grid
    const xStep = Math.pow(10, Math.floor(Math.log10(xSpan))) / 2 || 1;
    for (let x = Math.ceil(xRange.min / xStep) * xStep; x <= xRange.max; x += xStep) {
      const cx = toCanvasX(x);
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, height);
      ctx.stroke();

      // Label
      if (Math.abs(x) > 0.001) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.font = '10px monospace';
        ctx.fillText(x.toFixed(1), cx + 3, toCanvasY(0) + 14);
      }
    }

    // Horizontal grid
    const yStep = Math.pow(10, Math.floor(Math.log10(ySpan))) / 2 || 1;
    for (let y = Math.ceil(yRange.min / yStep) * yStep; y <= yRange.max; y += yStep) {
      const cy = toCanvasY(y);
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(width, cy);
      ctx.stroke();

      // Label
      if (Math.abs(y) > 0.001) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.font = '10px monospace';
        ctx.fillText(y.toFixed(1), toCanvasX(0) + 6, cy - 3);
      }
    }

    // Axes
    ctx.strokeStyle = 'rgba(229, 169, 60, 0.6)';
    ctx.lineWidth = 1.5;

    // X-axis
    const originY = toCanvasY(0);
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(width, originY);
    ctx.stroke();

    // Y-axis
    const originX = toCanvasX(0);
    ctx.beginPath();
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, height);
    ctx.stroke();

    // Origin label
    ctx.fillStyle = 'var(--primary, #E5A93C)';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('0', originX - 12, originY + 14);

    // Plot Curve
    ctx.strokeStyle = '#60A5FA';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(96, 165, 250, 0.45)';
    ctx.shadowBlur = 8;
    ctx.beginPath();

    let isFirst = true;
    const samples = width * 1.5;
    const step = xSpan / samples;

    for (let i = 0; i <= samples; i++) {
      const x = xRange.min + i * step;
      const y = evaluateMathExpression(expr2d, { x });

      if (isNaN(y) || !isFinite(y)) {
        isFirst = true;
        continue;
      }

      const cx = toCanvasX(x);
      const cy = toCanvasY(y);

      // Clip jump discontinuities (like tan(x))
      if (cy < -height || cy > height * 2) {
        isFirst = true;
        continue;
      }

      if (isFirst) {
        ctx.moveTo(cx, cy);
        isFirst = false;
      } else {
        ctx.lineTo(cx, cy);
      }
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [expr2d, xRange, yRange]);

  // Render 3D Bivariate Surface Plot
  const render3D = useCallback((ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#0D0D12';
    ctx.fillRect(0, 0, width, height);

    const N = resolution;
    const xMin = -6;
    const xMax = 6;
    const yMin = -6;
    const yMax = 6;
    const dx = (xMax - xMin) / N;
    const dy = (yMax - yMin) / N;

    // Precompute grid vertices
    const grid = [];
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (let i = 0; i <= N; i++) {
      grid[i] = [];
      const x = xMin + i * dx;
      for (let j = 0; j <= N; j++) {
        const y = yMin + j * dy;
        const z = evaluateMathExpression(expr3d, { x, y });
        const valZ = isFinite(z) ? z : 0;
        grid[i][j] = { x, y, z: valZ };
        if (valZ < minZ) minZ = valZ;
        if (valZ > maxZ) maxZ = valZ;
      }
    }

    const zSpan = maxZ - minZ || 1;

    // 3D Rotation matrices (Yaw & Pitch)
    const cy = Math.cos(rot.yaw);
    const sy = Math.sin(rot.yaw);
    const cp = Math.cos(rot.pitch);
    const sp = Math.sin(rot.pitch);

    const scale = Math.min(width, height) * 0.045;
    const centerX = width / 2;
    const centerY = height / 2 + 10;

    // Project 3D point (x, y, z) to 2D canvas
    const project = (p) => {
      // Rotate around Z (Yaw)
      const x1 = p.x * cy - p.y * sy;
      const y1 = p.x * sy + p.y * cy;
      const z1 = p.z * 1.5;

      // Rotate around X (Pitch)
      const y2 = y1 * cp - z1 * sp;
      const z2 = y1 * sp + z1 * cp;

      return {
        px: centerX + x1 * scale,
        py: centerY - z2 * scale,
        depth: y2,
      };
    };

    // Build quads with depth sorting for proper occlusion
    const quads = [];
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const p00 = grid[i][j];
        const p10 = grid[i + 1][j];
        const p11 = grid[i + 1][j + 1];
        const p01 = grid[i][j + 1];

        const pr00 = project(p00);
        const pr10 = project(p10);
        const pr11 = project(p11);
        const pr01 = project(p01);

        const avgDepth = (pr00.depth + pr10.depth + pr11.depth + pr01.depth) / 4;
        const avgZ = (p00.z + p10.z + p11.z + p01.z) / 4;
        const normZ = Math.max(0, Math.min(1, (avgZ - minZ) / zSpan));

        quads.push({
          pts: [pr00, pr10, pr11, pr01],
          depth: avgDepth,
          normZ,
        });
      }
    }

    // Sort painters algorithm back-to-front
    quads.sort((a, b) => a.depth - b.depth);

    // Draw quads with color gradient (Indigo -> Cyan -> Gold)
    quads.forEach((q) => {
      const { pts, normZ } = q;

      // Interpolate color based on height Z
      const r = Math.round(30 + normZ * 195);
      const g = Math.round(90 + normZ * 110);
      const b = Math.round(220 - normZ * 160);

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.72)`;
      ctx.strokeStyle = `rgba(${Math.min(255, r + 40)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 40)}, 0.35)`;
      ctx.lineWidth = 0.8;

      ctx.beginPath();
      ctx.moveTo(pts[0].px, pts[0].py);
      ctx.lineTo(pts[1].px, pts[1].py);
      ctx.lineTo(pts[2].px, pts[2].py);
      ctx.lineTo(pts[3].px, pts[3].py);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    // Draw 3D Coordinates Orientation Indicator
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '11px sans-serif';
    ctx.fillText('Interactive 3D: Drag to rotate view', 14, height - 14);
  }, [expr3d, resolution, rot]);

  // Main draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    const w = rect.width || 640;
    const h = rect.height || 400;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    if (mode === '2d') {
      render2D(ctx, w, h);
    } else {
      render3D(ctx, w, h);
    }

    ctx.restore();
  }, [mode, render2D, render3D]);

  // Mouse & Touch 3D Drag Rotation
  const handlePointerDown = (e) => {
    if (mode !== '3d') return;
    setIsDragging(true);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      yaw: rot.yaw,
      pitch: rot.pitch,
    };
  };

  const handlePointerMove = (e) => {
    if (!isDragging || mode !== '3d') return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;

    setRot({
      yaw: dragStartRef.current.yaw + dx * 0.012,
      pitch: Math.max(0.1, Math.min(1.4, dragStartRef.current.pitch + dy * 0.012)),
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  // Zoom controls for 2D
  const handleZoom = (factor) => {
    setXRange((prev) => {
      const mid = (prev.min + prev.max) / 2;
      const span = (prev.max - prev.min) * factor;
      return { min: mid - span / 2, max: mid + span / 2 };
    });
    setYRange((prev) => {
      const mid = (prev.min + prev.max) / 2;
      const span = (prev.max - prev.min) * factor;
      return { min: mid - span / 2, max: mid + span / 2 };
    });
  };

  const handleResetView = () => {
    setXRange({ min: -10, max: 10 });
    setYRange({ min: -6, max: 6 });
    setRot({ yaw: 0.75, pitch: 0.55 });
  };

  // Export Snapshot
  const handleCaptureSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');

    if (onSnapshot) {
      onSnapshot({
        dataUrl,
        mode,
        expression: mode === '2d' ? expr2d : expr3d,
      });
      setCopiedSnapshot(true);
      setTimeout(() => setCopiedSnapshot(false), 2400);
    } else {
      // Fallback: download PNG
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `mathify_${mode}_plot.png`;
      a.click();
    }
  };

  return (
    <div className="card" style={{ padding: '20px', backgroundColor: '#141418', border: '1px solid var(--border)', borderRadius: '12px' }}>
      {/* Top Header & Mode Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: 'rgba(229, 169, 60, 0.15)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              {mode === '2d' ? 'show_chart' : 'view_in_ar'}
            </span>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
              Interactive Mathematical Graph Studio
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>
              {mode === '2d' ? '2D Cartesian Function Plotter' : '3D Bivariate Surface Renderer z = f(x, y)'}
            </span>
          </div>
        </div>

        {/* 2D / 3D Mode Switcher */}
        <div style={{ display: 'inline-flex', backgroundColor: '#1E1E26', borderRadius: '8px', padding: '3px', border: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => setMode('2d')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: mode === '2d' ? 'var(--primary)' : 'transparent',
              color: mode === '2d' ? '#000' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            2D Curves
          </button>
          <button
            type="button"
            onClick={() => setMode('3d')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: mode === '3d' ? 'var(--primary)' : 'transparent',
              color: mode === '3d' ? '#000' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            3D Surfaces
          </button>
        </div>
      </div>

      {/* Function Equation Input */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '14px', fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 700 }}>
            {mode === '2d' ? 'f(x) =' : 'z = f(x, y) ='}
          </span>
          <input
            type="text"
            className="glass-input"
            value={mode === '2d' ? expr2d : expr3d}
            onChange={(e) => (mode === '2d' ? setExpr2d(e.target.value) : setExpr3d(e.target.value))}
            placeholder={mode === '2d' ? 'e.g. sin(x) * exp(-0.1 * x*x)' : 'e.g. sin(x) * cos(y)'}
            style={{ flex: 1, minWidth: '220px', fontFamily: 'monospace', fontSize: '13.5px', padding: '9px 12px' }}
          />

          <button
            type="button"
            onClick={handleCaptureSnapshot}
            className="btn-primary"
            style={{ padding: '9px 14px', fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title="Export snapshot of this plot into your proof"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>
              {copiedSnapshot ? 'check' : 'add_photo_alternate'}
            </span>
            <span>{copiedSnapshot ? 'Snapshot Attached!' : 'Snapshot to Proof'}</span>
          </button>
        </div>

        {/* Quick Presets Pills */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-subtle)', alignSelf: 'center', flexShrink: 0, marginRight: '4px' }}>
            Presets:
          </span>
          {(mode === '2d' ? presets2d : presets3d).map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => (mode === '2d' ? setExpr2d(preset.expr) : setExpr3d(preset.expr))}
              className="symbol-chip"
              style={{ fontSize: '11px', padding: '3px 9px', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas Viewport Container */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '380px',
          borderRadius: '10px',
          overflow: 'hidden',
          border: '1px solid var(--border)',
          touchAction: mode === '3d' ? 'none' : 'auto',
          cursor: mode === '3d' ? (isDragging ? 'grabbing' : 'grab') : 'crosshair',
        }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      >
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

        {/* Floating Viewport Controls */}
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            right: '12px',
            display: 'flex',
            gap: '6px',
            backgroundColor: 'rgba(20, 20, 26, 0.85)',
            padding: '4px 6px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            backdropFilter: 'blur(6px)',
          }}
        >
          {mode === '2d' && (
            <>
              <button
                type="button"
                onClick={() => handleZoom(0.7)}
                className="btn-secondary"
                style={{ padding: '4px 8px', fontSize: '11px' }}
                title="Zoom In"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => handleZoom(1.4)}
                className="btn-secondary"
                style={{ padding: '4px 8px', fontSize: '11px' }}
                title="Zoom Out"
              >
                -
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleResetView}
            className="btn-secondary"
            style={{ padding: '4px 8px', fontSize: '11px' }}
            title="Reset Coordinates"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

export default MathGraphStudio;
