import { t } from '../../common/i18n';
import type { TtsPlaybackStatus } from '../../common/types';

const PLAYER_ID = 'hxx-tts-player';
const STYLE_ID = 'hxx-tts-player-style';

export type PlayerViewState = {
  status: TtsPlaybackStatus;
  index: number;
  total: number;
  preview: string;
  rate: number;
  minimized?: boolean;
};

export type PlayerHandlers = {
  onPrev: () => void;
  onPauseResume: () => void;
  onNext: () => void;
  onStop: () => void;
  onClose: () => void;
  onRateChange: (rate: number) => void;
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
    #${PLAYER_ID} .hxx-tts-preview {
      font-size: 13px;
      color: #374151;
      line-height: 1.5;
      background: #f8fafc;
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 14px;
      max-height: 60px;
      overflow: hidden;
      cursor: pointer;
    }
    #${PLAYER_ID} .hxx-tts-controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    #${PLAYER_ID} .hxx-tts-ctrl {
      border: 1px solid #e5e7eb;
      background: #fff;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 13px;
      cursor: pointer;
      color: #1f2937;
    }
    #${PLAYER_ID} .hxx-tts-ctrl.primary {
      background: #3b82f6;
      border-color: #3b82f6;
      color: #fff;
      font-weight: 600;
    }
    #${PLAYER_ID} .hxx-tts-ctrl:disabled {
      opacity: 0.45;
      cursor: default;
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
      <div class="hxx-tts-preview" data-hxx-tts="preview"></div>
      <div class="hxx-tts-controls">
        <button type="button" class="hxx-tts-ctrl" data-hxx-tts="prev">${t('ttsPrev')}</button>
        <button type="button" class="hxx-tts-ctrl primary" data-hxx-tts="pause">${t('ttsPause')}</button>
        <button type="button" class="hxx-tts-ctrl" data-hxx-tts="next">${t('ttsNext')}</button>
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

export function updatePlayer(state: PlayerViewState): void {
  if (!root) return;
  const title = root.querySelector('[data-hxx-tts="title"]');
  const preview = root.querySelector('[data-hxx-tts="preview"]');
  const pauseBtn = root.querySelector('[data-hxx-tts="pause"]') as HTMLButtonElement | null;
  const prevBtn = root.querySelector('[data-hxx-tts="prev"]') as HTMLButtonElement | null;
  const nextBtn = root.querySelector('[data-hxx-tts="next"]') as HTMLButtonElement | null;
  const rate = root.querySelector('[data-hxx-tts="rate"]') as HTMLInputElement | null;
  const rateVal = root.querySelector('[data-hxx-tts="rateVal"]');

  const current = state.total ? state.index + 1 : 0;
  const titleKey = state.status === 'paused' ? 'ttsPaused' : 'ttsPlaying';
  if (title) title.textContent = t(titleKey, { current, total: state.total });
  if (preview) preview.textContent = state.preview || '';
  if (pauseBtn) {
    pauseBtn.textContent = state.status === 'paused' ? t('ttsResume') : t('ttsPause');
  }
  if (prevBtn) prevBtn.disabled = state.index <= 0;
  if (nextBtn) nextBtn.disabled = state.index >= state.total - 1;
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
