import type { ReactNode } from 'react';
import './search-highlight.css';

/** Wraps every case-insensitive occurrence of `query` in `text` with <mark>. */
export function highlightQueryInText(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;

  const lowerTitle = text.toLowerCase();
  const lowerQ = q.toLowerCase();
  const out: ReactNode[] = [];
  let pos = 0;
  let key = 0;

  while (pos < text.length) {
    const idx = lowerTitle.indexOf(lowerQ, pos);
    if (idx === -1) {
      out.push(text.slice(pos));
      break;
    }
    if (idx > pos) out.push(text.slice(pos, idx));
    out.push(
      <mark className="search-query-highlight" key={`h-${key++}`}>
        {text.slice(idx, idx + q.length)}
      </mark>
    );
    pos = idx + q.length;
  }

  return <>{out}</>;
}
