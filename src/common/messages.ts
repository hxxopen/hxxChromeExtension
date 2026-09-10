import type { DisplayMode, ExtensionSettings, PageTranslateStatus } from './types';

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
  | ({ type: 'PAGE_STATUS_CHANGED' } & PageStatusPayload);

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
