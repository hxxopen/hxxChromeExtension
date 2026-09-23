import { loginWithHxxBot } from '../api/auth';
import { fetchAccount } from '../api/account';
import { ApiError } from '../api/client';
import { translateSegments } from '../api/translate';
import type {
  BgTranslateRequest,
  BgTranslateResponse,
  RuntimeMessage,
  TtsVoicesResponse,
} from '../common/messages';
import { t } from '../common/i18n';
import { clearAuth, getAuth, getSettings, saveSettings } from '../common/storage';
import { LIMITS, buildSubscribeUrl } from '../common/types';

const BG_MAX_SEGMENTS = Math.min(60, LIMITS.maxSegmentsPerBatch);

/** 当前朗读目标 tab，用于把 onEvent 回传 */
let activeTts: { tabId: number | null; requestId: string } | null = null;

function isRestrictedUrl(url?: string): boolean {
  if (!url) return true;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('https://chromewebstore.google.com')
  );
}

async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function chunkSegments<T>(items: T[], size: number): T[][] {
  if (items.length <= size) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function translateInChunks(
  sourceLang: string,
  targetLang: string,
  segments: BgTranslateRequest['segments'],
): Promise<BgTranslateResponse> {
  const chunks = chunkSegments(segments, BG_MAX_SEGMENTS);
  const translations: { id: string; text: string }[] = [];
  let usage: BgTranslateResponse['usage'];
  for (const chunk of chunks) {
    const data = await translateSegments(sourceLang, targetLang, chunk);
    translations.push(...(data.translations || []));
    if (data.usage) usage = data.usage;
  }
  return { ok: true, translations, usage };
}

async function sendToTab<T>(message: RuntimeMessage): Promise<T> {
  const tab = await activeTab();
  if (!tab?.id) {
    throw new Error(t('pageNotTranslatable'));
  }
  if (isRestrictedUrl(tab.url)) {
    return {
      status: 'UNTRANSLATED',
      progress: 0,
      translatable: false,
      error: t('pageNotTranslatable'),
    } as T;
  }

  const tabId = tab.id;
  try {
    return (await chrome.tabs.sendMessage(tabId, message)) as T;
  } catch (err) {
    const msg = String((err as Error)?.message || err);
    if (!/Receiving end does not exist|Could not establish connection/i.test(msg)) {
      throw err;
    }
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
    return (await chrome.tabs.sendMessage(tabId, message)) as T;
  }
}

function notifyTabTtsEvent(
  tabId: number,
  requestId: string,
  event: 'start' | 'end' | 'word' | 'error' | 'interrupted' | 'cancelled',
  errorMessage?: string,
): void {
  void chrome.tabs
    .sendMessage(tabId, {
      type: 'TTS_EVENT',
      event,
      requestId,
      errorMessage,
    } satisfies RuntimeMessage)
    .catch(() => {
      /* tab closed */
    });
}

function speakWithChromeTts(
  tabId: number | null,
  text: string,
  opts: { rate?: number; voiceName?: string; lang?: string; requestId: string },
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    activeTts = { tabId, requestId: opts.requestId };
    const options: chrome.tts.SpeakOptions = {
      lang: opts.lang || 'en-US',
      rate: opts.rate ?? 1,
      enqueue: false,
      onEvent: (event) => {
        if (!activeTts || activeTts.requestId !== opts.requestId) return;
        const type = event.type;
        if (type === 'start') {
          if (tabId != null) notifyTabTtsEvent(tabId, opts.requestId, 'start');
        } else if (type === 'end') {
          if (tabId != null) notifyTabTtsEvent(tabId, opts.requestId, 'end');
          if (activeTts?.requestId === opts.requestId) activeTts = null;
        } else if (type === 'word') {
          if (tabId != null) {
            notifyTabTtsEvent(tabId, opts.requestId, 'word');
          }
        } else if (type === 'error') {
          if (tabId != null) {
            notifyTabTtsEvent(
              tabId,
              opts.requestId,
              'error',
              event.errorMessage || t('ttsFailed'),
            );
          }
          if (activeTts?.requestId === opts.requestId) activeTts = null;
        } else if (type === 'interrupted' || type === 'cancelled') {
          if (tabId != null) notifyTabTtsEvent(tabId, opts.requestId, type);
          if (activeTts?.requestId === opts.requestId) activeTts = null;
        }
      },
    };
    if (opts.voiceName) options.voiceName = opts.voiceName;

    try {
      chrome.tts.stop();
      chrome.tts.speak(text, options, () => {
        const err = chrome.runtime.lastError;
        if (err) {
          activeTts = null;
          resolve({ ok: false, error: err.message || t('ttsFailed') });
          return;
        }
        resolve({ ok: true });
      });
    } catch (e) {
      activeTts = null;
      resolve({ ok: false, error: (e as Error).message || t('ttsFailed') });
    }
  });
}

async function listEnglishVoices(): Promise<TtsVoicesResponse> {
  return new Promise((resolve) => {
    try {
      chrome.tts.getVoices((voices) => {
        const list = (voices || [])
          .filter((v) => (v.lang || '').toLowerCase().startsWith('en'))
          .map((v) => ({
            voiceName: v.voiceName || '',
            lang: v.lang || 'en-US',
            eventTypes: v.eventTypes,
          }))
          .filter((v) => v.voiceName);
        list.sort((a, b) => {
          const score = (lang: string) =>
            lang.toLowerCase().startsWith('en-us') ? 0 : lang.toLowerCase().startsWith('en-gb') ? 1 : 2;
          return score(a.lang) - score(b.lang) || a.voiceName.localeCompare(b.voiceName);
        });
        resolve({ voices: list });
      });
    } catch {
      resolve({ voices: [] });
    }
  });
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage | BgTranslateRequest, sender, sendResponse) => {
  const run = async () => {
    if (message.type === 'PAGE_STATUS_CHANGED' || message.type === 'TTS_STATUS_CHANGED') {
      return { ok: true };
    }
    // 忽略已废弃的 offscreen 消息
    if (
      typeof message.type === 'string' &&
      (message.type.startsWith('OFFSCREEN_') || message.type === 'TTS_EVENT')
    ) {
      return { ok: true };
    }

    await getSettings();
    if (message.type === 'BG_TRANSLATE') {
      const req = message as BgTranslateRequest;
      try {
        const auth = await getAuth();
        if (!auth?.accessToken) {
          const payload: BgTranslateResponse = {
            ok: false,
            error: t('loginFirst'),
            errorCode: 'UNAUTHENTICATED',
          };
          return payload;
        }
        return await translateInChunks(req.sourceLang, req.targetLang, req.segments);
      } catch (e) {
        const err = e as ApiError;
        const payload: BgTranslateResponse = {
          ok: false,
          error: err.message || t('translateFailed'),
          errorCode:
            err.code ||
            (err.status === 401 ? 'UNAUTHENTICATED' : err.status === 402 ? 'INSUFFICIENT_QUOTA' : 'FAILED'),
          traceId: err.traceId,
          providerCode: err.providerCode,
          subscribeUrl: err.subscribeUrl,
        };
        console.warn('[HxxTranslate] translate failed', {
          code: payload.errorCode,
          providerCode: payload.providerCode,
          traceId: payload.traceId,
          message: payload.error,
        });
        return payload;
      }
    }

    switch (message.type) {
      case 'GET_SETTINGS':
        return getSettings();
      case 'SAVE_SETTINGS': {
        const next = await saveSettings(message.patch);
        const tab = await activeTab();
        if (tab?.id) {
          try {
            if (message.patch.displayMode) {
              await chrome.tabs.sendMessage(tab.id, {
                type: 'SET_DISPLAY_MODE',
                mode: next.displayMode,
              });
            }
            if (
              message.patch.showFloatingPanel !== undefined ||
              message.patch.floatingPanelTop !== undefined ||
              message.patch.uiLanguage !== undefined
            ) {
              await chrome.tabs.sendMessage(tab.id, { type: 'SYNC_FLOATING_PANEL' });
            }
          } catch {
            /* page may not have content script */
          }
        }
        return next;
      }
      case 'OPEN_OPTIONS':
        await chrome.runtime.openOptionsPage();
        return { ok: true };
      case 'GET_AUTH':
        return getAuth();
      case 'LOGIN':
        await loginWithHxxBot();
        return getAuth();
      case 'LOGOUT':
        await clearAuth();
        return { ok: true };
      case 'GET_ACCOUNT':
        return fetchAccount();
      case 'OPEN_SUBSCRIBE': {
        const settings = await getSettings();
        const url = buildSubscribeUrl(settings);
        await chrome.tabs.create({ url });
        return { ok: true, url };
      }
      case 'CHECK_TAB_TRANSLATABLE': {
        const tab = await activeTab();
        return { translatable: !isRestrictedUrl(tab?.url), url: tab?.url || '' };
      }
      case 'TTS_GET_VOICES':
        return listEnglishVoices();
      case 'TTS_SPEAK': {
        const tabId = sender.tab?.id ?? (await activeTab())?.id ?? null;
        return speakWithChromeTts(tabId, message.text, {
          rate: message.rate,
          voiceName: message.voiceName,
          lang: message.lang,
          requestId: message.requestId,
        });
      }
      case 'TTS_STOP':
        chrome.tts.stop();
        activeTts = null;
        return { ok: true };
      case 'TTS_PAUSE':
        chrome.tts.pause();
        return { ok: true };
      case 'TTS_RESUME':
        chrome.tts.resume();
        return { ok: true };
      case 'TTS_TEST_SPEAK': {
        const settings = await getSettings();
        const requestId = `test-${Date.now()}`;
        return speakWithChromeTts(null, message.text || 'Hello. This is a HxxTranslate voice test.', {
          rate: settings.ttsRate ?? 1,
          voiceName: settings.ttsVoiceName || undefined,
          lang: 'en-US',
          requestId,
        });
      }
      case 'GET_PAGE_STATUS':
      case 'TRANSLATE_PAGE':
      case 'TRANSLATE_SELECTION':
      case 'RESTORE_PAGE':
      case 'SET_DISPLAY_MODE':
      case 'SYNC_FLOATING_PANEL':
      case 'TTS_START_PAGE':
      case 'TTS_START_SELECTION':
      case 'TTS_CONTROL':
      case 'TTS_GET_STATUS':
        return sendToTab(message);
      default: {
        const type = (message as { type?: string })?.type ?? '(empty)';
        console.warn('[HxxTranslate] unknown message:', type, message);
        return { error: t('unknownMessage', { type }) };
      }
    }
  };

  void run()
    .then(sendResponse)
    .catch((err: Error) => {
      sendResponse({ error: err.message || String(err) });
    });
  return true;
});
