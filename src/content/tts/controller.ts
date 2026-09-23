import { t } from '../../common/i18n';
import type { RuntimeMessage, TtsStatusPayload } from '../../common/messages';
import { getSettings, saveSettings } from '../../common/storage';
import type { TtsPlaybackStatus } from '../../common/types';
import { TTS_RATE_MAX, TTS_RATE_MIN } from '../../common/types';
import { clearHighlight, highlightElement } from './highlighter';
import { ensurePlayer, hidePlayer, updatePlayer } from './player-ui';
import { collectPageTtsSegments, collectSelectionTtsSegments, type TtsDomSegment } from './segmenter';

type Listener = (status: TtsStatusPayload) => void;

let segments: TtsDomSegment[] = [];
let index = 0;
let status: TtsPlaybackStatus = 'idle';
let requestId = '';
let rate = 1;
let voiceName = '';
let highlightOn = true;
let autoStopAtEnd = true;
let rememberSettings = true;
let error: string | undefined;
let listener: Listener | null = null;
let speakSeq = 0;

function clampRate(v: number): number {
  return Math.min(TTS_RATE_MAX, Math.max(TTS_RATE_MIN, Number(v.toFixed(2))));
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
  autoStopAtEnd = s.ttsAutoStopAtEnd !== false;
  rememberSettings = s.ttsRememberVoiceRate !== false;
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
  status = 'playing';
  error = undefined;
  emit();

  const res = (await chrome.runtime.sendMessage({
    type: 'TTS_SPEAK',
    text: seg.text,
    rate,
    voiceName: voiceName || undefined,
    lang: 'en-US',
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
  if (autoStopAtEnd) {
    await stopPlayback();
  } else {
    status = 'paused';
    emit();
  }
}

export async function startPageTts(): Promise<TtsStatusPayload> {
  await loadTtsPrefs();
  const settings = await getSettings();
  const list = collectPageTtsSegments(settings.ttsSplitParagraphs !== false);
  if (!list.length) {
    error = t('ttsNoContent');
    status = 'idle';
    segments = [];
    index = 0;
    emit();
    return getTtsStatus();
  }
  await chrome.runtime.sendMessage({ type: 'TTS_STOP' });
  segments = list;
  index = 0;
  await speakCurrent();
  return getTtsStatus();
}

export async function startSelectionTts(): Promise<TtsStatusPayload> {
  await loadTtsPrefs();
  const settings = await getSettings();
  const list = collectSelectionTtsSegments(settings.ttsSplitParagraphs !== false);
  if (!list.length) {
    error = t('ttsNoSelection');
    status = 'idle';
    segments = [];
    index = 0;
    emit();
    return getTtsStatus();
  }
  await chrome.runtime.sendMessage({ type: 'TTS_STOP' });
  segments = list;
  index = 0;
  await speakCurrent();
  return getTtsStatus();
}

export async function pausePlayback(): Promise<TtsStatusPayload> {
  if (status !== 'playing') return getTtsStatus();
  await chrome.runtime.sendMessage({ type: 'TTS_PAUSE' });
  status = 'paused';
  emit();
  return getTtsStatus();
}

export async function resumePlayback(): Promise<TtsStatusPayload> {
  if (status !== 'paused') return getTtsStatus();
  await chrome.runtime.sendMessage({ type: 'TTS_RESUME' });
  status = 'playing';
  emit();
  return getTtsStatus();
}

export async function stopPlayback(): Promise<TtsStatusPayload> {
  speakSeq += 1;
  requestId = '';
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

export async function handleTtsEvent(message: {
  event: string;
  requestId: string;
  errorMessage?: string;
}): Promise<void> {
  if (message.requestId !== requestId) return;
  if (message.event === 'end') {
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
