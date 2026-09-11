import React, { useMemo } from 'react';
import katex from 'katex';

/**
 * MathRenderer parses text with inline ($...$) and block ($$...$$) math
 * or directly renders pure LaTeX equations.
 */
export function MathRenderer({ content, displayMode = false, className = '' }) {
  const renderedHtml = useMemo(() => {
    if (!content) return '';

    // If pure display mode is requested for raw formula
    if (displayMode) {
      try {
        return katex.renderToString(content, {
          displayMode: true,
          throwOnError: false,
        });
      } catch {
        return content;
      }
    }

    // Otherwise parse mixed markdown/text with $inline$ and $$block$$ math
    const text = String(content);
    
    // First replace block math $$ ... $$
    let parsed = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
      try {
        const rendered = katex.renderToString(math.trim(), {
          displayMode: true,
          throwOnError: false,
        });
        return `<div class="math-block">${rendered}</div>`;
      } catch {
        return `$$${math}$$`;
      }
    });

    // Then replace inline math $ ... $
    parsed = parsed.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
      try {
        const rendered = katex.renderToString(math.trim(), {
          displayMode: false,
          throwOnError: false,
        });
        return `<span class="math-inline">${rendered}</span>`;
      } catch {
        return `$${math}$`;
      }
    });

    return parsed;
  }, [content, displayMode]);

  return (
    <div
      className={`math-content ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
}

export default MathRenderer;
