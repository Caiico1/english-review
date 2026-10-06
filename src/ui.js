// Utilidades mínimas de DOM.

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Texto de las lecciones: **así** se resalta la estructura. Devuelve un <span>. */
export function rich(text, tag = 'span', cls) {
  const html = escapeHtml(text ?? '').replace(/\*\*(.+?)\*\*/g, '<mark>$1</mark>');
  return h(tag, { html, class: cls });
}

export const plain = (text) => String(text ?? '').replace(/\*\*/g, '');

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function progressBar(value, max, label) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return h('div', {
    class: 'bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(max),
    'aria-valuenow': String(value), 'aria-label': label,
  }, h('div', { class: 'bar-fill', style: `width:${pct}%` }));
}

export function backLink(href, text) {
  return h('a', { class: 'back', href }, '← ', text);
}
