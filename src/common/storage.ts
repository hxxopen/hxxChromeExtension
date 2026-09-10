import { normalizeUiLanguage, setUiLanguage } from './i18n';
import {
  DEFAULT_SETTINGS,
  type AuthState,
  type DisplayMode,
  type ExtensionSettings,
} from './types';

export const SETTINGS_KEY = 'hxxtranslate.settings';
const AUTH_KEY = 'hxxtranslate.auth';

function withUiLanguage(settings: ExtensionSettings): ExtensionSettings {
  const next = { ...settings, uiLanguage: normalizeUiLanguage(settings.uiLanguage) };
  setUiLanguage(next.uiLanguage);
  return next;
}

export async function getSettings(): Promise<ExtensionSettings> {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  return withUiLanguage({
    ...DEFAULT_SETTINGS,
    ...(data[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined),
  });
}

export async function saveSettings(patch: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
  const current = await getSettings();
  const next = withUiLanguage({ ...current, ...patch });
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
