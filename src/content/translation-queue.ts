import type { TranslateSegment } from '../common/types';
import { LIMITS } from '../common/types';

export const MAX_SEGMENT_CHARS = LIMITS.maxSegmentChars;

export function splitBatches(
  segments: TranslateSegment[],
  maxChars = LIMITS.maxBatchChars,
  maxItems = LIMITS.maxSegmentsPerBatch,
): TranslateSegment[][] {
  const batches: TranslateSegment[][] = [];
  let current: TranslateSegment[] = [];
  let count = 0;
  for (const seg of segments) {
    const n = [...seg.text].length;
    const wouldOverflow =
      current.length > 0 && (count + n > maxChars || current.length >= maxItems);
    if (wouldOverflow) {
      batches.push(current);
      current = [];
      count = 0;
    }
    current.push(seg);
    count += n;
  }
  if (current.length) batches.push(current);
  return batches;
}

/**
 * 按段落分批：优先每个段落单独请求；短段落可合并到同一批（最多 N 段 / 字符上限）。
 * 过长段落先拆成多段再入批。
 */
export function splitParagraphBatches(
  segments: TranslateSegment[],
  maxChars = LIMITS.maxBatchChars,
  maxParagraphs = LIMITS.maxParagraphsPerBatch,
): TranslateSegment[][] {
  const expanded = expandLongSegments(segments);
  const batches: TranslateSegment[][] = [];
  let current: TranslateSegment[] = [];
  let count = 0;
  let paraCount = 0;
  let lastBase = '';

  for (const seg of expanded) {
    const base = seg.id.includes('#') ? seg.id.slice(0, seg.id.lastIndexOf('#')) : seg.id;
    const n = [...seg.text].length;
    const isNewParagraph = base !== lastBase;
    const nextParaCount = paraCount + (isNewParagraph && current.length ? 1 : 0);
    const wouldOverflow =
      current.length > 0 &&
      (count + n > maxChars ||
        nextParaCount >= maxParagraphs ||
        current.length >= LIMITS.maxSegmentsPerBatch);

    if (wouldOverflow) {
      batches.push(current);
      current = [];
      count = 0;
      paraCount = 0;
      lastBase = '';
    }

    if (!current.length || base !== lastBase) {
      if (current.length) paraCount += 1;
      lastBase = base;
    }
    current.push(seg);
    count += n;
  }
  if (current.length) batches.push(current);
  // 硬限制：任意一批不得超过后端段数上限
  return batches.flatMap((b) => splitBatches(b, maxChars, LIMITS.maxSegmentsPerBatch));
}

export function expandLongSegments(segments: TranslateSegment[], maxChars = MAX_SEGMENT_CHARS): TranslateSegment[] {
  const out: TranslateSegment[] = [];
  for (const seg of segments) {
    const runes = [...seg.text];
    if (runes.length <= maxChars) {
      out.push(seg);
      continue;
    }
    let part = 0;
    for (let i = 0; i < runes.length; i += maxChars) {
      out.push({
        id: `${seg.id}#${part++}`,
        text: runes.slice(i, i + maxChars).join(''),
      });
    }
  }
  return out;
}

export function mergeChunkedTranslations(items: { id: string; text: string }[]): Map<string, string> {
  const parts = new Map<string, { idx: number; text: string }[]>();
  for (const item of items) {
    const hash = item.id.lastIndexOf('#');
    let base = item.id;
    let idx = 0;
    if (hash > 0) {
      const maybeIdx = Number(item.id.slice(hash + 1));
      if (Number.isInteger(maybeIdx)) {
        base = item.id.slice(0, hash);
        idx = maybeIdx;
      }
    }
    const list = parts.get(base) || [];
    list.push({ idx, text: item.text });
    parts.set(base, list);
  }
  const merged = new Map<string, string>();
  for (const [base, list] of parts) {
    list.sort((a, b) => a.idx - b.idx);
    merged.set(base, list.map((p) => p.text).join(''));
  }
  return merged;
}
