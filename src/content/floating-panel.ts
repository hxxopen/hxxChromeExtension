import { t } from '../common/i18n';
import type { TtsStatusPayload } from '../common/messages';
import { getSettings, saveSettings } from '../common/storage';
import type { ExtensionSettings } from '../common/types';
import { getState, isTranslating, restoreOriginal, translatePage, translateSelection, type PageState } from './page-translator';
import { hasMeaningfulSelection } from './text-node-parser';
import {
  getTtsStatus,
  isTtsActive,
  nextSegment,
  pausePlayback,
  prevSegment,
  resetPlayback,
  resumePlayback,
  startPageTts,
  startSelectionTts,
  stopPlayback,
} from './tts/controller';

const FAB_ID = 'hxxtranslate-fab';
const PANEL_TOP_KEY = 'floatingPanelTop';

let fabRoot: HTMLElement | null = null;
let expanded = false;
let dragging = false;
let dragStartY = 0;
let dragStartTop = 0;
let prevStatus: PageState['status'] | undefined;
let lastTts: TtsStatusPayload = { status: 'idle', index: 0, total: 0 };

function clampTop(pct: number): number {
  return Math.min(90, Math.max(8, pct));
}

function applyTop(el: HTMLElement, pct: number): void {
  el.style.top = `${clampTop(pct)}%`;
}

async function runAction(action: 'page' | 'selection' | 'restore'): Promise<void> {
  if (isTranslating() && action !== 'restore') return;
  const settings = await getSettings();
  try {
    if (action === 'page') {
      await translatePage(settings.targetLanguage, settings.displayMode);
    } else if (action === 'selection') {
      await translateSelection(settings.targetLanguage, settings.displayMode);
    } else {
      restoreOriginal();
    }
  } catch (e) {
    updateStatus((e as Error).message || t('actionFailed'));
    refreshUi();
  }
}

export function syncFloatingPanelState(page: PageState = getState()): void {
  if (!fabRoot) {
    fabRoot = document.getElementById(FAB_ID) as HTMLElement | null;
  }
  if (!fabRoot) return;
  refreshUi();
  if (isTtsActive()) return;
  if (page.error) {
    const bits = [page.error];
    if (page.errorCode) bits.push(`[${page.errorCode}]`);
    if (page.providerCode) bits.push(`provider=${page.providerCode}`);
    if (page.traceId) bits.push(`trace=${page.traceId}`);
    updateStatus(bits.join(' '));
    prevStatus = page.status;
    return;
  }
  if (page.status === 'TRANSLATING') {
    updateStatus(t('translatingProgress', { progress: page.progress || 0 }));
    prevStatus = page.status;
    return;
  }
  if (page.status === 'TRANSLATED') {
    updateStatus(page.selectionOnly ? t('selectionTranslated') : t('pageTranslated'));
    prevStatus = page.status;
    return;
  }
  if (page.status === 'RESTORING' || prevStatus === 'TRANSLATED' || prevStatus === 'TRANSLATING' || prevStatus === 'RESTORING') {
    updateStatus(t('restored'));
  }
  prevStatus = page.status;
}

export function syncFloatingPanelTts(tts: TtsStatusPayload = getTtsStatus()): void {
  lastTts = tts;
  if (!fabRoot) {
    fabRoot = document.getElementById(FAB_ID) as HTMLElement | null;
  }
  if (!fabRoot) return;
  refreshUi();
  if (tts.error && tts.status === 'idle') {
    updateStatus(tts.error);
    return;
  }
  if (tts.status === 'playing' || tts.status === 'paused') {
    const current = tts.total ? tts.index + 1 : 0;
    updateStatus(
      t(tts.status === 'paused' ? 'ttsPaused' : 'ttsPlaying', {
        current,
        total: tts.total,
      }),
    );
    // 播放中保持展开
    expanded = true;
    fabRoot.classList.add('hxx-fab-open');
    fabRoot.classList.add('hxx-fab-tts-playing');
  } else {
    fabRoot.classList.remove('hxx-fab-tts-playing');
  }
}

function updateStatus(text: string): void {
  const el = fabRoot?.querySelector('.hxx-fab-status') as HTMLElement | null;
  if (el) el.textContent = text;
}

function refreshUi(): void {
  if (!fabRoot) return;
  const translating = isTranslating();
  const state = getState();
  const tts = lastTts.status !== 'idle' ? lastTts : getTtsStatus();
  const playing = tts.status === 'playing' || tts.status === 'paused';

  const translateMode = fabRoot.querySelector('.hxx-fab-mode-translate') as HTMLElement | null;
  const playMode = fabRoot.querySelector('.hxx-fab-mode-play') as HTMLElement | null;
  if (translateMode) translateMode.hidden = playing;
  if (playMode) playMode.hidden = !playing;

  fabRoot.querySelectorAll<HTMLButtonElement>('[data-hxx-action]').forEach((btn) => {
    const action = btn.dataset.hxxAction;
    if (action === 'restore') {
      btn.disabled = translating || state.status !== 'TRANSLATED';
    } else if (action === 'tts-selection') {
      btn.disabled = translating || playing || !hasMeaningfulSelection();
    } else if (action?.startsWith('tts-')) {
      btn.disabled = translating;
    } else if (action === 'page' || action === 'selection') {
      btn.disabled = translating || playing;
    }
  });

  const selHint = fabRoot.querySelector('.hxx-fab-selhint') as HTMLElement | null;
  if (selHint && !playing) {
    selHint.textContent = state.hasSelection ? t('willTranslateSelection') : t('noSelectionFirstParagraph');
  }

  const count = fabRoot.querySelector('.hxx-fab-tts-count') as HTMLElement | null;
  if (count && playing) {
    count.textContent = `${tts.total ? tts.index + 1 : 0}/${tts.total}`;
  }

  const pauseBtn = fabRoot.querySelector('[data-hxx-action="tts-pause"]') as HTMLElement | null;
  if (pauseBtn) {
    pauseBtn.textContent = tts.status === 'paused' ? '▶' : '⏸';
    pauseBtn.title = tts.status === 'paused' ? t('ttsResume') : t('ttsPause');
  }
}

function applyLocale(root: HTMLElement): void {
  const tab = root.querySelector('.hxx-fab-tab') as HTMLElement | null;
  if (tab) tab.textContent = t('fabTab');
  const handle = root.querySelector('.hxx-fab-handle') as HTMLElement | null;
  if (handle) handle.title = t('fabDrag');
  const pageBtn = root.querySelector('[data-hxx-action="page"]');
  if (pageBtn) pageBtn.textContent = t('translatePageShort');
  const selBtn = root.querySelector('[data-hxx-action="selection"]');
  if (selBtn) selBtn.textContent = t('translateSelectionShort');
  const restoreBtn = root.querySelector('[data-hxx-action="restore"]');
  if (restoreBtn) restoreBtn.textContent = t('restoreOriginal');
  const optionsBtn = root.querySelector('[data-hxx-action="options"]');
  if (optionsBtn) optionsBtn.textContent = t('settings');
  const ttsPage = root.querySelector('[data-hxx-action="tts-page"]');
  if (ttsPage) {
    ttsPage.textContent = `🔊 ${t('ttsFabReadPage')}`;
    (ttsPage as HTMLElement).title = t('ttsFabReadPage');
  }
  const ttsSel = root.querySelector('[data-hxx-action="tts-selection"]');
  if (ttsSel) {
    ttsSel.textContent = `▶ ${t('ttsFabReadSelection')}`;
    (ttsSel as HTMLElement).title = t('ttsFabReadSelection');
  }
  const ttsOpt = root.querySelector('[data-hxx-action="tts-options"]');
  if (ttsOpt) {
    ttsOpt.textContent = t('ttsFabSettings');
    (ttsOpt as HTMLElement).title = t('ttsFabSettings');
  }
  const divider = root.querySelector('.hxx-fab-tts-divider');
  if (divider) divider.textContent = t('ttsSection');
}

function buildFab(settings: ExtensionSettings): HTMLElement {
  const root = document.createElement('div');
  root.id = FAB_ID;
  root.className = 'hxxtranslate-fab';
  applyTop(root, settings.floatingPanelTop ?? 40);

  root.innerHTML = `
    <div class="hxx-fab-tab" title="HxxTranslate">${t('fabTab')}</div>
    <div class="hxx-fab-panel">
      <div class="hxx-fab-handle" title="${t('fabDrag')}">⋮⋮</div>
      <div class="hxx-fab-mode-translate">
        <div class="hxx-fab-title">HxxTranslate</div>
        <p class="hxx-fab-selhint">${t('noSelectionFirstParagraph')}</p>
        <button type="button" class="hxx-fab-btn primary" data-hxx-action="page">${t('translatePageShort')}</button>
        <button type="button" class="hxx-fab-btn" data-hxx-action="selection">${t('translateSelectionShort')}</button>
        <button type="button" class="hxx-fab-btn" data-hxx-action="restore">${t('restoreOriginal')}</button>
        <div class="hxx-fab-tts-divider">${t('ttsSection')}</div>
        <button type="button" class="hxx-fab-btn tts" data-hxx-action="tts-page">🔊 ${t('ttsFabReadPage')}</button>
        <button type="button" class="hxx-fab-btn tts" data-hxx-action="tts-selection">▶ ${t('ttsFabReadSelection')}</button>
        <button type="button" class="hxx-fab-link" data-hxx-action="tts-options">${t('ttsFabSettings')}</button>
        <button type="button" class="hxx-fab-link" data-hxx-action="options">${t('settings')}</button>
      </div>
      <div class="hxx-fab-mode-play" hidden>
        <div class="hxx-fab-tts-stack">
          <button type="button" class="hxx-fab-icon playing" data-hxx-action="tts-pause" title="${t('ttsPause')}">⏸</button>
          <button type="button" class="hxx-fab-icon" data-hxx-action="tts-prev" title="${t('ttsPrev')}">◀</button>
          <button type="button" class="hxx-fab-icon" data-hxx-action="tts-next" title="${t('ttsNext')}">▶</button>
          <button type="button" class="hxx-fab-icon" data-hxx-action="tts-reset" title="${t('ttsReset')}">↺</button>
          <button type="button" class="hxx-fab-icon" data-hxx-action="tts-stop" title="${t('ttsStop')}">⏹</button>
          <div class="hxx-fab-tts-count">0/0</div>
        </div>
      </div>
      <div class="hxx-fab-status"></div>
    </div>
  `;

  const tab = root.querySelector('.hxx-fab-tab') as HTMLElement;
  const panel = root.querySelector('.hxx-fab-panel') as HTMLElement;
  const handle = root.querySelector('.hxx-fab-handle') as HTMLElement;

  const expand = () => {
    expanded = true;
    root.classList.add('hxx-fab-open');
    refreshUi();
  };
  const collapse = () => {
    if (dragging) return;
    if (isTtsActive()) return; // 播放中不收起
    expanded = false;
    root.classList.remove('hxx-fab-open');
  };

  root.addEventListener('mouseenter', expand);
  root.addEventListener('mouseleave', collapse);
  tab.addEventListener('click', (e) => {
    e.stopPropagation();
    if (expanded) collapse();
    else expand();
  });

  panel.querySelectorAll<HTMLButtonElement>('[data-hxx-action]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.hxxAction;
      if (action === 'options' || action === 'tts-options') {
        void chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
        return;
      }
      if (action === 'page' || action === 'selection' || action === 'restore') {
        void runAction(action);
        return;
      }
      if (action === 'tts-page') {
        void startPageTts().then((s) => syncFloatingPanelTts(s));
        return;
      }
      if (action === 'tts-selection') {
        void startSelectionTts().then((s) => syncFloatingPanelTts(s));
        return;
      }
      if (action === 'tts-pause') {
        const st = getTtsStatus();
        void (st.status === 'paused' ? resumePlayback() : pausePlayback()).then((s) =>
          syncFloatingPanelTts(s),
        );
        return;
      }
      if (action === 'tts-prev') {
        void prevSegment().then((s) => syncFloatingPanelTts(s));
        return;
      }
      if (action === 'tts-next') {
        void nextSegment().then((s) => syncFloatingPanelTts(s));
        return;
      }
      if (action === 'tts-reset') {
        void resetPlayback().then((s) => syncFloatingPanelTts(s));
        return;
      }
      if (action === 'tts-stop') {
        void stopPlayback().then((s) => syncFloatingPanelTts(s));
      }
    });
  });

  const onMove = (clientY: number) => {
    const dy = clientY - dragStartY;
    const pct = clampTop(dragStartTop + (dy / window.innerHeight) * 100);
    applyTop(root, pct);
  };

  const endDrag = async () => {
    if (!dragging) return;
    dragging = false;
    root.classList.remove('hxx-fab-dragging');
    const top = parseFloat(root.style.top) || 40;
    await saveSettings({ [PANEL_TOP_KEY]: clampTop(top) });
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
  };

  const onMouseMove = (e: MouseEvent) => onMove(e.clientY);
  const onMouseUp = () => void endDrag();
  const onTouchMove = (e: TouchEvent) => {
    if (e.touches[0]) onMove(e.touches[0].clientY);
  };
  const onTouchEnd = () => void endDrag();

  const startDrag = (clientY: number) => {
    dragging = true;
    dragStartY = clientY;
    dragStartTop = parseFloat(root.style.top) || 40;
    root.classList.add('hxx-fab-dragging');
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd);
  };

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    startDrag(e.clientY);
  });
  handle.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches[0]) {
        e.stopPropagation();
        startDrag(e.touches[0].clientY);
      }
    },
    { passive: true },
  );

  return root;
}

function injectStyles(): void {
  if (document.getElementById('hxxtranslate-fab-style')) return;
  const style = document.createElement('style');
  style.id = 'hxxtranslate-fab-style';
  style.textContent = `
    #hxxtranslate-fab {
      position: fixed;
      right: 0;
      z-index: 2147483645;
      transform: translateY(-50%);
      font-family: "Segoe UI", system-ui, sans-serif;
      color: #0f172a;
    }
    #hxxtranslate-fab .hxx-fab-tab {
      width: 28px;
      height: 56px;
      margin-left: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #1677ff;
      color: #fff;
      border-radius: 10px 0 0 10px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: -2px 2px 12px rgba(15, 23, 42, 0.18);
      user-select: none;
    }
    #hxxtranslate-fab .hxx-fab-panel {
      display: none;
      width: 168px;
      margin-right: 0;
      padding: 10px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-right: 0;
      border-radius: 12px 0 0 12px;
      box-shadow: -4px 4px 20px rgba(15, 23, 42, 0.16);
    }
    #hxxtranslate-fab.hxx-fab-open .hxx-fab-panel { display: block; }
    #hxxtranslate-fab.hxx-fab-open .hxx-fab-tab { display: none; }
    #hxxtranslate-fab.hxx-fab-tts-playing .hxx-fab-panel {
      width: 52px;
      padding: 8px 6px;
    }
    #hxxtranslate-fab .hxx-fab-handle {
      text-align: center;
      color: #94a3b8;
      cursor: ns-resize;
      font-size: 12px;
      letter-spacing: 2px;
      user-select: none;
      padding: 2px 0 6px;
    }
    #hxxtranslate-fab.hxx-fab-dragging { opacity: 0.92; }
    #hxxtranslate-fab .hxx-fab-title {
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    #hxxtranslate-fab .hxx-fab-selhint {
      margin: 0 0 8px;
      font-size: 11px;
      color: #64748b;
      line-height: 1.35;
    }
    #hxxtranslate-fab .hxx-fab-btn {
      display: block;
      width: 100%;
      margin-bottom: 6px;
      padding: 7px 8px;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      background: #fff;
      font-size: 12px;
      cursor: pointer;
    }
    #hxxtranslate-fab .hxx-fab-btn.primary {
      background: #1677ff;
      border-color: #1677ff;
      color: #fff;
      font-weight: 600;
    }
    #hxxtranslate-fab .hxx-fab-btn:disabled {
      opacity: 0.5;
      cursor: default;
    }
    #hxxtranslate-fab .hxx-fab-tts-divider {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 10px 0 8px;
      font-size: 11px;
      color: #94a3b8;
    }
    #hxxtranslate-fab .hxx-fab-tts-divider::before,
    #hxxtranslate-fab .hxx-fab-tts-divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #e2e8f0;
    }
    #hxxtranslate-fab .hxx-fab-btn.tts {
      background: #f0f9ff;
      border-color: #bae6fd;
      color: #0369a1;
      font-weight: 600;
    }
    #hxxtranslate-fab .hxx-fab-btn.tts:hover {
      background: #e0f2fe;
    }
    #hxxtranslate-fab .hxx-fab-tts-row {
      display: flex;
      gap: 4px;
      margin: 8px 0 6px;
    }
    #hxxtranslate-fab .hxx-fab-icon {
      flex: 1;
      height: 36px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: #f0f9ff;
      cursor: pointer;
      font-size: 14px;
      color: #0369a1;
    }
    #hxxtranslate-fab .hxx-fab-icon:hover { background: #e0f2fe; }
    #hxxtranslate-fab .hxx-fab-icon:disabled {
      opacity: 0.45;
      cursor: default;
    }
    #hxxtranslate-fab .hxx-fab-icon.playing {
      background: #fef3c7;
      color: #b45309;
      border-color: #fde68a;
    }
    #hxxtranslate-fab .hxx-fab-tts-stack {
      display: flex;
      flex-direction: column;
      gap: 4px;
      align-items: stretch;
    }
    #hxxtranslate-fab .hxx-fab-tts-stack .hxx-fab-icon {
      flex: none;
      width: 100%;
    }
    #hxxtranslate-fab .hxx-fab-tts-count {
      font-size: 11px;
      font-weight: 600;
      color: #3b82f6;
      text-align: center;
      padding: 4px 0;
      background: #eff6ff;
      border-radius: 6px;
    }
    #hxxtranslate-fab .hxx-fab-link {
      display: block;
      width: 100%;
      border: 0;
      background: transparent;
      color: #1677ff;
      font-size: 12px;
      cursor: pointer;
      padding: 4px 0;
      text-align: left;
    }
    #hxxtranslate-fab .hxx-fab-status {
      margin-top: 6px;
      font-size: 11px;
      color: #64748b;
      min-height: 16px;
      line-height: 1.3;
      word-break: break-word;
    }
    #hxxtranslate-fab.hxx-fab-tts-playing .hxx-fab-status {
      display: none;
    }
  `;
  document.documentElement.appendChild(style);
}

export async function mountFloatingPanel(): Promise<void> {
  const settings = await getSettings();
  if (!settings.showFloatingPanel) {
    unmountFloatingPanel();
    return;
  }
  if (isRestricted()) return;
  injectStyles();
  if (fabRoot) {
    applyTop(fabRoot, settings.floatingPanelTop ?? 40);
    applyLocale(fabRoot);
    syncFloatingPanelState();
    syncFloatingPanelTts();
    return;
  }
  fabRoot = buildFab(settings);
  document.documentElement.appendChild(fabRoot);
  syncFloatingPanelState();
  syncFloatingPanelTts();
}

export function unmountFloatingPanel(): void {
  fabRoot?.remove();
  fabRoot = null;
  prevStatus = undefined;
  document.getElementById('hxxtranslate-fab-style')?.remove();
}

function isRestricted(): boolean {
  const href = location.href;
  return (
    href.startsWith('chrome://') ||
    href.startsWith('chrome-extension://') ||
    href.startsWith('edge://') ||
    href.startsWith('about:')
  );
}

export async function syncFloatingPanelFromSettings(settings: ExtensionSettings): Promise<void> {
  if (settings.showFloatingPanel) {
    if (!fabRoot) await mountFloatingPanel();
    else {
      applyTop(fabRoot, settings.floatingPanelTop ?? 40);
      applyLocale(fabRoot);
      syncFloatingPanelState();
      syncFloatingPanelTts();
    }
  } else {
    unmountFloatingPanel();
  }
}
