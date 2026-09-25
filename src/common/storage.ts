import { normalizeUiLanguage, setUiLanguage } from './i18n';
import {
  DEFAULT_SETTINGS,
  type AuthState,
  type DisplayMode,
  type ExtensionSettings,
  type TtsEndMode,
  type TtsSpeechLang,
} from './types';

export const SETTINGS_KEY = 'hxxtranslate.settings';
const AUTH_KEY = 'hxxtranslate.auth';

export function normalizeTtsSpeechLang(value: unknown): TtsSpeechLang {
  return value === 'en' || value === 'zh' ? value : 'auto';
}

export function normalizeTtsEndMode(
  value: unknown,
  legacyAutoStop?: unknown,
): TtsEndMode {
  if (value === 'loop' || value === 'stop' || value === 'exit') return value;
  // 兼容旧勾选：关 = 停住保留播放器；开 = 播完退出
  if (legacyAutoStop === false) return 'stop';
  if (legacyAutoStop === true) return 'exit';
  return 'loop';
}

function withNormalizedSettings(settings: ExtensionSettings): ExtensionSettings {
  const next = {
    ...settings,
    uiLanguage: normalizeUiLanguage(settings.uiLanguage),
    ttsSpeechLang: normalizeTtsSpeechLang(settings.ttsSpeechLang),
    ttsEndMode: normalizeTtsEndMode(settings.ttsEndMode, settings.ttsAutoStopAtEnd),
  };
  delete next.ttsAutoStopAtEnd;
  setUiLanguage(next.uiLanguage);
  return next;
}

export async function getSettings(): Promise<ExtensionSettings> {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  return withNormalizedSettings({
    ...DEFAULT_SETTINGS,
    ...(data[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined),
  });
}

export async function saveSettings(patch: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
  const current = await getSettings();
  const next = withNormalizedSettings({ ...current, ...patch });
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

export async function getAuth(): Promise<AuthState | null> {
  const data = await chrome.storage.local.get(AUTH_KEY);
  const auth = data[AUTH_KEY] as AuthState | undefined;
  if (!auth?.accessToken) return null;
  return auth;
}

export async function saveAuth(auth: AuthState): Promise<void> {
  await chrome.storage.local.set({ [AUTH_KEY]: auth });
}

export async function clearAuth(): Promise<void> {
  await chrome.storage.local.remove(AUTH_KEY);
}

export async function getDisplayMode(): Promise<DisplayMode> {
  const s = await getSettings();
  return s.displayMode;
}
