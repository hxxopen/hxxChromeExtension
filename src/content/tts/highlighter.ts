const HIGHLIGHT_CLASS = 'hxx-tts-highlight';
const STYLE_ID = 'hxx-tts-highlight-style';

export function ensureHighlightStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .${HIGHLIGHT_CLASS} {
      background: rgba(59, 130, 246, 0.15) !important;
      outline: none;
      box-shadow: inset 3px 0 0 #3b82f6;
      border-radius: 0 6px 6px 0;
      transition: background 0.15s ease;
    }
  `;
  document.documentElement.appendChild(style);
}

let currentEl: HTMLElement | null = null;

export function clearHighlight(): void {
  document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((n) => n.classList.remove(HIGHLIGHT_CLASS));
  currentEl = null;
}

export function highlightElement(el: HTMLElement | null, enabled: boolean): void {
  clearHighlight();
  if (!enabled || !el || !el.isConnected) return;
  ensureHighlightStyles();
  el.classList.add(HIGHLIGHT_CLASS);
  currentEl = el;
  try {
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  } catch {
    /* ignore */
  }
}

export function getHighlightedElement(): HTMLElement | null {
  return currentEl;
}
