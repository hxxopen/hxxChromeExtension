import type { RuntimeMessage } from '../common/messages';
import { t } from '../common/i18n';
import { SETTINGS_KEY, getSettings } from '../common/storage';
import { applyDisplayMode, ensureStyles, isRestrictedPage } from './dom-manager';
import {
  mountFloatingPanel,
  syncFloatingPanelFromSettings,
  syncFloatingPanelState,
  syncFloatingPanelTts,
} from './floating-panel';
import {
  getState,
  onPageStateChange,
  restoreOriginal,
  setMode,
  translatePage,
  translateSelection,
} from './page-translator';
import { rememberSelection } from './text-node-parser';
import {
  getTtsStatus,
  handleTtsEvent,
  nextSegment,
  onTtsStatusChange,
  pausePlayback,
  prevSegment,
  resumePlayback,
  startPageTts,
  startSelectionTts,
  stopPlayback,
} from './tts/controller';

type HxxGlobal = Window & {
  __hxxTranslateListening?: boolean;
  __hxxTranslateHandle?: (
    message: RuntimeMessage,
    sendResponse: (payload: unknown) => void,
  ) => boolean;
  __hxxTranslateBooted?: boolean;
};

const g = window as HxxGlobal;

ensureStyles();

onPageStateChange((state) => {
  syncFloatingPanelState(state);
  void chrome.runtime
    .sendMessage({
      type: 'PAGE_STATUS_CHANGED',
      ...state,
      translatable: translatable(),
    })
    .catch(() => {
      /* popup may be closed */
    });
});

onTtsStatusChange((tts) => {
  syncFloatingPanelTts(tts);
});

function translatable(): boolean {
  return !isRestrictedPage();
}

let rememberTimer: number | undefined;
function scheduleRememberSelection(): void {
  window.clearTimeout(rememberTimer);
  rememberTimer = window.setTimeout(() => rememberSelection(), 50);
}

// 可热替换的消息处理，便于重新注入 content.js 时升级逻辑而不重复注册监听
g.__hxxTranslateHandle = (message, sendResponse) => {
  const respond = (payload: unknown) => {
    sendResponse(payload);
  };

  if (message.type === 'GET_PAGE_STATUS') {
    rememberSelection();
    respond({ ...getState(), translatable: translatable() });
    return false;
  }

  if (message.type === 'SET_DISPLAY_MODE') {
    setMode(message.mode);
    respond({ ok: true });
    return false;
  }

  if (message.type === 'SYNC_FLOATING_PANEL') {
    void (async () => {
      const settings = await getSettings();
      await syncFloatingPanelFromSettings(settings);
      respond({ ok: true });
    })();
    return true;
  }

  if (message.type === 'RESTORE_PAGE') {
    respond({ ...restoreOriginal(), translatable: translatable() });
    return false;
  }

  if (message.type === 'TRANSLATE_PAGE' || message.type === 'TRANSLATE_SELECTION') {
    void (async () => {
      const settings = await getSettings();
      if (!translatable()) {
        respond({
          status: 'UNTRANSLATED',
          progress: 0,
          translatable: false,
          error: t('pageNotTranslatable'),
        });
        return;
      }
      const result =
        message.type === 'TRANSLATE_SELECTION'
          ? await translateSelection(settings.targetLanguage, settings.displayMode)
          : await translatePage(settings.targetLanguage, settings.displayMode);
      respond({ ...result, translatable: true });
    })();
    return true;
  }

  if (message.type === 'TTS_START_PAGE') {
    void (async () => {
      if (!translatable()) {
        respond({ status: 'idle', index: 0, total: 0, error: t('pageNotTranslatable') });
        return;
      }
      rememberSelection();
      respond(await startPageTts());
    })();
    return true;
  }

  if (message.type === 'TTS_START_SELECTION') {
    void (async () => {
      if (!translatable()) {
        respond({ status: 'idle', index: 0, total: 0, error: t('pageNotTranslatable') });
        return;
      }
      rememberSelection();
      respond(await startSelectionTts());
    })();
    return true;
  }

  if (message.type === 'TTS_CONTROL') {
    void (async () => {
      switch (message.action) {
        case 'pause':
          respond(await pausePlayback());
          break;
        case 'resume':
          respond(await resumePlayback());
          break;
        case 'prev':
          respond(await prevSegment());
          break;
        case 'next':
          respond(await nextSegment());
          break;
        case 'stop':
          respond(await stopPlayback());
          break;
        default:
          respond(getTtsStatus());
      }
    })();
    return true;
  }

  if (message.type === 'TTS_GET_STATUS') {
    respond(getTtsStatus());
    return false;
  }

  if (message.type === 'TTS_EVENT') {
    void handleTtsEvent(message);
    respond({ ok: true });
    return false;
  }

  // 未识别：明确回包，避免 popup 收到 undefined；通常是页面仍挂着旧 content
  if (message?.type) {
    respond({
      error: t('unknownMessage', { type: String(message.type) }),
      status: 'idle',
      index: 0,
      total: 0,
    });
    return false;
  }

  return false;
};

if (!g.__hxxTranslateListening) {
  g.__hxxTranslateListening = true;
  document.addEventListener('mouseup', scheduleRememberSelection, true);
  document.addEventListener('keyup', scheduleRememberSelection, true);
  document.addEventListener('selectionchange', scheduleRememberSelection);

  chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
    const handle = g.__hxxTranslateHandle;
    if (!handle) return false;
    return handle(message, sendResponse);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[SETTINGS_KEY]) return;
    void (async () => {
      if (!translatable()) return;
      const settings = await getSettings();
      await syncFloatingPanelFromSettings(settings);
    })();
  });
}

if (!g.__hxxTranslateBooted) {
  g.__hxxTranslateBooted = true;
  void (async () => {
    if (!translatable()) return;
    const settings = await getSettings();
    applyDisplayMode(settings.displayMode);
    await mountFloatingPanel();
    if (settings.autoTranslate) {
      await translatePage(settings.targetLanguage, settings.displayMode);
    }
  })();
}
