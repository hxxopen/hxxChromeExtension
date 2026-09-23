/**
 * 页面内 speechSynthesis 引擎。
 * MV3 service worker 里的 chrome.tts 在部分环境（尤其 Windows）会出现「调用成功但无声」，
 * 因此实际发音放在 content script 完成。
 */

export type SpeakHandlers = {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
};

let currentUtterance: SpeechSynthesisUtterance | null = null;
let voicesReady: Promise<void> | null = null;

function ensureVoices(): Promise<void> {
  if (voicesReady) return voicesReady;
  voicesReady = new Promise((resolve) => {
    const done = () => resolve();
    const list = window.speechSynthesis.getVoices();
    if (list.length) {
      done();
      return;
    }
    const timer = window.setTimeout(done, 800);
    window.speechSynthesis.addEventListener(
      'voiceschanged',
      () => {
        window.clearTimeout(timer);
        done();
      },
      { once: true },
    );
  });
  return voicesReady;
}

export async function listEnglishSpeechVoices(): Promise<
  { voiceName: string; lang: string }[]
> {
  await ensureVoices();
  const list = window.speechSynthesis
    .getVoices()
    .filter((v) => (v.lang || '').toLowerCase().startsWith('en'))
    .map((v) => ({ voiceName: v.name, lang: v.lang || 'en-US' }));
  list.sort((a, b) => {
    const score = (lang: string) =>
      lang.toLowerCase().startsWith('en-us') ? 0 : lang.toLowerCase().startsWith('en-gb') ? 1 : 2;
    return score(a.lang) - score(b.lang) || a.voiceName.localeCompare(b.voiceName);
  });
  return list;
}

function pickVoice(voiceName?: string, lang?: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  if (voiceName) {
    const exact = voices.find((v) => v.name === voiceName);
    if (exact) return exact;
  }
  const want = (lang || 'en-US').toLowerCase();
  const byLang =
    voices.find((v) => v.lang.toLowerCase() === want) ||
    voices.find((v) => v.lang.toLowerCase().startsWith('en-us')) ||
    voices.find((v) => v.lang.toLowerCase().startsWith('en'));
  return byLang || null;
}

export async function speakText(
  text: string,
  opts: { rate?: number; voiceName?: string; lang?: string },
  handlers: SpeakHandlers,
): Promise<void> {
  const trimmed = (text || '').trim();
  if (!trimmed) {
    handlers.onError?.('empty');
    return;
  }

  await ensureVoices();

  // Chrome：cancel 后立刻 speak 偶发无声，稍延后再播
  window.speechSynthesis.cancel();
  currentUtterance = null;

  await new Promise<void>((r) => window.setTimeout(r, 40));

  const u = new SpeechSynthesisUtterance(trimmed);
  u.lang = opts.lang || 'en-US';
  u.rate = Math.min(2, Math.max(0.5, opts.rate ?? 1));
  const voice = pickVoice(opts.voiceName, u.lang);
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang || u.lang;
  }

  u.onstart = () => handlers.onStart?.();
  u.onend = () => {
    if (currentUtterance === u) currentUtterance = null;
    handlers.onEnd?.();
  };
  u.onerror = (ev) => {
    if (currentUtterance === u) currentUtterance = null;
    // interrupted / canceled 由主动 stop 引起，不当作失败
    const err = String(ev.error || '');
    if (err === 'interrupted' || err === 'canceled') return;
    handlers.onError?.(err || 'speech error');
  };

  currentUtterance = u;
  try {
    window.speechSynthesis.speak(u);
    // 部分 Chrome 需要 resume 一下才真正出声
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  } catch (e) {
    currentUtterance = null;
    handlers.onError?.((e as Error).message || 'speech error');
  }
}

export function pauseSpeech(): void {
  try {
    window.speechSynthesis.pause();
  } catch {
    /* ignore */
  }
}

export function resumeSpeech(): void {
  try {
    window.speechSynthesis.resume();
  } catch {
    /* ignore */
  }
}

export function stopSpeech(): void {
  currentUtterance = null;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

export function isSpeechSpeaking(): boolean {
  try {
    return window.speechSynthesis.speaking;
  } catch {
    return false;
  }
}
