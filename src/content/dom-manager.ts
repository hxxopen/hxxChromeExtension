import type { DisplayMode } from '../common/types';

export const UNIT_CLASS = 'hxxtranslate-unit';
export const ORIGINAL_CLASS = 'hxxtranslate-original';
export const TRANSLATION_CLASS = 'hxxtranslate-translation';

const STYLE_ID = 'hxxtranslate-style';
const ORIGINAL_ATTR = 'data-hxx-original';
const TRANSLATED_ATTR = 'data-hxx-translated';
const FOR_ATTR = 'data-hxx-for';

export function ensureStyles(): void {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.documentElement.appendChild(style);
  }
  style.textContent = `
    .hxxtranslate-unit {
      max-width: 100%;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    /* 兼容极旧：内部双 span 结构 */
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
    /* 对照模式：译文挂在原块后面，绝不隐藏原文（避免整页空白） */
    .hxxtranslate-translation {
      display: block;
      margin: 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
      max-width: 100%;
    }
    .hxxtranslate-bilingual .hxxtranslate-unit + .hxxtranslate-translation,
    .hxxtranslate-bilingual .hxxtranslate-unit > .hxxtranslate-translation {
      margin-top: 0.35em;
      opacity: 0.96;
    }
    /* 仅译文模式不展示对照兄弟节点 */
    .hxxtranslate-only-translation .hxxtranslate-unit + .hxxtranslate-translation {
      display: none !important;
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

function currentMode(): DisplayMode {
  return document.documentElement.classList.contains('hxxtranslate-bilingual')
    ? 'bilingual'
    : 'translation';
}

export function applyDisplayMode(mode: DisplayMode): void {
  ensureStyles();
  const root = document.documentElement;
  root.classList.toggle('hxxtranslate-only-translation', mode === 'translation');
  root.classList.toggle('hxxtranslate-bilingual', mode === 'bilingual');
  document.querySelectorAll(`.${UNIT_CLASS}`).forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    if (!node.getAttribute(TRANSLATED_ATTR)) return;
    paintUnit(node, mode);
  });
}

function translationTagFor(el: HTMLElement): string {
  const tag = el.tagName;
  if (tag === 'LI' || tag === 'DT' || tag === 'DD' || tag === 'TD' || tag === 'TH') {
    return tag.toLowerCase();
  }
  return 'div';
}

function findSiblingTranslation(el: HTMLElement): HTMLElement | null {
  const id = el.dataset.hxxId;
  const next = el.nextElementSibling;
  if (next instanceof HTMLElement && next.classList.contains(TRANSLATION_CLASS)) {
    if (!id || next.getAttribute(FOR_ATTR) === id || !next.getAttribute(FOR_ATTR)) {
      return next;
    }
  }
  if (id) {
    const byFor = document.querySelector(`.${TRANSLATION_CLASS}[${FOR_ATTR}="${CSS.escape(id)}"]`);
    if (byFor instanceof HTMLElement) return byFor;
  }
  return null;
}

function removeSiblingTranslation(el: HTMLElement): void {
  findSiblingTranslation(el)?.remove();
}

function ensureSiblingTranslation(el: HTMLElement, id: string, text: string): HTMLElement {
  let translation = findSiblingTranslation(el);
  if (!translation) {
    translation = document.createElement(translationTagFor(el));
    translation.className = TRANSLATION_CLASS;
    translation.setAttribute(FOR_ATTR, id);
    try {
      const ws = window.getComputedStyle(el).whiteSpace;
      if (ws && ws !== 'normal') translation.style.whiteSpace = ws;
    } catch {
      /* ignore */
    }
    el.after(translation);
  }
  translation.setAttribute(FOR_ATTR, id);
  translation.textContent = text;
  translation.hidden = false;
  return translation;
}

/** 是否为旧版内部双 span 结构 */
function isLegacyWrapped(el: HTMLElement): boolean {
  return !!el.querySelector(`:scope > .${ORIGINAL_CLASS}`);
}

/**
 * 把可见文案写成 text（保留元素本身，不 display:none）。
 * 叶子块上的行内标签会被扁平化，这是整页翻译的常见取舍。
 */
function writeVisibleText(el: HTMLElement, text: string): void {
  if (isLegacyWrapped(el)) {
    const orig = el.querySelector(`:scope > .${ORIGINAL_CLASS}`) as HTMLElement | null;
    const trans = el.querySelector(`:scope > .${TRANSLATION_CLASS}`) as HTMLElement | null;
    if (orig) orig.textContent = text;
    if (trans) {
      trans.textContent = text;
      trans.hidden = false;
    }
    return;
  }
  el.textContent = text;
}

function paintUnit(el: HTMLElement, mode: DisplayMode): void {
  const original = el.getAttribute(ORIGINAL_ATTR) ?? '';
  const translated = el.getAttribute(TRANSLATED_ATTR) ?? '';
  if (!translated) return;

  if (isLegacyWrapped(el)) {
    const orig = el.querySelector(`:scope > .${ORIGINAL_CLASS}`) as HTMLElement | null;
    const trans = el.querySelector(`:scope > .${TRANSLATION_CLASS}`) as HTMLElement | null;
    if (orig) orig.textContent = original;
    if (trans) {
      trans.textContent = translated;
      trans.hidden = false;
    }
    return;
  }

  const id = el.dataset.hxxId || '';
  if (mode === 'bilingual') {
    writeVisibleText(el, original);
    if (id && translated) ensureSiblingTranslation(el, id, translated);
  } else {
    removeSiblingTranslation(el);
    writeVisibleText(el, translated);
  }
}

/**
 * 仅标记单元并记下原文，不改 DOM 结构、不隐藏、不插入空译文节点。
 */
export function wrapBlock(el: HTMLElement, id: string): HTMLElement {
  if (el.classList.contains(TRANSLATION_CLASS)) return el;
  if (el.closest(`.${UNIT_CLASS}`) && !el.classList.contains(UNIT_CLASS)) return el;

  if (el.classList.contains(UNIT_CLASS) && el.dataset.hxxId) {
    el.dataset.hxxId = id;
    if (!el.getAttribute(ORIGINAL_ATTR)) {
      el.setAttribute(ORIGINAL_ATTR, (el.innerText || '').trim());
    }
    return el;
  }

  if (isLegacyWrapped(el)) {
    el.dataset.hxxId = id;
    el.classList.add(UNIT_CLASS);
    if (!el.getAttribute(ORIGINAL_ATTR)) {
      const orig = el.querySelector(`:scope > .${ORIGINAL_CLASS}`) as HTMLElement | null;
      el.setAttribute(ORIGINAL_ATTR, ((orig || el).innerText || '').trim());
    }
    return el;
  }

  const text = (el.innerText || '').trim();
  el.classList.add(UNIT_CLASS);
  el.dataset.hxxId = id;
  el.setAttribute(ORIGINAL_ATTR, text);
  return el;
}

export function setTranslation(el: HTMLElement, text: string): void {
  const trimmed = (text || '').trim();
  if (!trimmed) return; // 绝不写入空译文，避免页面被掏空

  el.setAttribute(TRANSLATED_ATTR, trimmed);
  if (!el.getAttribute(ORIGINAL_ATTR)) {
    el.setAttribute(ORIGINAL_ATTR, (el.innerText || '').trim());
  }
  paintUnit(el, currentMode());
}

export function originalText(el: HTMLElement): string {
  const stored = el.getAttribute(ORIGINAL_ATTR);
  if (stored) return stored.replace(/\s+/g, ' ').trim();
  const orig = el.querySelector(`:scope > .${ORIGINAL_CLASS}`) as HTMLElement | null;
  return ((orig || el).innerText || '').replace(/\s+/g, ' ').trim();
}

/** 框架把文案改回原文时，重新刷上译文 */
export function reapplyIfReverted(el: HTMLElement): boolean {
  const original = el.getAttribute(ORIGINAL_ATTR);
  const translated = el.getAttribute(TRANSLATED_ATTR);
  if (!original || !translated) return false;
  if (currentMode() !== 'translation') return false;

  const now = (el.innerText || '').replace(/\s+/g, ' ').trim();
  const origNorm = original.replace(/\s+/g, ' ').trim();
  const transNorm = translated.replace(/\s+/g, ' ').trim();
  if (now === origNorm && now !== transNorm) {
    writeVisibleText(el, translated);
    return true;
  }
  return false;
}

export function reapplyAllReverted(): void {
  document.querySelectorAll(`.${UNIT_CLASS}`).forEach((node) => {
    if (node instanceof HTMLElement) reapplyIfReverted(node);
  });
}

export function restorePage(): void {
  document.querySelectorAll(`.${UNIT_CLASS}`).forEach((unit) => {
    const el = unit as HTMLElement;
    const original = el.getAttribute(ORIGINAL_ATTR);

    if (isLegacyWrapped(el)) {
      const orig = el.querySelector(`:scope > .${ORIGINAL_CLASS}`);
      const nestedTrans = el.querySelector(`:scope > .${TRANSLATION_CLASS}`);
      if (orig) {
        while (orig.firstChild) {
          el.insertBefore(orig.firstChild, orig);
        }
        orig.remove();
      }
      nestedTrans?.remove();
    } else if (original != null) {
      writeVisibleText(el, original);
    }

    removeSiblingTranslation(el);
    el.classList.remove(UNIT_CLASS);
    el.removeAttribute(ORIGINAL_ATTR);
    el.removeAttribute(TRANSLATED_ATTR);
    el.style.removeProperty('display');
    delete el.dataset.hxxId;
  });

  document.querySelectorAll(`.${TRANSLATION_CLASS}`).forEach((n) => n.remove());
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

export function unitHasTranslation(el: HTMLElement): boolean {
  return !!(el.getAttribute(TRANSLATED_ATTR) || '').trim();
}
