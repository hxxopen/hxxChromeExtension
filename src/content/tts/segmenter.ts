import { collectTranslateBlocks, getRememberedSelectionText, hasMeaningfulSelection } from '../text-node-parser';

export type TtsDomSegment = {
  id: string;
  text: string;
  el: HTMLElement | null;
};

const ORIGINAL_ATTR = 'data-hxx-original';

/** 粗判是否像英文（拉丁字母为主） */
export function looksLikeEnglish(text: string): boolean {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (trimmed.length < 2) return false;
  const letters = trimmed.match(/[A-Za-z]/g) || [];
  const cjk = trimmed.match(/[\u4e00-\u9fff]/g) || [];
  if (letters.length < 2) return false;
  // 中文明显多于英文则跳过
  if (cjk.length > letters.length * 0.6) return false;
  return letters.length >= Math.max(2, trimmed.length * 0.15);
}

function textFromBlock(el: HTMLElement): string {
  const stored = el.getAttribute(ORIGINAL_ATTR);
  if (stored && looksLikeEnglish(stored)) return stored.trim();
  const visible = (el.innerText || '').trim();
  if (looksLikeEnglish(visible)) return visible;
  if (stored) return stored.trim();
  return visible;
}

/** 按设计文档：先按段落，过长再按句子 */
export function splitIntoSegments(text: string, splitParagraphs = true): string[] {
  const raw = text.replace(/\r\n/g, '\n').trim();
  if (!raw) return [];
  if (!splitParagraphs) {
    return raw.length <= 280 ? [raw] : splitBySentences(raw);
  }
  let paras = raw.split(/\n+/).map((p) => p.trim()).filter((p) => p.length > 0);
  if (paras.length <= 1 && raw.length > 40) {
    // 单块长文：仍按句子拆，避免整页一段
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
  const parts = p.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
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

/** 整页：收集英文块并拆段 */
export function collectPageTtsSegments(splitParagraphs = true): TtsDomSegment[] {
  const blocks = collectTranslateBlocks(document.body);
  const result: TtsDomSegment[] = [];
  let idx = 0;
  for (const el of blocks) {
    if (el.closest('#hxxtranslate-fab, #hxxtranslate-progress, #hxx-tts-player')) continue;
    const text = textFromBlock(el);
    if (!looksLikeEnglish(text)) continue;
    const pieces = splitIntoSegments(text, splitParagraphs);
    if (pieces.length === 1) {
      result.push({ id: makeId('p', idx++), text: pieces[0], el });
    } else {
      for (const piece of pieces) {
        result.push({ id: makeId('p', idx++), text: piece, el });
      }
    }
  }
  return result;
}

/** 选区：用当前/缓存选区文本 */
export function collectSelectionTtsSegments(splitParagraphs = true): TtsDomSegment[] {
  if (!hasMeaningfulSelection()) return [];
  const text = getRememberedSelectionText().trim();
  if (!text || text.length < 2) return [];
  const pieces = splitIntoSegments(text, splitParagraphs);
  return pieces.map((piece, i) => ({
    id: makeId('s', i),
    text: piece,
    el: null,
  }));
}
