import { t } from '../../common/i18n';
import type { RuntimeMessage, TtsStatusPayload, TtsVoicesResponse } from '../../common/messages';
import { getSettings, saveSettings } from '../../common/storage';
import type { TtsEndMode, TtsPlaybackStatus } from '../../common/types';
import { TTS_RATE_MAX, TTS_RATE_MIN } from '../../common/types';
import { clearHighlight, highlightElement } from './highlighter';
import { ensurePlayer, hidePlayer, updatePlayer } from './player-ui';
import {
  collectPageTtsSegments,
  collectSelectionTtsSegments,
  type SpeechLang,
  type TtsDomSegment,
} from './segmenter';

type Listener = (status: TtsStatusPayload) => void;

let segments: TtsDomSegment[] = [];
let index = 0;
let status: TtsPlaybackStatus = 'idle';
let requestId = '';
let rate = 1;
let voiceName = '';
let voiceLangByName = new Map<string, string>();
let highlightOn = true;
let endMode: TtsEndMode = 'loop';
let rememberSettings = true;
let error: string | undefined;
let listener: Listener | null = null;
let speakSeq = 0;
/** 当前段内已读到的字符下标（来自 chrome.tts word 事件） */
let charIndex = 0;
/** 自然播完后停在播放器上时，下次「继续」需从头开播 */
let awaitingReplay = false;

function clampRate(v: number): number {
  return Math.min(TTS_RATE_MAX, Math.max(TTS_RATE_MIN, Number(v.toFixed(2))));
}

function chromeLang(lang: SpeechLang): string {
  return lang === 'zh' ? 'zh-CN' : 'en-US';
}

/** 仅当用户选中的语音语言与当前段落一致时才指定 voiceName，否则交给系统按 lang 选 */
function voiceForSegment(lang: SpeechLang): string | undefined {
  if (!voiceName) return undefined;
  const vLang = (voiceLangByName.get(voiceName) || '').toLowerCase();
  if (!vLang) return undefined;
  if (lang === 'zh' && vLang.startsWith('zh')) return voiceName;
  if (lang === 'en' && vLang.startsWith('en')) return voiceName;
  return undefined;
}

function emit(): void {
  const payload = getTtsStatus();
  listener?.(payload);
  void chrome.runtime
    .sendMessage({ type: 'TTS_STATUS_CHANGED', ...payload } satisfies RuntimeMessage)
    .catch(() => {
      /* popup closed */
    });
  syncPlayerUi();
}

function syncPlayerUi(): void {
  if (status === 'idle') {
    hidePlayer();
    return;
  }
  ensurePlayer({
    onPrev: () => void prevSegment(),
    onPauseResume: () => {
      if (status === 'paused') void resumePlayback();
      else void pausePlayback();
    },
    onNext: () => void nextSegment(),
    onStop: () => void stopPlayback(),
    onClose: () => void stopPlayback(),
    onRateChange: (v) => void setRate(v),
    onEndModeChange: (mode) => void setEndMode(mode),
    onPreviewClick: () => {
      const el = segments[index]?.el;
      if (el) highlightElement(el, highlightOn);
    },
  });
  updatePlayer({
    status,
    index,
    total: segments.length,
    preview: segments[index]?.text || '',
    lang: segments[index]?.lang,
    charIndex,
    endMode,
    rate,
  });
}

export function onTtsStatusChange(cb: Listener): void {
  listener = cb;
}

export function getTtsStatus(): TtsStatusPayload {
  return {
    status,
    index,
    total: segments.length,
    preview: segments[index]?.text,
    error,
  };
}

async function loadTtsPrefs(): Promise<void> {
  const s = await getSettings();
  rate = clampRate(s.ttsRate ?? 1);
  voiceName = s.ttsVoiceName || '';
  highlightOn = s.ttsHighlight !== false;
  endMode = s.ttsEndMode ?? 'loop';
  rememberSettings = s.ttsRememberVoiceRate !== false;
  try {
    const vr = (await chrome.runtime.sendMessage({ type: 'TTS_GET_VOICES' })) as TtsVoicesResponse;
    voiceLangByName = new Map((vr.voices || []).map((v) => [v.voiceName, v.lang || '']));
  } catch {
    voiceLangByName = new Map();
  }
}

async function speakCurrent(): Promise<void> {
  const seg = segments[index];
  if (!seg) {
    await finishAll();
    return;
  }
  highlightElement(seg.el, highlightOn);
  const seq = ++speakSeq;
  requestId = `tts-${Date.now()}-${seq}`;
  charIndex = 0;
  status = 'playing';
  error = undefined;
  emit();

  const res = (await chrome.runtime.sendMessage({
    type: 'TTS_SPEAK',
    text: seg.text,
    rate,
    voiceName: voiceForSegment(seg.lang),
    lang: chromeLang(seg.lang),
    requestId,
  })) as { ok?: boolean; error?: string };

  if (seq !== speakSeq) return;
  if (!res?.ok) {
    error = res?.error || t('ttsFailed');
    status = 'idle';
    clearHighlight();
    hidePlayer();
    emit();
  }
}

async function finishAll(): Promise<void> {
  if (endMode === 'loop') {
    if (!segments.length) {
      await stopPlayback();
      return;
    }
    index = 0;
    charIndex = 0;
    awaitingReplay = false;
    await speakCurrent();
    return;
  }

  if (endMode === 'stop') {
    // 保留播放器，回到开头并暂停，方便再点继续重播
    index = 0;
    charIndex = 0;
    awaitingReplay = true;
    status = 'paused';
    highlightElement(segments[0]?.el ?? null, highlightOn);
    emit();
    return;
  }

  // exit：关闭播放器
  awaitingReplay = false;
  await stopPlayback();
}

export async function resumePlayback(): Promise<TtsStatusPayload> {
  if (status !== 'paused') return getTtsStatus();
  if (awaitingReplay || !requestId) {
    awaitingReplay = false;
    await speakCurrent();
    return getTtsStatus();
  }
  await chrome.runtime.sendMessage({ type: 'TTS_RESUME' });
  status = 'playing';
  emit();
  return getTtsStatus();
}

function failIdle(message: string): TtsStatusPayload {
  error = message;
  status = 'idle';
  segments = [];
  index = 0;
  emit();
  return getTtsStatus();
}

export async function startPageTts(): Promise<TtsStatusPayload> {
  await loadTtsPrefs();
  const settings = await getSettings();
  const { segments: list, unsupportedOnly } = collectPageTtsSegments(
    settings.ttsSplitParagraphs !== false,
    settings.ttsSpeechLang ?? 'auto',
  );
  if (!list.length) {
    return failIdle(unsupportedOnly ? t('ttsUnsupportedLanguage') : t('ttsNoContent'));
  }
  await chrome.runtime.sendMessage({ type: 'TTS_STOP' });
  segments = list;
  index = 0;
  awaitingReplay = false;
  await speakCurrent();
  return getTtsStatus();
}

export async function startSelectionTts(): Promise<TtsStatusPayload> {
  await loadTtsPrefs();
  const settings = await getSettings();
  const { segments: list, unsupportedOnly } = collectSelectionTtsSegments(
    settings.ttsSplitParagraphs !== false,
    settings.ttsSpeechLang ?? 'auto',
  );
  if (!list.length) {
    return failIdle(unsupportedOnly ? t('ttsUnsupportedLanguage') : t('ttsNoSelection'));
  }
  await chrome.runtime.sendMessage({ type: 'TTS_STOP' });
  segments = list;
  index = 0;
  awaitingReplay = false;
  await speakCurrent();
  return getTtsStatus();
}

export async function pausePlayback(): Promise<TtsStatusPayload> {
  if (status !== 'playing') return getTtsStatus();
  awaitingReplay = false;
  await chrome.runtime.sendMessage({ type: 'TTS_PAUSE' });
  status = 'paused';
  emit();
  return getTtsStatus();
}

export async function stopPlayback(): Promise<TtsStatusPayload> {
  speakSeq += 1;
  requestId = '';
  charIndex = 0;
  awaitingReplay = false;
  await chrome.runtime.sendMessage({ type: 'TTS_STOP' });
  status = 'idle';
  clearHighlight();
  hidePlayer();
  emit();
  return getTtsStatus();
}

export async function prevSegment(): Promise<TtsStatusPayload> {
  if (!segments.length || index <= 0) return getTtsStatus();
  await chrome.runtime.sendMessage({ type: 'TTS_STOP' });
  index -= 1;
  await speakCurrent();
  return getTtsStatus();
}

export async function nextSegment(): Promise<TtsStatusPayload> {
  if (!segments.length) return getTtsStatus();
  if (index >= segments.length - 1) {
    await finishAll();
    return getTtsStatus();
  }
  await chrome.runtime.sendMessage({ type: 'TTS_STOP' });
  index += 1;
  await speakCurrent();
  return getTtsStatus();
}

export async function setRate(next: number): Promise<void> {
  rate = clampRate(next);
  if (rememberSettings) {
    await saveSettings({ ttsRate: rate });
  }
  emit();
  if (status === 'playing') {
    await chrome.runtime.sendMessage({ type: 'TTS_STOP' });
    await speakCurrent();
  }
}

export async function setEndMode(mode: TtsEndMode): Promise<void> {
  endMode = mode === 'stop' || mode === 'exit' ? mode : 'loop';
  await saveSettings({ ttsEndMode: endMode });
  syncPlayerUi();
}

export async function handleTtsEvent(message: {
  event: string;
  requestId: string;
  errorMessage?: string;
  charIndex?: number;
}): Promise<void> {
  if (message.requestId !== requestId) return;
  if (message.event === 'start' || message.event === 'word') {
    if (typeof message.charIndex === 'number' && message.charIndex >= 0) {
      charIndex = message.charIndex;
      syncPlayerUi();
    }
    return;
  }
  if (message.event === 'end') {
    charIndex = segments[index]?.text.length || 0;
    syncPlayerUi();
    if (index >= segments.length - 1) {
      await finishAll();
      return;
    }
    index += 1;
    await speakCurrent();
    return;
  }
  if (message.event === 'error') {
    error = message.errorMessage || t('ttsFailed');
    status = 'idle';
    clearHighlight();
    hidePlayer();
    emit();
    return;
  }
}

export function isTtsActive(): boolean {
  return status === 'playing' || status === 'paused';
}
