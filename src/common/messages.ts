import type {
  DisplayMode,
  ExtensionSettings,
  PageTranslateStatus,
  TtsPlaybackStatus,
  TtsVoiceInfo,
} from './types';

export type TtsControlAction = 'pause' | 'resume' | 'prev' | 'next' | 'reset' | 'stop';

export type TtsEventType = 'start' | 'end' | 'word' | 'error' | 'interrupted' | 'cancelled';

export type RuntimeMessage =
  | { type: 'GET_PAGE_STATUS' }
  | { type: 'TRANSLATE_PAGE' }
  | { type: 'TRANSLATE_SELECTION' }
  | { type: 'RESTORE_PAGE' }
  | { type: 'SET_DISPLAY_MODE'; mode: DisplayMode }
  | { type: 'SYNC_FLOATING_PANEL' }
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; patch: Partial<ExtensionSettings> }
  | { type: 'LOGIN' }
  | { type: 'LOGOUT' }
  | { type: 'GET_ACCOUNT' }
  | { type: 'GET_AUTH' }
  | { type: 'OPEN_SUBSCRIBE' }
  | { type: 'OPEN_OPTIONS' }
  | { type: 'CHECK_TAB_TRANSLATABLE' }
  | ({ type: 'PAGE_STATUS_CHANGED' } & PageStatusPayload)
  | { type: 'TTS_START_PAGE' }
  | { type: 'TTS_START_SELECTION' }
  | { type: 'TTS_CONTROL'; action: TtsControlAction }
  | { type: 'TTS_GET_STATUS' }
  | { type: 'TTS_SPEAK'; text: string; rate?: number; voiceName?: string; lang?: string; requestId: string }
  | { type: 'TTS_STOP' }
  | { type: 'TTS_PAUSE' }
  | { type: 'TTS_RESUME' }
  | { type: 'TTS_GET_VOICES' }
  | { type: 'TTS_EVENT'; event: TtsEventType; requestId: string; errorMessage?: string; charIndex?: number }
  | ({ type: 'TTS_STATUS_CHANGED' } & TtsStatusPayload)
  | { type: 'TTS_TEST_SPEAK'; text?: string };

export type PageStatusPayload = {
  status: PageTranslateStatus;
  progress: number;
  error?: string;
  errorCode?: string;
  traceId?: string;
  providerCode?: string;
  translatable: boolean;
  hasSelection?: boolean;
  selectionOnly?: boolean;
};

export type TtsStatusPayload = {
  status: TtsPlaybackStatus;
  index: number;
  total: number;
  preview?: string;
  error?: string;
};

export type BgTranslateRequest = {
  type: 'BG_TRANSLATE';
  sourceLang: string;
  targetLang: string;
  segments: { id: string; text: string }[];
};

export type BgTranslateResponse = {
  ok: boolean;
  translations?: { id: string; text: string }[];
  usage?: { characters: number; remaining?: number };
  error?: string;
  errorCode?: string;
  traceId?: string;
  providerCode?: string;
  subscribeUrl?: string;
};

export type TtsVoicesResponse = {
  voices: TtsVoiceInfo[];
};
