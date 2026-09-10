import { t } from '../common/i18n';
import { getSettings, saveSettings } from '../common/storage';
import type { ExtensionSettings } from '../common/types';
import { getState, isTranslating, restoreOriginal, translatePage, translateSelection, type PageState } from './page-translator';

const FAB_ID = 'hxxtranslate-fab';
const PANEL_TOP_KEY = 'floatingPanelTop';

let fabRoot: HTMLElement | null = null;
let expanded = false;
let dragging = false;
let dragStartY = 0;
let dragStartTop = 0;
let prevStatus: PageState['status'] | undefined;

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
    refreshButtons();
  }
}

export function syncFloatingPanelState(page: PageState = getState()): void {
  if (!fabRoot) {
    fabRoot = document.getElementById(FAB_ID) as HTMLElement | null;
  }
  if (!fabRoot) return;
  refreshButtons();
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

function updateStatus(text: string): void {
  const el = fabRoot?.querySelector('.hxx-fab-status') as HTMLElement | null;
  if (el) el.textContent = text;
}

function refreshButtons(): void {
  const translating = isTranslating();
  const state = getState();
  fabRoot?.querySelectorAll<HTMLButtonElement>('[data-hxx-action]').forEach((btn) => {
    const action = btn.dataset.hxxAction;
    if (action === 'restore') {
      btn.disabled = translating || state.status !== 'TRANSLATED';
    } else {
      btn.disabled = translating;
    }
  });
  const selHint = fabRoot?.querySelector('.hxx-fab-selhint') as HTMLElement | null;
  if (selHint) {
    selHint.textContent = state.hasSelection ? t('willTranslateSelection') : t('noSelectionFirstParagraph');
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
      <div class="hxx-fab-title">HxxTranslate</div>
      <p class="hxx-fab-selhint">${t('noSelectionFirstParagraph')}</p>
      <button type="button" class="hxx-fab-btn primary" data-hxx-action="page">${t('translatePageShort')}</button>
      <button type="button" class="hxx-fab-btn" data-hxx-action="selection">${t('translateSelectionShort')}</button>
      <button type="button" class="hxx-fab-btn" data-hxx-action="restore">${t('restoreOriginal')}</button>
      <button type="button" class="hxx-fab-link" data-hxx-action="options">${t('settings')}</button>
      <div class="hxx-fab-status"></div>
    </div>
  `;

  const tab = root.querySelector('.hxx-fab-tab') as HTMLElement;
  const panel = root.querySelector('.hxx-fab-panel') as HTMLElement;
  const handle = root.querySelector('.hxx-fab-handle') as HTMLElement;

  const expand = () => {
    expanded = true;
    root.classList.add('hxx-fab-open');
    refreshButtons();
  };
  const collapse = () => {
    if (dragging) return;
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
      if (action === 'options') {
        void chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
        return;
      }
      if (action === 'page' || action === 'selection' || action === 'restore') {
        void runAction(action);
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
    return;
  }
  fabRoot = buildFab(settings);
  document.documentElement.appendChild(fabRoot);
  syncFloatingPanelState();
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
    }
  } else {
    unmountFloatingPanel();
  }
}
