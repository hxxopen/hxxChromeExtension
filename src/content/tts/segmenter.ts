import type { TtsSpeechLang } from '../../common/types';
import { getRememberedSelectionText, hasMeaningfulSelection, collectTranslateBlocks } from '../text-node-parser';
import { UNIT_CLASS } from '../dom-manager';

export type SpeechLang = 'en' | 'zh';

export type TtsDomSegment = {
  id: string;
  text: string;
  el: HTMLElement | null;
  lang: SpeechLang;
};

export type CollectTtsResult = {
  segments: TtsDomSegment[];
  /** 有可提取文本，但按当前语言偏好无法朗读 */
  unsupportedOnly: boolean;
};

type TextPair = {
  original: string;
  translated: string | null;
};

const ORIGINAL_ATTR = 'data-hxx-original';
const TRANSLATED_ATTR = 'data-hxx-translated';
const ORIGINAL_CLASS = 'hxxtranslate-original';

/** 仅支持中文 / 英文；其它语言返回 unsupported */
export function detectSpeechLang(text: string): SpeechLang | 'unsupported' {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (trimmed.length < 2) return 'unsupported';

  const letters = (trimmed.match(/[A-Za-z]/g) || []).length;
  const cjk = (trimmed.match(/[\u4e00-\u9fff]/g) || []).length;

  if (cjk === 0 && letters === 0) return 'unsupported';

  if (cjk >= 2 && cjk >= letters) return 'zh';
  if (letters >= 2 && cjk <= letters * 0.6 && letters >= Math.max(2, Math.floor(trimmed.length * 0.12))) {
    return 'en';
  }
  if (cjk >= 2 && cjk > letters) return 'zh';
  if (letters >= 2 && letters > cjk) return 'en';
  return 'unsupported';
}

/** @deprecated 保留给可能的外部引用；请用 detectSpeechLang */
export function looksLikeEnglish(text: string): boolean {
  return detectSpeechLang(text) === 'en';
}

/**
 * 按设置选择要朗读的文本：
 * - auto：原文优先（须为中/英）
 * - en/zh：设置语言优先；先匹配原文，再匹配译文；都不行则失败
 */
export function resolveSpeakText(
  pair: TextPair,
  pref: TtsSpeechLang,
): { text: string; lang: SpeechLang } | null {
  const original = pair.original.replace(/\s+/g, ' ').trim();
  const translated = pair.translated?.replace(/\s+/g, ' ').trim() || '';
  const origLang = original ? detectSpeechLang(original) : 'unsupported';
  const transLang = translated ? detectSpeechLang(translated) : 'unsupported';

  if (pref === 'auto') {
    if (origLang === 'en' || origLang === 'zh') {
      return { text: original, lang: origLang };
    }
    return null;
  }

  if (origLang === pref && original.length >= 2) {
    return { text: original, lang: pref };
  }
  if (transLang === pref && translated.length >= 2) {
    return { text: translated, lang: pref };
  }
  return null;
}

function pairFromElement(el: HTMLElement): TextPair {
  const unit =
    el.classList.contains(UNIT_CLASS) ? el : (el.closest(`.${UNIT_CLASS}`) as HTMLElement | null);

  if (unit) {
    const original =
      unit.getAttribute(ORIGINAL_ATTR)?.replace(/\s+/g, ' ').trim() ||
      (
        unit.querySelector(`:scope > .${ORIGINAL_CLASS}`) as HTMLElement | null
      )?.innerText?.replace(/\s+/g, ' ').trim() ||
      '';
    const translated = unit.getAttribute(TRANSLATED_ATTR)?.replace(/\s+/g, ' ').trim() || null;
    if (original.length >= 2) {
      return { original, translated: translated && translated.length >= 2 ? translated : null };
    }
  }

  const visible = (el.innerText || '').replace(/\s+/g, ' ').trim();
  return { original: visible, translated: null };
}

/** 按设计文档：先按段落，过长再按句子（中英文句号均支持） */
export function splitIntoSegments(text: string, splitParagraphs = true): string[] {
  const raw = text.replace(/\r\n/g, '\n').trim();
  if (!raw) return [];
  if (!splitParagraphs) {
    return raw.length <= 280 ? [raw] : splitBySentences(raw);
  }
  let paras = raw
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (paras.length <= 1 && raw.length > 40) {
    paras = [raw];
  }
  const out: string[] = [];
  for (const p of paras) {
    if (p.length < 280) {
      if (p.length >= 2) out.push(p);
    } else {
      out.push(...splitBySentences(p));
    }
  }
  return out.filter((s) => s.trim().length >= 2);
}

function splitBySentences(p: string): string[] {
  const parts = p.match(/[^。.！!？?；;]+[。.！!？?；;]+|[^。.！!？?；;]+$/g);
  if (!parts) return [p];
  const merged: string[] = [];
  let buf = '';
  for (const part of parts) {
    const t = part.trim();
    if (!t) continue;
    if ((buf + ' ' + t).trim().length < 280) {
      buf = buf ? `${buf} ${t}` : t;
    } else {
      if (buf) merged.push(buf);
      buf = t;
    }
  }
  if (buf) merged.push(buf);
  return merged.length ? merged : [p];
}

function makeId(prefix: string, i: number): string {
  return `${prefix}-${i}`;
}

function isTtsChromeUi(el: HTMLElement): boolean {
  return Boolean(el.closest('#hxxtranslate-fab, #hxxtranslate-progress, #hxx-tts-player'));
}

function collectPageBlocks(): HTMLElement[] {
  const seen = new Set<HTMLElement>();
  const out: HTMLElement[] = [];

  document.querySelectorAll(`.${UNIT_CLASS}`).forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    if (isTtsChromeUi(node)) return;
    if (seen.has(node)) return;
    seen.add(node);
    out.push(node);
  });

  for (const el of collectTranslateBlocks(document.body)) {
    if (isTtsChromeUi(el)) continue;
    if (el.closest(`.${UNIT_CLASS}`)) continue;
    if (seen.has(el)) continue;
    seen.add(el);
    out.push(el);
  }

  return out;
}

function pushSegments(
  result: TtsDomSegment[],
  text: string,
  el: HTMLElement | null,
  lang: SpeechLang,
  splitParagraphs: boolean,
  prefix: string,
  startIdx: number,
): number {
  const pieces = splitIntoSegments(text, splitParagraphs);
  let idx = startIdx;
  for (const piece of pieces) {
    result.push({ id: makeId(prefix, idx++), text: piece, el, lang });
  }
  return idx;
}

function appendResolved(
  result: TtsDomSegment[],
  pair: TextPair,
  el: HTMLElement | null,
  pref: TtsSpeechLang,
  splitParagraphs: boolean,
  prefix: string,
  startIdx: number,
): { nextIdx: number; matched: boolean; sawCandidate: boolean } {
  const hasCandidate =
    pair.original.replace(/\s+/g, ' ').trim().length >= 2 ||
    Boolean(pair.translated && pair.translated.replace(/\s+/g, ' ').trim().length >= 2);
  if (!hasCandidate) {
    return { nextIdx: startIdx, matched: false, sawCandidate: false };
  }
  const resolved = resolveSpeakText(pair, pref);
  if (!resolved) {
    return { nextIdx: startIdx, matched: false, sawCandidate: true };
  }
  const nextIdx = pushSegments(result, resolved.text, el, resolved.lang, splitParagraphs, prefix, startIdx);
  return { nextIdx, matched: true, sawCandidate: true };
}

/** 整页：按语言偏好在原文/译文间选择 */
export function collectPageTtsSegments(
  splitParagraphs = true,
  speechLang: TtsSpeechLang = 'auto',
): CollectTtsResult {
  const blocks = collectPageBlocks();
  const result: TtsDomSegment[] = [];
  let idx = 0;
  let sawCandidate = false;
  let matchedAny = false;

  for (const el of blocks) {
    const { nextIdx, matched, sawCandidate: saw } = appendResolved(
      result,
      pairFromElement(el),
      el,
      speechLang,
      splitParagraphs,
      'p',
      idx,
    );
    idx = nextIdx;
    if (saw) sawCandidate = true;
    if (matched) matchedAny = true;
  }

  return {
    segments: result,
    unsupportedOnly: sawCandidate && !matchedAny && result.length === 0,
  };
}

/** 选区：只朗读选中的文字本身，不扩成整段原文/译文 */
export function collectSelectionTtsSegments(
  splitParagraphs = true,
  _speechLang: TtsSpeechLang = 'auto',
): CollectTtsResult {
  if (!hasMeaningfulSelection()) {
    return { segments: [], unsupportedOnly: false };
  }

  const text = getRememberedSelectionText().trim();
  if (!text || text.length < 2) {
    return { segments: [], unsupportedOnly: false };
  }

  // 选中什么就读什么（按选中文本识别中/英）；不改用整段 unit
  const lang = detectSpeechLang(text);
  if (lang === 'unsupported') {
    return { segments: [], unsupportedOnly: true };
  }

  const result: TtsDomSegment[] = [];
  pushSegments(result, text, null, lang, splitParagraphs, 's', 0);
  return {
    segments: result,
    unsupportedOnly: false,
  };
}
