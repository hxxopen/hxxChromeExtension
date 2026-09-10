import type { DisplayMode } from '../common/types';

export const UNIT_CLASS = 'hxxtranslate-unit';
export const ORIGINAL_CLASS = 'hxxtranslate-original';
export const TRANSLATION_CLASS = 'hxxtranslate-translation';

const STYLE_ID = 'hxxtranslate-style';

export function ensureStyles(): void {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.documentElement.appendChild(style);
  }
  // 每次刷新，便于热更新后覆盖旧样式
  style.textContent = `
    .hxxtranslate-unit {
      max-width: 100%;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .hxxtranslate-unit > .hxxtranslate-original,
    .hxxtranslate-unit > .hxxtranslate-translation {
      position: static !important;
      float: none !important;
      inset: auto !important;
      transform: none !important;
      max-width: 100%;
    }
    .hxxtranslate-only-translation .hxxtranslate-unit > .hxxtranslate-original {
      display: none !important;
    }
    .hxxtranslate-bilingual .hxxtranslate-unit > .hxxtranslate-original {
      display: revert;
    }
    .hxxtranslate-unit > .hxxtranslate-translation {
      display: block;
      margin: 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .hxxtranslate-bilingual .hxxtranslate-unit > .hxxtranslate-translation {
      margin-top: 0.35em;
      opacity: 0.96;
    }
    #hxxtranslate-progress {
      position: fixed;
      z-index: 2147483646;
      right: 16px;
      bottom: 16px;
      background: #1677ff;
      color: #fff;
      font: 13px/1.4 system-ui, sans-serif;
      padding: 10px 14px;
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
      max-width: 240px;
    }
  `;
}

export function applyDisplayMode(mode: DisplayMode): void {
  ensureStyles();
  const root = document.documentElement;
  root.classList.toggle('hxxtranslate-only-translation', mode === 'translation');
  root.classList.toggle('hxxtranslate-bilingual', mode === 'bilingual');
}

export function wrapBlock(el: HTMLElement, id: string): HTMLElement {
  if (el.classList.contains(UNIT_CLASS) || el.querySelector(`:scope > .${ORIGINAL_CLASS}`)) {
    el.dataset.hxxId = id;
    return el;
  }
  // 已在其他翻译单元内部：不再二次包裹，避免叠字
  if (el.closest(`.${UNIT_CLASS}`)) {
    return el;
  }
  const original = document.createElement('span');
  original.className = ORIGINAL_CLASS;
  while (el.firstChild) {
    original.appendChild(el.firstChild);
  }
  const translation = document.createElement('span');
  translation.className = TRANSLATION_CLASS;
  translation.hidden = true;
  el.classList.add(UNIT_CLASS);
  el.dataset.hxxId = id;
  el.appendChild(original);
  el.appendChild(translation);
  return el;
}

export function setTranslation(el: HTMLElement, text: string): void {
  const trans = el.querySelector(`:scope > .${TRANSLATION_CLASS}`) as HTMLElement | null;
  if (!trans) return;
  trans.textContent = text;
  trans.hidden = false;
}

export function originalText(el: HTMLElement): string {
  const orig = el.querySelector(`:scope > .${ORIGINAL_CLASS}`) as HTMLElement | null;
  return ((orig || el).innerText || '').replace(/\s+/g, ' ').trim();
}

export function restorePage(): void {
  document.querySelectorAll(`.${UNIT_CLASS}`).forEach((unit) => {
    const orig = unit.querySelector(`:scope > .${ORIGINAL_CLASS}`);
    const trans = unit.querySelector(`:scope > .${TRANSLATION_CLASS}`);
    if (orig) {
      while (orig.firstChild) {
        unit.insertBefore(orig.firstChild, orig);
      }
      orig.remove();
    }
    trans?.remove();
    unit.classList.remove(UNIT_CLASS);
    if (unit instanceof HTMLElement) {
      delete unit.dataset.hxxId;
    }
  });
  document.documentElement.classList.remove('hxxtranslate-only-translation', 'hxxtranslate-bilingual');
  document.getElementById('hxxtranslate-progress')?.remove();
}

export function isRestrictedPage(): boolean {
  const href = location.href;
  return (
    href.startsWith('chrome://') ||
    href.startsWith('chrome-extension://') ||
    href.startsWith('edge://') ||
    href.startsWith('about:')
  );
}
