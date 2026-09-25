import { t } from '../common/i18n';
import type { DisplayMode, PageTranslateStatus } from '../common/types';
import type { BgTranslateResponse } from '../common/messages';
import {
  clearRememberedSelection,
  collectExactSelectionTargets,
  collectTranslateBlocks,
  getRememberedSelectionText,
  hasMeaningfulSelection,
  rememberSelection,
} from './text-node-parser';
import {
  applyDisplayMode,
  originalText,
  reapplyAllReverted,
  restorePage,
  setTranslation,
  unitHasTranslation,
  wrapBlock,
} from './dom-manager';
import { mergeChunkedTranslations, splitParagraphBatches } from './translation-queue';
import { hideProgress, showProgress } from './progress';

export type TranslateMode = 'page' | 'selection';

export type PageState = {
  status: PageTranslateStatus;
  progress: number;
  error?: string;
  errorCode?: string;
  traceId?: string;
  providerCode?: string;
  hasSelection?: boolean;
  selectionOnly?: boolean;
};

const state: PageState = {
  status: 'UNTRANSLATED',
  progress: 0,
  hasSelection: false,
};

let observer: MutationObserver | null = null;
let observing = false;
let seq = 0;
let translating = false;
let lastTargetLang = 'zh-CN';
let lastMode: DisplayMode = 'translation';

function requestTranslate(sourceLang: string, targetLang: string, segments: { id: string; text: string }[]) {
  return chrome.runtime.sendMessage({
    type: 'BG_TRANSLATE',
    sourceLang,
    targetLang,
    segments,
  }) as Promise<BgTranslateResponse>;
}

function mapById(units: HTMLElement[]): Map<string, HTMLElement> {
  const map = new Map<string, HTMLElement>();
  for (const el of units) {
    const id = el.dataset.hxxId;
    if (id) map.set(id, el);
  }
  return map;
}

export function getState(): PageState {
  return { ...state, hasSelection: hasMeaningfulSelection() };
}

type PageStateListener = (state: PageState) => void;
let stateListener: PageStateListener | null = null;

export function onPageStateChange(listener: PageStateListener): void {
  stateListener = listener;
}

function emitState(): void {
  stateListener?.(getState());
}

export function setMode(mode: DisplayMode): void {
  lastMode = mode;
  applyDisplayMode(mode);
}

function startObserver(targetLang: string, mode: DisplayMode): void {
  if (observer) observer.disconnect();
  let reapplyTimer: number | undefined;
  observer = new MutationObserver((mutations) => {
    if (translating) return;

    // Angular/React 常把叶子文案改回原文：轻量回刷译文，避免「翻了又变回英文」
    let maybeRevert = false;
    for (const m of mutations) {
      if (m.type === 'characterData') {
        maybeRevert = true;
        break;
      }
      if (m.type === 'childList' && m.target instanceof HTMLElement && m.target.closest?.('.hxxtranslate-unit')) {
        maybeRevert = true;
        break;
      }
    }
    if (maybeRevert) {
      window.clearTimeout(reapplyTimer);
      reapplyTimer = window.setTimeout(() => reapplyAllReverted(), 80);
    }

    const added: HTMLElement[] = [];
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (
          node.closest?.(
            '.hxxtranslate-unit, .hxxtranslate-translation, #hxxtranslate-progress, #hxxtranslate-fab',
          )
        ) {
          return;
        }
        if (node.classList?.contains('hxxtranslate-translation')) return;
        added.push(node);
      });
    }
    if (!added.length) return;
    window.setTimeout(() => {
      void translateNewNodes(added, targetLang, mode);
    }, 400);
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  observing = true;
}

function stopObserver(): void {
  observer?.disconnect();
  observer = null;
  observing = false;
}

async function translateNewNodes(roots: HTMLElement[], targetLang: string, mode: DisplayMode): Promise<void> {
  if (state.status !== 'TRANSLATED' && state.status !== 'TRANSLATING') return;
  if (state.selectionOnly) return;
  const blocks: HTMLElement[] = [];
  for (const root of roots) {
    blocks.push(...collectTranslateBlocks(root));
  }
  const fresh = blocks.filter((el) => !el.classList.contains('hxxtranslate-unit'));
  if (!fresh.length) return;
  await runTranslate(fresh, targetLang, mode, false);
}

function filterFreshBlocks(blocks: HTMLElement[]): HTMLElement[] {
  return blocks.filter((el) => !el.classList.contains('hxxtranslate-unit') || !unitHasTranslation(el));
}

async function runTranslate(
  blocks: HTMLElement[],
  targetLang: string,
  mode: DisplayMode,
  resetProgress: boolean,
): Promise<void> {
  if (!blocks.length) return;
  translating = true;
  emitState();
  const units = blocks
    .map((el) => {
      const id = el.dataset.hxxId || String(++seq);
      return wrapBlock(el, id);
    })
    .filter((el) => el.classList.contains('hxxtranslate-unit') && !!el.dataset.hxxId);
  const rawSegments = units
    .map((el) => ({ id: el.dataset.hxxId || '', text: originalText(el) }))
    .filter((s) => s.id && s.text.length >= 2);

  // 按段落分批请求，逐步写回译文
  const batches = splitParagraphBatches(rawSegments);
  const lookup = mapById(units);
  let done = 0;
  const total = Math.max(
    batches.reduce((n, b) => n + b.length, 0),
    1,
  );
  if (resetProgress) {
    showProgress(0);
    emitState();
  }

  try {
    for (const batch of batches) {
      const res = await requestTranslate('auto', targetLang, batch);
      if (!res?.ok) {
        state.error = res?.error || t('translateFailed');
        state.errorCode = res?.errorCode;
        state.traceId = res?.traceId;
        state.providerCode = res?.providerCode;
        if (res?.errorCode === 'UNAUTHENTICATED' || res?.errorCode === 'INSUFFICIENT_QUOTA') {
          throw Object.assign(new Error(state.error), {
            code: res.errorCode,
            traceId: res.traceId,
            providerCode: res.providerCode,
          });
        }
        throw Object.assign(new Error(state.error), {
          code: res?.errorCode,
          traceId: res?.traceId,
          providerCode: res?.providerCode,
        });
      }
      const merged = mergeChunkedTranslations(res.translations || []);
      for (const [id, text] of merged) {
        const el = lookup.get(id);
        if (el && text) setTranslation(el, text);
      }
      done += batch.length;
      const pct = Math.round((done / total) * 100);
      state.progress = pct;
      showProgress(pct);
      applyDisplayMode(mode);
      emitState();
    }
  } finally {
    translating = false;
    if (!resetProgress) emitState();
  }
}

function resolveSelectionOrFirstBlocks(): { blocks: HTMLElement[]; selectionOnly: boolean } {
  // 有选中文本：只译选中部分，绝不扩成整段
  const selectedText = getRememberedSelectionText().trim();
  if (selectedText.length >= 2) {
    const exact = collectExactSelectionTargets();
    if (exact.length) {
      return { blocks: filterFreshBlocks(exact), selectionOnly: true };
    }
  }
  // 无选区：退回第一段（保持原产品行为）
  const all = collectTranslateBlocks(document.body);
  const first = all[0] ? [all[0]] : [];
  return { blocks: filterFreshBlocks(first), selectionOnly: true };
}

export async function translatePage(targetLang: string, mode: DisplayMode): Promise<PageState> {
  return translateWithMode('page', targetLang, mode);
}

export async function translateSelection(targetLang: string, mode: DisplayMode): Promise<PageState> {
  return translateWithMode('selection', targetLang, mode);
}

async function translateWithMode(
  translateMode: TranslateMode,
  targetLang: string,
  mode: DisplayMode,
): Promise<PageState> {
  if (translating || state.status === 'TRANSLATING') return getState();
  state.status = 'TRANSLATING';
  state.progress = 0;
  state.error = undefined;
  state.errorCode = undefined;
  state.traceId = undefined;
  state.providerCode = undefined;
  lastTargetLang = targetLang;
  lastMode = mode;
  applyDisplayMode(mode);
  emitState();

  let blocks: HTMLElement[];
  let selectionOnly: boolean;

  if (translateMode === 'selection') {
    rememberSelection();
    const resolved = resolveSelectionOrFirstBlocks();
    blocks = resolved.blocks;
    selectionOnly = resolved.selectionOnly;
    if (selectionOnly && blocks.length) clearRememberedSelection();
  } else {
    selectionOnly = false;
    blocks = filterFreshBlocks(collectTranslateBlocks(document.body));
  }

  state.selectionOnly = selectionOnly;
  state.hasSelection = hasMeaningfulSelection();

  if (!blocks.length) {
    state.status = 'UNTRANSLATED';
    state.progress = 0;
    state.error = translateMode === 'selection' ? t('noSelectionOrFirst') : t('noTranslatableContent');
    hideProgress();
    emitState();
    return getState();
  }

  try {
    await runTranslate(blocks, targetLang, mode, true);
    state.status = 'TRANSLATED';
    state.progress = 100;
    hideProgress();
    if (!selectionOnly && !observing) startObserver(targetLang, mode);
  } catch (e) {
    const err = e as Error & { code?: string; traceId?: string; providerCode?: string };
    state.status = state.progress > 0 ? 'TRANSLATED' : 'UNTRANSLATED';
    state.error = err.message;
    state.errorCode = err.code;
    state.traceId = err.traceId;
    state.providerCode = err.providerCode;
    hideProgress();
  }
  emitState();
  return getState();
}

export function restoreOriginal(): PageState {
  state.status = 'RESTORING';
  stopObserver();
  restorePage();
  seq = 0;
  state.status = 'UNTRANSLATED';
  state.progress = 0;
  state.error = undefined;
  state.errorCode = undefined;
  state.selectionOnly = false;
  state.hasSelection = hasMeaningfulSelection();
  emitState();
  return getState();
}

export function getLastTranslateOpts(): { targetLang: string; mode: DisplayMode } {
  return { targetLang: lastTargetLang, mode: lastMode };
}

export function isTranslating(): boolean {
  return translating || state.status === 'TRANSLATING';
}
