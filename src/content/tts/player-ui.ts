import { t } from '../../common/i18n';
import type { TtsEndMode, TtsPlaybackStatus } from '../../common/types';

const PLAYER_ID = 'hxx-tts-player';
const STYLE_ID = 'hxx-tts-player-style';

export type PlayerViewState = {
  status: TtsPlaybackStatus;
  index: number;
  total: number;
  preview: string;
  /** 当前段落朗读语言，用于字幕旁标注 */
  lang?: 'en' | 'zh';
  /** 段内当前朗读字符下标，用于字幕追踪高亮 */
  charIndex?: number;
  endMode?: TtsEndMode;
  rate: number;
  minimized?: boolean;
};

export type PlayerHandlers = {
  onPrev: () => void;
  onPauseResume: () => void;
  onNext: () => void;
  onReset: () => void;
  onStop: () => void;
  onClose: () => void;
  onRateChange: (rate: number) => void;
  onEndModeChange: (mode: TtsEndMode) => void;
  onPreviewClick?: () => void;
};

let root: HTMLElement | null = null;
let handlers: PlayerHandlers | null = null;
let dragging = false;
let dragOx = 0;
let dragOy = 0;

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${PLAYER_ID} {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 2147483644;
      width: 340px;
      background: #fff;
      border-radius: 14px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.15);
      border: 1px solid #e5e7eb;
      padding: 16px;
      font-family: "Segoe UI", system-ui, "PingFang SC", "Microsoft YaHei", sans-serif;
      color: #1f2937;
      user-select: none;
    }
    #${PLAYER_ID}.hxx-tts-min {
      width: 48px;
      height: 48px;
      padding: 0;
      border-radius: 9999px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      background: #3b82f6;
      color: #fff;
      border: none;
    }
    #${PLAYER_ID} .hxx-tts-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      cursor: grab;
    }
    #${PLAYER_ID} .hxx-tts-title {
      font-size: 13px;
      font-weight: 600;
      color: #3b82f6;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    #${PLAYER_ID} .hxx-tts-icon-btns {
      display: flex;
      gap: 4px;
    }
    #${PLAYER_ID} .hxx-tts-icon-btn {
      width: 24px;
      height: 24px;
      border: none;
      background: #f3f4f6;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      color: #6b7280;
      line-height: 1;
    }
    #${PLAYER_ID} .hxx-tts-icon-btn:hover { background: #e5e7eb; }
    #${PLAYER_ID} .hxx-tts-subtitle {
      margin-bottom: 14px;
    }
    #${PLAYER_ID} .hxx-tts-subtitle-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 6px;
      font-size: 11px;
      color: #64748b;
    }
    #${PLAYER_ID} .hxx-tts-lang-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.02em;
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
    }
    #${PLAYER_ID} .hxx-tts-lang-badge.zh {
      background: #f0fdf4;
      color: #15803d;
      border-color: #bbf7d0;
    }
    #${PLAYER_ID} .hxx-tts-preview {
      font-size: 14px;
      line-height: 1.55;
      background: #f8fafc;
      color: #0f172a;
      border-radius: 10px;
      padding: 12px 14px;
      max-height: 110px;
      overflow-y: auto;
      cursor: pointer;
      white-space: pre-wrap;
      word-break: break-word;
      border: 1px solid #e2e8f0;
    }
    #${PLAYER_ID} .hxx-tts-preview:empty::before {
      content: attr(data-placeholder);
      color: #94a3b8;
    }
    #${PLAYER_ID} .hxx-tts-spoken {
      color: #94a3b8;
    }
    #${PLAYER_ID} .hxx-tts-current {
      background: #fef08a;
      color: #854d0e;
      border-radius: 3px;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
      padding: 0 1px;
    }
    #${PLAYER_ID} .hxx-tts-upcoming {
      color: #0f172a;
    }
    #${PLAYER_ID} .hxx-tts-controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-bottom: 10px;
    }
    #${PLAYER_ID} .hxx-tts-ctrl {
      border: 1px solid #e5e7eb;
      background: #fff;
      border-radius: 999px;
      padding: 2px 10px;
      font-size: 11px;
      line-height: 1.4;
      cursor: pointer;
      color: #1f2937;
      font-weight: 500;
    }
    #${PLAYER_ID} .hxx-tts-ctrl.primary {
      background: #eff6ff;
      border-color: #bfdbfe;
      color: #1d4ed8;
      font-weight: 600;
    }
    #${PLAYER_ID} .hxx-tts-ctrl:disabled {
      opacity: 0.45;
      cursor: default;
    }
    #${PLAYER_ID} .hxx-tts-mode {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
      font-size: 11px;
      color: #6b7280;
    }
    #${PLAYER_ID} .hxx-tts-mode select {
      flex: 1;
      min-width: 0;
      appearance: none;
      border: 1px solid #bfdbfe;
      background: #eff6ff;
      color: #1d4ed8;
      border-radius: 999px;
      padding: 2px 24px 2px 10px;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.4;
      cursor: pointer;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%231d4ed8' d='M1 1l4 4 4-4'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 10px center;
    }
    #${PLAYER_ID} .hxx-tts-rate {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 12px;
      color: #6b7280;
    }
    #${PLAYER_ID} .hxx-tts-rate input[type="range"] {
      flex: 1;
      accent-color: #3b82f6;
    }
    #${PLAYER_ID} .hxx-tts-rate-val {
      min-width: 36px;
      color: #3b82f6;
      font-weight: 600;
    }
  `;
  document.documentElement.appendChild(style);
}

export function ensurePlayer(h: PlayerHandlers): HTMLElement {
  handlers = h;
  injectStyles();
  let el = document.getElementById(PLAYER_ID) as HTMLElement | null;
  if (el) {
    root = el;
    return el;
  }
  el = document.createElement('div');
  el.id = PLAYER_ID;
  el.innerHTML = `
    <div class="hxx-tts-full">
      <div class="hxx-tts-head">
        <div class="hxx-tts-title"><span>🔊</span><span data-hxx-tts="title"></span></div>
        <div class="hxx-tts-icon-btns">
          <button type="button" class="hxx-tts-icon-btn" data-hxx-tts="min" title="${t('ttsMinimize')}">–</button>
          <button type="button" class="hxx-tts-icon-btn" data-hxx-tts="close" title="${t('ttsClose')}">×</button>
        </div>
      </div>
      <div class="hxx-tts-subtitle">
        <div class="hxx-tts-subtitle-meta">
          <span data-hxx-tts="nowPlaying">${t('ttsNowPlaying')}</span>
          <span class="hxx-tts-lang-badge" data-hxx-tts="langBadge" hidden></span>
        </div>
        <div class="hxx-tts-preview" data-hxx-tts="preview" data-placeholder=""></div>
      </div>
      <div class="hxx-tts-controls">
        <button type="button" class="hxx-tts-ctrl" data-hxx-tts="prev">${t('ttsPrev')}</button>
        <button type="button" class="hxx-tts-ctrl primary" data-hxx-tts="pause">${t('ttsPause')}</button>
        <button type="button" class="hxx-tts-ctrl" data-hxx-tts="next">${t('ttsNext')}</button>
        <button type="button" class="hxx-tts-ctrl" data-hxx-tts="reset">${t('ttsReset')}</button>
      </div>
      <div class="hxx-tts-mode">
        <span data-hxx-tts="endModeLabel">${t('ttsEndMode')}</span>
        <select data-hxx-tts="endMode" aria-label="${t('ttsEndMode')}">
          <option value="loop">${t('ttsEndModeLoop')}</option>
          <option value="stop">${t('ttsEndModeStop')}</option>
          <option value="exit">${t('ttsEndModeExit')}</option>
        </select>
      </div>
      <div class="hxx-tts-rate">
        <span>${t('ttsRate')}</span>
        <input type="range" min="0.8" max="1.5" step="0.05" data-hxx-tts="rate" />
        <span class="hxx-tts-rate-val" data-hxx-tts="rateVal">1.0x</span>
      </div>
    </div>
    <div class="hxx-tts-dot" hidden title="${t('ttsExpand')}">🔊</div>
  `;
  document.documentElement.appendChild(el);
  root = el;
  bindEvents(el);
  return el;
}

function bindEvents(el: HTMLElement): void {
  el.querySelector('[data-hxx-tts="prev"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    handlers?.onPrev();
  });
  el.querySelector('[data-hxx-tts="pause"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    handlers?.onPauseResume();
  });
  el.querySelector('[data-hxx-tts="next"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    handlers?.onNext();
  });
  el.querySelector('[data-hxx-tts="reset"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    handlers?.onReset();
  });
  el.querySelector('[data-hxx-tts="close"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    handlers?.onClose();
  });
  el.querySelector('[data-hxx-tts="min"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    setMinimized(true);
  });
  el.querySelector('[data-hxx-tts="preview"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    handlers?.onPreviewClick?.();
  });
  const rate = el.querySelector('[data-hxx-tts="rate"]') as HTMLInputElement | null;
  rate?.addEventListener('input', () => {
    const v = Number(rate.value);
    const label = el.querySelector('[data-hxx-tts="rateVal"]');
    if (label) label.textContent = `${Number(v.toFixed(2))}x`;
    handlers?.onRateChange(v);
  });
  const endMode = el.querySelector('[data-hxx-tts="endMode"]') as HTMLSelectElement | null;
  endMode?.addEventListener('change', (e) => {
    e.stopPropagation();
    const value = endMode.value;
    if (value === 'loop' || value === 'stop' || value === 'exit') {
      handlers?.onEndModeChange(value);
    }
  });
  endMode?.addEventListener('mousedown', (e) => e.stopPropagation());
  endMode?.addEventListener('click', (e) => e.stopPropagation());

  const head = el.querySelector('.hxx-tts-head') as HTMLElement | null;
  const onMove = (clientX: number, clientY: number) => {
    if (!dragging || !root) return;
    const x = clientX - dragOx;
    const y = clientY - dragOy;
    root.style.left = `${Math.max(8, Math.min(window.innerWidth - 60, x))}px`;
    root.style.top = `${Math.max(8, Math.min(window.innerHeight - 60, y))}px`;
    root.style.right = 'auto';
    root.style.bottom = 'auto';
  };
  const endDrag = () => {
    dragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
  const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
  const onMouseUp = () => endDrag();

  head?.addEventListener('mousedown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (!root) return;
    dragging = true;
    const rect = root.getBoundingClientRect();
    dragOx = e.clientX - rect.left;
    dragOy = e.clientY - rect.top;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  el.addEventListener('click', () => {
    if (el.classList.contains('hxx-tts-min')) setMinimized(false);
  });
}

function setMinimized(min: boolean): void {
  if (!root) return;
  root.classList.toggle('hxx-tts-min', min);
  const full = root.querySelector('.hxx-tts-full') as HTMLElement | null;
  const dot = root.querySelector('.hxx-tts-dot') as HTMLElement | null;
  if (full) full.hidden = min;
  if (dot) dot.hidden = !min;
}

function splitPreviewAt(text: string, charIndex: number): { before: string; current: string; after: string } {
  if (!text) return { before: '', current: '', after: '' };
  const i = Math.max(0, Math.min(Math.floor(charIndex), text.length));
  if (i >= text.length) {
    return { before: text, current: '', after: '' };
  }

  let end = i;
  const ch = text[i] || '';
  if (/[\u4e00-\u9fff]/.test(ch)) {
    // 中文按字高亮
    end = i + 1;
  } else if (/[A-Za-z0-9]/.test(ch)) {
    while (end < text.length && /[A-Za-z0-9'’-]/.test(text[end]!)) end += 1;
  } else {
    end = i + 1;
  }

  return {
    before: text.slice(0, i),
    current: text.slice(i, end),
    after: text.slice(end),
  };
}

function renderPreview(preview: HTMLElement, text: string, charIndex: number): void {
  const { before, current, after } = splitPreviewAt(text, charIndex);
  preview.replaceChildren();

  if (before) {
    const spoken = document.createElement('span');
    spoken.className = 'hxx-tts-spoken';
    spoken.textContent = before;
    preview.appendChild(spoken);
  }
  if (current) {
    const cur = document.createElement('span');
    cur.className = 'hxx-tts-current';
    cur.textContent = current;
    preview.appendChild(cur);
  }
  if (after) {
    const upcoming = document.createElement('span');
    upcoming.className = 'hxx-tts-upcoming';
    upcoming.textContent = after;
    preview.appendChild(upcoming);
  }

  const mark = preview.querySelector('.hxx-tts-current') as HTMLElement | null;
  if (mark) {
    const box = preview.getBoundingClientRect();
    const m = mark.getBoundingClientRect();
    if (m.top < box.top + 8) {
      preview.scrollTop -= box.top + 8 - m.top;
    } else if (m.bottom > box.bottom - 8) {
      preview.scrollTop += m.bottom - (box.bottom - 8);
    }
  }
}

export function updatePlayer(state: PlayerViewState): void {
  if (!root) return;
  const title = root.querySelector('[data-hxx-tts="title"]');
  const nowPlaying = root.querySelector('[data-hxx-tts="nowPlaying"]');
  const langBadge = root.querySelector('[data-hxx-tts="langBadge"]') as HTMLElement | null;
  const preview = root.querySelector('[data-hxx-tts="preview"]') as HTMLElement | null;
  const pauseBtn = root.querySelector('[data-hxx-tts="pause"]') as HTMLButtonElement | null;
  const prevBtn = root.querySelector('[data-hxx-tts="prev"]') as HTMLButtonElement | null;
  const nextBtn = root.querySelector('[data-hxx-tts="next"]') as HTMLButtonElement | null;
  const resetBtn = root.querySelector('[data-hxx-tts="reset"]') as HTMLButtonElement | null;
  const endModeLabel = root.querySelector('[data-hxx-tts="endModeLabel"]');
  const endMode = root.querySelector('[data-hxx-tts="endMode"]') as HTMLSelectElement | null;
  const rate = root.querySelector('[data-hxx-tts="rate"]') as HTMLInputElement | null;
  const rateVal = root.querySelector('[data-hxx-tts="rateVal"]');

  const current = state.total ? state.index + 1 : 0;
  const titleKey = state.status === 'paused' ? 'ttsPaused' : 'ttsPlaying';
  if (title) title.textContent = t(titleKey, { current, total: state.total });
  if (nowPlaying) nowPlaying.textContent = t('ttsNowPlaying');
  if (langBadge) {
    if (state.lang === 'zh' || state.lang === 'en') {
      langBadge.hidden = false;
      langBadge.classList.toggle('zh', state.lang === 'zh');
      langBadge.textContent = state.lang === 'zh' ? t('ttsSubtitleLangZh') : t('ttsSubtitleLangEn');
    } else {
      langBadge.hidden = true;
      langBadge.textContent = '';
    }
  }
  if (preview) {
    const text = state.preview || '';
    const prevKey = preview.dataset.hxxText || '';
    const nextIndex = state.charIndex ?? 0;
    if (text !== prevKey) {
      preview.dataset.hxxText = text;
      preview.scrollTop = 0;
    }
    renderPreview(preview, text, nextIndex);
  }
  if (pauseBtn) {
    pauseBtn.textContent = state.status === 'paused' ? t('ttsResume') : t('ttsPause');
  }
  if (prevBtn) {
    prevBtn.textContent = t('ttsPrev');
    prevBtn.disabled = state.index <= 0;
  }
  if (nextBtn) {
    nextBtn.textContent = t('ttsNext');
    nextBtn.disabled = state.index >= state.total - 1 && state.status !== 'paused';
  }
  if (resetBtn) {
    resetBtn.textContent = t('ttsReset');
    resetBtn.disabled = state.total <= 0;
  }
  if (endModeLabel) endModeLabel.textContent = t('ttsEndMode');
  if (endMode) {
    const mode = state.endMode || 'stop';
    if (document.activeElement !== endMode) endMode.value = mode;
    const loopOpt = endMode.querySelector('option[value="loop"]');
    const stopOpt = endMode.querySelector('option[value="stop"]');
    const exitOpt = endMode.querySelector('option[value="exit"]');
    if (loopOpt) loopOpt.textContent = t('ttsEndModeLoop');
    if (stopOpt) stopOpt.textContent = t('ttsEndModeStop');
    if (exitOpt) exitOpt.textContent = t('ttsEndModeExit');
  }
  if (rate && document.activeElement !== rate) rate.value = String(state.rate);
  if (rateVal) rateVal.textContent = `${Number(state.rate.toFixed(2))}x`;
  if (state.minimized != null) setMinimized(state.minimized);
}

export function hidePlayer(): void {
  root?.remove();
  root = null;
  handlers = null;
  document.getElementById(STYLE_ID)?.remove();
}

export function isPlayerVisible(): boolean {
  return !!root?.isConnected;
}
