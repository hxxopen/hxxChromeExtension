import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import type { DisplayMode, ExtensionSettings, UiLanguage } from '../common/types';
import { TARGET_LANGUAGES } from '../common/types';
import type { PageStatusPayload } from '../common/messages';
import { setUiLanguage, t, UI_LANGUAGES } from '../common/i18n';

type AuthState = { accessToken: string; userId: string; email: string } | null;

async function send<T>(msg: unknown): Promise<T> {
  return chrome.runtime.sendMessage(msg) as Promise<T>;
}

function formatErrorNotice(
  message: string,
  status: { errorCode?: string; traceId?: string; providerCode?: string },
): string {
  const parts = [message];
  if (status.errorCode) parts.push(`[${status.errorCode}]`);
  if (status.providerCode) parts.push(`provider=${status.providerCode}`);
  if (status.traceId) parts.push(`trace=${status.traceId}`);
  return parts.join(' ');
}

export default function App() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [auth, setAuth] = useState<AuthState>(null);
  const [page, setPage] = useState<PageStatusPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const s = await send<ExtensionSettings>({ type: 'GET_SETTINGS' });
    setUiLanguage(s.uiLanguage);
    const [a, status] = await Promise.all([
      send<AuthState>({ type: 'GET_AUTH' }),
      send<PageStatusPayload>({ type: 'GET_PAGE_STATUS' }).catch(
        () =>
          ({
            status: 'UNTRANSLATED',
            progress: 0,
            translatable: false,
            error: t('pageNotTranslatable'),
          }) satisfies PageStatusPayload,
      ),
    ]);
    setSettings(s);
    setAuth(a);
    setPage(status);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!settings) return;
    setUiLanguage(settings.uiLanguage);
    document.documentElement.lang = settings.uiLanguage === 'zh-CN' ? 'zh-CN' : 'en';
  }, [settings]);

  const patchSettings = async (patch: Partial<ExtensionSettings>) => {
    const next = await send<ExtensionSettings>({ type: 'SAVE_SETTINGS', patch });
    setUiLanguage(next.uiLanguage);
    setSettings(next);
    if (patch.uiLanguage) setNotice(null);
  };

  const handleResult = (status: PageStatusPayload & { error?: string }) => {
    setPage(status);
    if (status.errorCode === 'UNAUTHENTICATED') {
      setNotice(formatErrorNotice(t('loginFirst'), status));
    } else if (status.errorCode === 'INSUFFICIENT_QUOTA') {
      setNotice(formatErrorNotice(t('insufficientQuota'), status));
    } else if (status.error) {
      setNotice(formatErrorNotice(status.error, status));
    }
  };

  const onTranslatePage = async () => {
    setBusy(true);
    setNotice(null);
    try {
      handleResult(await send<PageStatusPayload>({ type: 'TRANSLATE_PAGE' }));
    } finally {
      setBusy(false);
    }
  };

  const onTranslateSelection = async () => {
    setBusy(true);
    setNotice(null);
    try {
      handleResult(await send<PageStatusPayload>({ type: 'TRANSLATE_SELECTION' }));
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async () => {
    setBusy(true);
    try {
      const status = await send<PageStatusPayload>({ type: 'RESTORE_PAGE' });
      setPage(status);
    } finally {
      setBusy(false);
    }
  };

  const onLogin = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const next = await send<AuthState & { error?: string }>({ type: 'LOGIN' });
      if (next && 'error' in next && next.error && !next.accessToken) {
        throw new Error(next.error);
      }
      setAuth(next);
    } catch (e) {
      setNotice((e as Error).message || t('loginFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (!settings) {
    return <div style={{ padding: 20 }}>{t('loading')}</div>;
  }

  const translating = page?.status === 'TRANSLATING' || busy;
  const translated = page?.status === 'TRANSLATED';
  const blocked = page && page.translatable === false;
  const hasSelection = !!page?.hasSelection;

  return (
    <div style={{ padding: '16px 16px 12px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <img
          src={chrome.runtime.getURL('icons/32.png')}
          alt=""
          width={22}
          height={22}
          style={{ borderRadius: 5, display: 'block' }}
        />
        <strong style={{ fontSize: 18 }}>HxxTranslate</strong>
        <select
          value={settings.uiLanguage}
          aria-label={t('uiLanguage')}
          onChange={(e) => void patchSettings({ uiLanguage: e.target.value as UiLanguage })}
          style={{
            marginLeft: 'auto',
            padding: '4px 6px',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            background: '#fff',
            fontSize: 12,
          }}
        >
          {UI_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
      </header>

      {blocked ? (
        <p style={{ color: '#b45309', fontSize: 13 }}>{t('pageNotTranslatable')}</p>
      ) : (
        <>
          <label style={{ display: 'block', fontSize: 13, color: '#475569', marginBottom: 6 }}>{t('translateTo')}</label>
          <select
            value={settings.targetLanguage}
            onChange={(e) => void patchSettings({ targetLanguage: e.target.value })}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              marginBottom: 14,
              background: '#fff',
            }}
          >
            {TARGET_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={translating}
            onClick={() => void onTranslatePage()}
            style={primaryBtn(translating)}
          >
            {translating && page?.status === 'TRANSLATING'
              ? t('translatingProgress', { progress: page?.progress || 0 })
              : t('translatePage')}
          </button>

          <button
            type="button"
            disabled={translating}
            onClick={() => void onTranslateSelection()}
            style={{ ...secondaryBtn(translating), marginTop: 8 }}
          >
            {hasSelection ? t('translateSelection') : t('translateSelectionOrFirst')}
          </button>
          <p style={{ margin: '6px 0 0', fontSize: 11, color: '#64748b' }}>
            {hasSelection ? t('selectionHintHas') : t('selectionHintNone')}
          </p>

          <div style={{ margin: '16px 0 8px', fontSize: 13, color: '#475569' }}>{t('displayMode')}</div>
          <label style={radioStyle}>
            <input
              type="radio"
              name="mode"
              checked={settings.displayMode === 'translation'}
              onChange={() => void patchSettings({ displayMode: 'translation' satisfies DisplayMode })}
            />
            {t('translationOnly')}
          </label>
          <label style={radioStyle}>
            <input
              type="radio"
              name="mode"
              checked={settings.displayMode === 'bilingual'}
              onChange={() => void patchSettings({ displayMode: 'bilingual' satisfies DisplayMode })}
            />
            {t('bilingual')}
          </label>

          <button type="button" disabled={!translated || busy} onClick={() => void onRestore()} style={secondaryBtn(!translated)}>
            {t('restoreOriginal')}
          </button>
        </>
      )}

      {notice ? (
        <div style={{ marginTop: 12, fontSize: 13, color: '#b91c1c' }}>
          <div>{notice}</div>
          {page?.errorCode === 'UNAUTHENTICATED' ? (
            <button type="button" onClick={() => void onLogin()} style={{ ...linkBtn, marginTop: 6 }}>
              {t('login')}
            </button>
          ) : null}
          {page?.errorCode === 'INSUFFICIENT_QUOTA' ? (
            <button
              type="button"
              onClick={() => void send({ type: 'OPEN_SUBSCRIBE' })}
              style={{ ...linkBtn, marginTop: 6 }}
            >
              {t('subscribeHxxBot')}
            </button>
          ) : null}
        </div>
      ) : null}

      <hr style={{ border: 0, borderTop: '1px solid #e2e8f0', margin: '18px 0 12px' }} />
      {!auth?.accessToken ? (
        <button type="button" disabled={busy} onClick={() => void onLogin()} style={{ ...linkBtn, marginBottom: 10 }}>
          {t('loginHxxBotAccount')}
        </button>
      ) : (
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>{auth.email || t('loggedIn')}</div>
      )}
      <button
        type="button"
        onClick={() => chrome.runtime.openOptionsPage()}
        style={{ ...linkBtn, display: 'flex', alignItems: 'center', gap: 6 }}
      >
        ⚙ {t('settings')}
      </button>
    </div>
  );
}

const radioStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 14,
  marginBottom: 8,
};

function primaryBtn(disabled: boolean): CSSProperties {
  return {
    width: '100%',
    padding: '10px 12px',
    border: 0,
    borderRadius: 10,
    background: disabled ? '#7eb3f7' : '#1677ff',
    color: '#fff',
    fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer',
  };
}

function secondaryBtn(disabled: boolean): CSSProperties {
  return {
    width: '100%',
    marginTop: 12,
    padding: '10px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    background: '#fff',
    color: disabled ? '#94a3b8' : '#0f172a',
    cursor: disabled ? 'default' : 'pointer',
  };
}

const linkBtn: CSSProperties = {
  border: 0,
  background: 'transparent',
  color: '#1677ff',
  cursor: 'pointer',
  padding: 0,
  fontSize: 14,
};
