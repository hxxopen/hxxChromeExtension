const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEXTAREA',
  'INPUT',
  'SELECT',
  'CODE',
  'PRE',
  'SVG',
  'KBD',
  'SAMP',
  'VAR',
  'MATH',
  'CANVAS',
  'VIDEO',
  'AUDIO',
  'IFRAME',
]);

const BLOCK_SELECTOR = [
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'td',
  'th',
  'blockquote',
  'figcaption',
  'dt',
  'dd',
  'article',
  'section',
  'div',
].join(',');

export function shouldSkipElement(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return true;
  if (el.closest('.hxxtranslate-unit, .hxxtranslate-original, .hxxtranslate-translation, #hxxtranslate-progress, #hxxtranslate-fab')) {
    return true;
  }
  if (SKIP_TAGS.has(el.tagName)) return true;
  if (el.closest('pre, code, script, style, textarea, svg, noscript')) return true;
  if (el.isContentEditable) return true;
  if (el.getAttribute('aria-hidden') === 'true') return true;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return true;
  return false;
}

function looksLikeCode(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (/^https?:\/\//i.test(trimmed) && trimmed.length < 180) return true;
  const symbols = (trimmed.match(/[{};=<>]/g) || []).length;
  return symbols > trimmed.length * 0.12 && trimmed.length > 40;
}

export function collectTranslateBlocks(root: ParentNode = document.body): HTMLElement[] {
  if (!root || !document.body) return [];
  const candidates = Array.from((root as Element).querySelectorAll?.(BLOCK_SELECTOR) || []).concat(
    root instanceof HTMLElement && root.matches(BLOCK_SELECTOR) ? [root] : [],
  );
  const blocks: HTMLElement[] = [];
  for (const node of candidates) {
    if (!(node instanceof HTMLElement)) continue;
    if (shouldSkipElement(node)) continue;
    // 有更细块级子节点的容器跳过，避免父+子重复翻译叠字
    if (node.querySelector(BLOCK_SELECTOR)) {
      continue;
    }
    if (node.classList.contains('hxxtranslate-unit')) continue;
    const text = (node.innerText || '').replace(/\s+/g, ' ').trim();
    if (text.length < 2) continue;
    if (text.length > 5000) continue; // 过大块多半是未识别的容器
    if (looksLikeCode(text)) continue;
    blocks.push(node);
  }
  // 再去掉互相包含的祖先（保险）
  return blocks.filter((el) => !blocks.some((other) => other !== el && el.contains(other)));
}

export function hasLiveMeaningfulSelection(): boolean {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return false;
  return sel.toString().replace(/\s+/g, ' ').trim().length >= 2;
}

/** 打开扩展弹窗时浏览器常会清空选区，因此缓存最近一次有效选区 */
let cachedSelectionBlocks: HTMLElement[] = [];
let cachedSelectionText = '';
let cachedSelectionAt = 0;

function selectionTextOf(sel: Selection): string {
  return sel.toString().replace(/\s+/g, ' ').trim();
}

/** 从选区内文本节点向上找可翻译块（比只扫 p/li 更稳） */
function blocksFromRange(range: Range): HTMLElement[] {
  const found = new Set<HTMLElement>();
  const ancestor = range.commonAncestorContainer;
  const root: Node =
    ancestor.nodeType === Node.ELEMENT_NODE ? ancestor : ancestor.parentNode || document.body;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length >= 1) {
      try {
        if (range.intersectsNode(node)) {
          const block = nearestTranslateBlock(node.parentElement);
          if (block) found.add(block);
        }
      } catch {
        /* ignore */
      }
    }
    node = walker.nextNode();
  }

  if (found.size) return Array.from(found);

  // 选区锚点再试一次
  const sel = window.getSelection();
  if (sel) {
    for (const n of [sel.anchorNode, sel.focusNode]) {
      const block = nearestTranslateBlock(n?.parentElement || null);
      if (block) found.add(block);
    }
  }
  return Array.from(found);
}

function nearestTranslateBlock(start: Element | null): HTMLElement | null {
  let el: Element | null = start;
  while (el && el !== document.body) {
    if (!(el instanceof HTMLElement)) {
      el = el.parentElement;
      continue;
    }
    if (shouldSkipElement(el)) {
      el = el.parentElement;
      continue;
    }
    if (el.matches(BLOCK_SELECTOR) || el.matches('span, a, strong, em, b, i, label')) {
      // 优先块级；行内则继续向上找块，找不到再用自己
      if (el.matches(BLOCK_SELECTOR)) {
        // 跳过过大的容器（整页 section）
        if (el.matches('div, article, section') && el.querySelector(BLOCK_SELECTOR)) {
          el = el.parentElement;
          continue;
        }
        const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
        if (t.length >= 2 && !looksLikeCode(t)) return el;
      }
    }
    el = el.parentElement;
  }
  return start instanceof HTMLElement && !shouldSkipElement(start) ? start : null;
}

/** 选区无法对应现有块时，挂一个临时宿主承载选中文本 */
function ensureTextSelectionHost(text: string, range: Range | null): HTMLElement {
  const existing = document.getElementById('hxxtranslate-selection-host') as HTMLElement | null;
  if (existing) {
    existing.textContent = text;
    return existing;
  }
  const host = document.createElement('div');
  host.id = 'hxxtranslate-selection-host';
  host.className = 'hxxtranslate-selection-host';
  host.textContent = text;
  host.setAttribute(
    'style',
    [
      'position:fixed',
      'z-index:2147483645',
      'left:50%',
      'bottom:24px',
      'transform:translateX(-50%)',
      'max-width:min(520px,92vw)',
      'max-height:40vh',
      'overflow:auto',
      'background:#fff',
      'color:#0f172a',
      'padding:12px 14px',
      'border-radius:12px',
      'box-shadow:0 10px 30px rgba(15,23,42,.2)',
      'border:1px solid #e2e8f0',
      'font:14px/1.5 system-ui,sans-serif',
    ].join(';'),
  );
  // 尽量插在选区附近，失败则挂 body
  try {
    const anchor =
      range?.commonAncestorContainer.parentElement ||
      (range?.commonAncestorContainer instanceof HTMLElement
        ? range.commonAncestorContainer
        : null);
    (anchor || document.body).appendChild(host);
  } catch {
    document.body.appendChild(host);
  }
  return host;
}

export function rememberSelection(): void {
  if (!hasLiveMeaningfulSelection()) return;
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const text = selectionTextOf(sel);
  if (text.length < 2) return;

  // 始终记住选中文本；找不到 DOM 块时翻译阶段再挂宿主
  cachedSelectionText = text;
  cachedSelectionAt = Date.now();
  cachedSelectionBlocks = collectBlocksFromLiveSelection();
}

export function clearRememberedSelection(): void {
  cachedSelectionBlocks = [];
  cachedSelectionText = '';
  cachedSelectionAt = 0;
  document.getElementById('hxxtranslate-selection-host')?.remove();
}

function rememberedBlocks(): HTMLElement[] {
  if (!cachedSelectionAt || Date.now() - cachedSelectionAt > 5 * 60 * 1000) {
    return [];
  }
  const connected = cachedSelectionBlocks.filter((el) => el.isConnected);
  if (connected.length) return connected;
  // 块丢了但还有文本：重建宿主（仅在真正收集翻译目标时调用）
  if (cachedSelectionText.length >= 2) {
    const host = ensureTextSelectionHost(cachedSelectionText, null);
    cachedSelectionBlocks = [host];
    return [host];
  }
  return [];
}

export function hasMeaningfulSelection(): boolean {
  if (hasLiveMeaningfulSelection()) return true;
  if (!cachedSelectionAt || Date.now() - cachedSelectionAt > 5 * 60 * 1000) return false;
  if (cachedSelectionBlocks.some((el) => el.isConnected)) return true;
  return cachedSelectionText.replace(/\s+/g, ' ').trim().length >= 2;
}

export function getRememberedSelectionText(): string {
  if (hasLiveMeaningfulSelection()) {
    return selectionTextOf(window.getSelection()!);
  }
  return cachedSelectionText;
}

/** 收集与当前选区相交的可翻译块；无选区则尝试用最近一次缓存 */
export function collectBlocksFromSelection(): HTMLElement[] {
  const live = collectBlocksFromLiveSelection();
  if (live.length) return live;
  return rememberedBlocks();
}

function collectBlocksFromLiveSelection(): HTMLElement[] {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return [];
  const selectedText = selectionTextOf(sel);
  if (selectedText.length < 2) return [];

  const range = sel.getRangeAt(0);
  const fromWalk = blocksFromRange(range);
  if (fromWalk.length) return fromWalk;

  // 兼容旧逻辑：与 collectTranslateBlocks 结果求交
  const ancestor = range.commonAncestorContainer;
  const scope =
    ancestor.nodeType === Node.ELEMENT_NODE
      ? (ancestor as HTMLElement)
      : ancestor.parentElement;
  if (scope) {
    const searchRoot = scope.closest('main, article, section, [role="main"], body') || document.body;
    const candidates = collectTranslateBlocks(searchRoot);
    const hit = candidates.filter((el) => {
      try {
        return range.intersectsNode(el);
      } catch {
        return false;
      }
    });
    if (hit.length) return hit;
  }

  const host = wrapLooseSelection(range);
  if (host) return [host];

  // 不在这里创建浮动宿主，避免选区变化时刷 UI；文本已由 rememberSelection 缓存
  return [];
}

function wrapLooseSelection(range: Range): HTMLElement | null {
  const text = range.toString().replace(/\s+/g, ' ').trim();
  if (text.length < 2) return null;
  const span = document.createElement('span');
  span.className = 'hxxtranslate-selection-host';
  try {
    range.surroundContents(span);
    return span;
  } catch {
    try {
      const frag = range.extractContents();
      span.appendChild(frag);
      range.insertNode(span);
      return span;
    } catch {
      return null;
    }
  }
}
