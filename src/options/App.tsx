import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import type { AccountInfo, DisplayMode, ExtensionSettings, TtsVoiceInfo, UiLanguage } from '../common/types';
import { OFFICIAL_API_BASE, TARGET_LANGUAGES, TTS_RATE_MAX, TTS_RATE_MIN } from '../common/types';
import type { TtsVoicesResponse } from '../common/messages';
import { dateLocale, setUiLanguage, t, UI_LANGUAGES } from '../common/i18n';

type AuthState = { accessToken: string; userId: string; email: string } | null;

async function send<T>(msg: unknown): Promise<T> {
  return chrome.runtime.sendMessage(msg) as Promise<T>;
}

function formatDate(value: string | undefined, locale: UiLanguage): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(dateLocale(locale));
}

export default function App() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [auth, setAuth] = useState<AuthState>(null);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<TtsVoiceInfo[]>([]);
  const [ttsHint, setTtsHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    const s = await send<ExtensionSettings>({ type: 'GET_SETTINGS' });
    setUiLanguage(s.uiLanguage);
    const a = await send<AuthState>({ type: 'GET_AUTH' });
    setSettings(s);
    setAuth(a);
    try {
      const vr = await send<TtsVoicesResponse>({ type: 'TTS_GET_VOICES' });
      setVoices(vr.voices || []);
    } catch {
      setVoices([]);
    }
    if (a?.accessToken) {
      try {
        const acc = await send<AccountInfo>({ type: 'GET_ACCOUNT' });
        setAccount(acc);
        setError(null);
      } catch (e) {
        setAccount(null);
        setError((e as Error).message || t('cannotLoadAccount'));
      }
    } else {
      setAccount(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!settings) return;
    setUiLanguage(settings.uiLanguage);
    document.documentElement.lang = settings.uiLanguage === 'zh-CN' ? 'zh-CN' : 'en';
    document.title = t('settingsTitle');
  }, [settings]);

  const patch = async (p: Partial<ExtensionSettings>) => {
    const next = await send<ExtensionSettings>({ type: 'SAVE_SETTINGS', patch: p });
    setUiLanguage(next.uiLanguage);
    setSettings(next);
  };

  const onLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      await send({ type: 'LOGIN' });
      await load();
    } catch (e) {
      setError((e as Error).message || t('loginFailed'));
    } finally {
      setBusy(false);
    }
  };

  const onLogout = async () => {
    await send({ type: 'LOGOUT' });
    setAuth(null);
    setAccount(null);
  };

  const onTestVoice = async () => {
    setTtsHint(t('ttsTesting'));
    try {
      const res = (await send<{ ok?: boolean; error?: string }>({ type: 'TTS_TEST_SPEAK' })) || {};
      if (res.ok === false) {
        setTtsHint(t('ttsTestingFailed', { error: res.error || t('ttsFailed') }));
        return;
      }
      setTtsHint(t('ttsTestingPlaying'));
      window.setTimeout(() => setTtsHint(t('ttsTestingDone')), 2500);
    } catch (e) {
      setTtsHint(t('ttsTestingFailed', { error: (e as Error).message || t('ttsFailed') }));
    }
  };

  if (!settings) return <div style={{ padding: 24 }}>{t('loading')}</div>;

  const ent = account?.entitlement;
  const remain = ent?.quota_remain ?? 0;
  const locale = settings.uiLanguage;

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 20px 48px' }}>
      <h1 style={{ fontSize: 22, margin: '0 0 24px' }}>{t('settingsTitle')}</h1>

      <section style={card}>
        <h2 style={h2}>{t('uiLanguage')}</h2>
        <select
          value={settings.uiLanguage}
          onChange={(e) => void patch({ uiLanguage: e.target.value as UiLanguage })}
          style={input}
          aria-label={t('uiLanguage')}
        >
          {UI_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748b' }}>{t('uiLanguageHint')}</p>
      </section>

      <section style={card}>
        <h2 style={h2}>{t('translateSettings')}</h2>
        <label style={label}>{t('defaultTargetLanguage')}</label>
        <select
          value={settings.targetLanguage}
          onChange={(e) => void patch({ targetLanguage: e.target.value })}
          style={input}
        >
          {TARGET_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>

        <div style={{ marginTop: 16, fontSize: 13, color: '#475569' }}>{t('translationDisplay')}</div>
        <label style={radio}>
          <input
            type="radio"
            checked={settings.displayMode === 'translation'}
            onChange={() => void patch({ displayMode: 'translation' satisfies DisplayMode })}
          />
          {t('translationOnly')}
        </label>
        <label style={radio}>
          <input
            type="radio"
            checked={settings.displayMode === 'bilingual'}
            onChange={() => void patch({ displayMode: 'bilingual' satisfies DisplayMode })}
          />
          {t('bilingual')}
        </label>
      </section>

      <section style={card}>
        <h2 style={h2}>{t('autoTranslate')}</h2>
        <label style={radio}>
          <input
            type="checkbox"
            checked={settings.autoTranslate}
            onChange={(e) => void patch({ autoTranslate: e.target.checked })}
          />
          {t('autoTranslatePage')}
        </label>
      </section>

      <section style={card}>
        <h2 style={h2}>{t('floatingPanel')}</h2>
        <label style={radio}>
          <input
            type="checkbox"
            checked={settings.showFloatingPanel !== false}
            onChange={(e) => void patch({ showFloatingPanel: e.target.checked })}
          />
          {t('showFloatingPanel')}
        </label>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748b' }}>{t('floatingPanelHint')}</p>
      </section>

      <section style={card}>
        <h2 style={h2}>{t('ttsSettings')}</h2>
        <label style={label}>{t('ttsDefaultVoice')}</label>
        <select
          value={settings.ttsVoiceName || ''}
          onChange={(e) => void patch({ ttsVoiceName: e.target.value })}
          style={input}
        >
          <option value="">{t('ttsSystemDefault')}</option>
          {voices.map((v) => (
            <option key={v.voiceName} value={v.voiceName}>
              {v.voiceName} ({v.lang})
            </option>
          ))}
        </select>
        {!voices.length ? (
          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#b45309' }}>{t('ttsNoVoices')}</p>
        ) : null}

        <label style={{ ...label, marginTop: 14 }}>
          {t('ttsRate')} · {Number((settings.ttsRate ?? 1).toFixed(2))}x
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{TTS_RATE_MIN}x</span>
          <input
            type="range"
            min={TTS_RATE_MIN}
            max={TTS_RATE_MAX}
            step={0.05}
            value={settings.ttsRate ?? 1}
            onChange={(e) => void patch({ ttsRate: Number(e.target.value) })}
            style={{ flex: 1, accentColor: '#3b82f6' }}
          />
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{TTS_RATE_MAX}x</span>
        </div>

        <label style={radio}>
          <input
            type="checkbox"
            checked={settings.ttsSplitParagraphs !== false}
            onChange={(e) => void patch({ ttsSplitParagraphs: e.target.checked })}
          />
          {t('ttsSplitParagraphs')}
        </label>
        <label style={radio}>
          <input
            type="checkbox"
            checked={settings.ttsHighlight !== false}
            onChange={(e) => void patch({ ttsHighlight: e.target.checked })}
          />
          {t('ttsHighlightCurrent')}
        </label>
        <label style={radio}>
          <input
            type="checkbox"
            checked={settings.ttsAutoStopAtEnd !== false}
            onChange={(e) => void patch({ ttsAutoStopAtEnd: e.target.checked })}
          />
          {t('ttsAutoStopAtEnd')}
        </label>
        <label style={radio}>
          <input
            type="checkbox"
            checked={settings.ttsRememberVoiceRate !== false}
            onChange={(e) => void patch({ ttsRememberVoiceRate: e.target.checked })}
          />
          {t('ttsRememberVoiceRate')}
        </label>
        <button type="button" style={{ ...primary, marginTop: 14 }} onClick={() => void onTestVoice()}>
          {t('ttsTestVoice')}
        </button>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748b' }}>{t('ttsTestHint')}</p>
        {ttsHint ? <p style={{ margin: '8px 0 0', fontSize: 13, color: '#0369a1' }}>{ttsHint}</p> : null}
      </section>

      <section style={card}>
        <h2 style={h2}>{t('account')}</h2>
        {auth?.accessToken && account ? (
          <>
            <p style={{ margin: '0 0 8px' }}>{account.user.email || auth.email}</p>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#64748b' }}>{t('accountNote')}</p>
            <p style={{ margin: '0 0 4px', fontSize: 14 }}>
              {t('currentPlan', { name: ent?.product_name || t('freePlan') })}
            </p>
            <p style={{ margin: '0 0 16px', fontSize: 14 }}>
              {t('validUntil', { date: formatDate(ent?.period_end, locale) })}
            </p>
            <p style={{ margin: '0 0 16px', fontSize: 14 }}>
              {t('remainingQuota', { remain: remain.toLocaleString(dateLocale(locale)) })}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={primary} onClick={() => void send({ type: 'OPEN_SUBSCRIBE' })}>
                {t('subscribeInHxxBot')}
              </button>
              <button type="button" style={ghost} onClick={() => void onLogout()}>
                {t('logout')}
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 14, color: '#475569' }}>{t('loginHint')}</p>
            <button type="button" style={primary} disabled={busy} onClick={() => void onLogin()}>
              {busy ? t('loggingIn') : t('loginHxxBot')}
            </button>
          </>
        )}
        {error ? <p style={{ color: '#b91c1c', fontSize: 13 }}>{error}</p> : null}
      </section>

      <section style={card}>
        <h2 style={h2}>{t('serviceAddress')}</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={settings.apiBase}
            onChange={(e) => void patch({ apiBase: e.target.value })}
            style={{ ...input, flex: 1 }}
          />
          <button
            type="button"
            style={{ ...ghost, whiteSpace: 'nowrap' }}
            onClick={() => void patch({ apiBase: OFFICIAL_API_BASE, siteBase: '' })}
            title={OFFICIAL_API_BASE}
          >
            {t('officialServer')}
          </button>
        </div>
      </section>

      <section style={card}>
        <h2 style={h2}>{t('about')}</h2>
        <p style={{ margin: 0 }}>HxxTranslate</p>
        <p style={{ margin: '4px 0 0', color: '#64748b' }}>Version 1.1.0</p>
      </section>
    </div>
  );
}

const card: CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: 18,
  marginBottom: 16,
};

const h2: CSSProperties = { fontSize: 15, margin: '0 0 12px' };
const label: CSSProperties = { display: 'block', fontSize: 13, color: '#475569', marginBottom: 6 };
const input: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
};
const radio: CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, fontSize: 14 };
const primary: CSSProperties = {
  background: '#1677ff',
  color: '#fff',
  border: 0,
  borderRadius: 8,
  padding: '8px 14px',
  cursor: 'pointer',
};
const ghost: CSSProperties = {
  background: '#fff',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  padding: '8px 14px',
  cursor: 'pointer',
};
