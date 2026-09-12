import React, { useMemo } from 'react';
import katex from 'katex';

/**
 * Escapes HTML characters in regular text to prevent XSS.
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Renders LaTeX using KaTeX safely without throwing errors.
 */
function renderKatexSafe(formula, isDisplay) {
  try {
    let clean = formula.trim();
    // KaTeX prefers \begin{aligned} over \begin{align}
    clean = clean.replace(/\\begin\{align\*?\}/g, '\\begin{aligned}');
    clean = clean.replace(/\\end\{align\*?\}/g, '\\end{aligned}');
    clean = clean.replace(/\\begin\{equation\*?\}/g, '\\begin{aligned}');
    clean = clean.replace(/\\end\{equation\*?\}/g, '\\end{aligned}');
    clean = clean.replace(/\\begin\{gather\*?\}/g, '\\begin{gathered}');
    clean = clean.replace(/\\end\{gather\*?\}/g, '\\end{gathered}');

    return katex.renderToString(clean, {
      displayMode: isDisplay,
      throwOnError: false,
      trust: false,
      strict: false,
    });
  } catch (err) {
    console.warn('KaTeX render error:', err);
    return `<code class="math-fallback">${escapeHtml(formula)}</code>`;
  }
}

/**
 * MathRenderer parses text with inline math ($...$, \(...\)),
 * block math ($$...$$, \[...\], \begin{...}...\end{...}),
 * and markdown elements (bold, italic, headers, dividers, quotes, lists),
 * rendering publication-grade equations and clean academic typesetting.
 */
export function MathRenderer({ content, displayMode = false, className = '' }) {
  const renderedHtml = useMemo(() => {
    if (!content) return '';

    // If pure display mode is requested for raw formula
    if (displayMode) {
      return renderKatexSafe(String(content), true);
    }

    const text = String(content);
    const tokens = [];

    const saveToken = (rendered) => {
      const id = `%%%MATH_TOKEN_${tokens.length}%%%`;
      tokens.push(rendered);
      return id;
    };

    let processed = text;

    // 1. Extract markdown code blocks with latex/math: ```latex ... ``` or ```math ... ```
    processed = processed.replace(/```(?:latex|math)\r?\n([\s\S]*?)```/gi, (_, math) => {
      const rendered = renderKatexSafe(math, true);
      return saveToken(`<div class="math-block">${rendered}</div>`);
    });

    // 2. Extract general code blocks: ```...```
    processed = processed.replace(/```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g, (_, lang, code) => {
      return saveToken(`<pre class="math-code-block"><code>${escapeHtml(code)}</code></pre>`);
    });

    // 3. Extract standard LaTeX environments: \begin{env} ... \end{env}
    processed = processed.replace(
      /\\begin\{(aligned|align\*?|equation\*?|gather\*?|matrix|pmatrix|bmatrix|vmatrix|cases)\}([\s\S]*?)\\end\{\1\}/g,
      (match) => {
        const rendered = renderKatexSafe(match, true);
        return saveToken(`<div class="math-block">${rendered}</div>`);
      }
    );

    // 4. Extract display math $$ ... $$
    processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
      const rendered = renderKatexSafe(math, true);
      return saveToken(`<div class="math-block">${rendered}</div>`);
    });

    // 5. Extract display math \[ ... \]
    processed = processed.replace(/\\\[([\s\S]+?)\\\]/g, (_, math) => {
      const rendered = renderKatexSafe(math, true);
      return saveToken(`<div class="math-block">${rendered}</div>`);
    });

    // 6. Extract inline math \( ... \)
    processed = processed.replace(/\\\(([\s\S]+?)\\\)/g, (_, math) => {
      const rendered = renderKatexSafe(math, false);
      return saveToken(`<span class="math-inline">${rendered}</span>`);
    });

    // 7. Extract inline math $ ... $ (handling multichar expressions, escaping \$)
    processed = processed.replace(/(^|[^\\])\$([^\$\n\r]+?)\$/g, (match, prefix, math) => {
      if (!math.trim()) return match;
      const rendered = renderKatexSafe(math, false);
      return `${prefix}${saveToken(`<span class="math-inline">${rendered}</span>`)}`;
    });

    // 8. Format regular markdown text
    const parts = processed.split(/(%%%MATH_TOKEN_\d+%%%)/g);
    const formattedParts = parts.map((part) => {
      if (part.startsWith('%%%MATH_TOKEN_') && part.endsWith('%%%')) {
        return part;
      }

      let t = escapeHtml(part);

      // Horizontal rules: --- or *** or ___ on their own line
      t = t.replace(/^(?:---|___|\*\*\*)\s*$/gm, '<hr class="math-divider" />');

      // Headings
      t = t.replace(/^#### (.*?)$/gm, '<h5 class="math-h5">$1</h5>');
      t = t.replace(/^### (.*?)$/gm, '<h4 class="math-h4">$1</h4>');
      t = t.replace(/^## (.*?)$/gm, '<h3 class="math-h3">$1</h3>');
      t = t.replace(/^# (.*?)$/gm, '<h2 class="math-h2">$1</h2>');

      // Blockquotes: > quote
      t = t.replace(/^&gt; (.*?)$/gm, '<blockquote class="math-quote">$1</blockquote>');

      // Unordered lists: - item or * item or bullet
      t = t.replace(/^[•\-\*]\s+(.*?)$/gm, '<div class="math-list-item"><span class="math-bullet">•</span> <span>$1</span></div>');

      // Markdown bold: **text**
      t = t.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');

      // Markdown italic: *text*
      t = t.replace(/(^|[^*])\*([^*]+?)\*/g, '$1<em>$2</em>');

      // Markdown inline code: `code`
      t = t.replace(/`([^`]+?)`/g, '<code class="math-inline-code">$1</code>');

      // Double newline to paragraph spacing
      t = t.replace(/\r?\n\r?\n/g, '<div class="math-paragraph-spacer"></div>');

      // Single newline to <br/>
      t = t.replace(/\r?\n/g, '<br/>');

      return t;
    });

    let finalHtml = formattedParts.join('');

    // 9. Reinsert all rendered math and code tokens
    tokens.forEach((rendered, idx) => {
      finalHtml = finalHtml.replace(`%%%MATH_TOKEN_${idx}%%%`, rendered);
    });

    return finalHtml;
  }, [content, displayMode]);

  return (
    <div
      className={`math-content ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
}

export default MathRenderer;
