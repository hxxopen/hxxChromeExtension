import { loginWithHxxBot } from '../api/auth';
import { fetchAccount } from '../api/account';
import { ApiError } from '../api/client';
import { translateSegments } from '../api/translate';
import type { BgTranslateRequest, BgTranslateResponse, PageStatusPayload, RuntimeMessage } from '../common/messages';
import { t } from '../common/i18n';
import { clearAuth, getAuth, getSettings, saveSettings } from '../common/storage';
import { LIMITS, buildSubscribeUrl } from '../common/types';

const BG_MAX_SEGMENTS = Math.min(60, LIMITS.maxSegmentsPerBatch);

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
  // 翻译前热更新内容脚本，避免页面仍跑旧逻辑
  if (message.type === 'TRANSLATE_PAGE' || message.type === 'TRANSLATE_SELECTION') {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js'],
      });
    } catch {
      /* restricted or inject failed; fall through to sendMessage */
    }
  }
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

chrome.runtime.onMessage.addListener((message: RuntimeMessage | BgTranslateRequest, _sender, sendResponse) => {
  const run = async () => {
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
      case 'GET_PAGE_STATUS':
      case 'TRANSLATE_PAGE':
      case 'TRANSLATE_SELECTION':
      case 'RESTORE_PAGE':
      case 'SET_DISPLAY_MODE':
      case 'SYNC_FLOATING_PANEL':
        return sendToTab<PageStatusPayload>(message);
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
