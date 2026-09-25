import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import type { AccountInfo, DisplayMode, ExtensionSettings, TtsEndMode, TtsSpeechLang, TtsVoiceInfo, UiLanguage } from '../common/types';
import { OFFICIAL_API_BASE, TARGET_LANGUAGES, TTS_RATE_MAX, TTS_RATE_MIN } from '../common/types';
import type { TtsVoicesResponse } from '../common/messages';
import { dateLocale, setUiLanguage, t, UI_LANGUAGES } from '../common/i18n';
import { getVoicePackHelp, type HelpSection } from './tts-voice-help';
import { getLegalBundle, OFFICIAL_SITE, SUPPORT_EMAIL, type LegalDoc } from './legal-content';

type AuthState = { accessToken: string; userId: string; email: string } | null;

type NavId =
  | 'uiLanguage'
  | 'translateSettings'
  | 'autoTranslate'
  | 'floatingPanel'
  | 'ttsSettings'
  | 'account'
  | 'serviceAddress'
  | 'about'
  | 'privacyPolicy'
  | 'disclaimer'
  | 'termsOfUse';

/** Sidebar only lists primary sections; finer blocks stay on the page without nav entries. */
const NAV_ITEMS: { id: NavId; labelKey: NavId }[] = [
  { id: 'uiLanguage', labelKey: 'uiLanguage' },
  { id: 'translateSettings', labelKey: 'translateSettings' },
  { id: 'ttsSettings', labelKey: 'ttsSettings' },
  { id: 'account', labelKey: 'account' },
  { id: 'serviceAddress', labelKey: 'serviceAddress' },
  { id: 'about', labelKey: 'about' },
];

async function send<T>(msg: unknown): Promise<T> {
  return chrome.runtime.sendMessage(msg) as Promise<T>;
}

function formatDate(value: string | undefined, locale: UiLanguage): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(dateLocale(locale));
}

function scrollToSection(id: NavId) {
  const el = document.getElementById(`sec-${id}`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function App() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [auth, setAuth] = useState<AuthState>(null);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<TtsVoiceInfo[]>([]);
  const [ttsHint, setTtsHint] = useState<string | null>(null);
  const [voiceHelpOpen, setVoiceHelpOpen] = useState(false);
  const [activeNav, setActiveNav] = useState<NavId>('uiLanguage');

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

  useEffect(() => {
    if (!settings) return;
    const ids = NAV_ITEMS.map((n) => n.id);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const first = visible[0]?.target.id?.replace(/^sec-/, '') as NavId | undefined;
        if (first && ids.includes(first)) setActiveNav(first);
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: [0, 0.2, 0.6] },
    );
    for (const id of ids) {
      const el = document.getElementById(`sec-${id}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [settings]);

  const goNav = (id: NavId) => {
    setActiveNav(id);
    scrollToSection(id);
  };

  if (!settings) return <div style={{ padding: 24 }}>{t('loading')}</div>;

  const ent = account?.entitlement;
  const remain = ent?.quota_remain ?? 0;
  const locale = settings.uiLanguage;
  const legal = getLegalBundle(locale);

  return (
    <div style={shell}>
      <aside style={sidebar}>
        <div style={sidebarBrand}>HxxTranslate</div>
        <nav style={sidebarNav} aria-label={t('settingsTitle')}>
          {NAV_ITEMS.map((item) => {
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                style={active ? navItemActive : navItem}
                onClick={() => goNav(item.id)}
              >
                {t(item.labelKey)}
              </button>
            );
          })}
        </nav>
      </aside>

      <main style={main}>
        <h1 style={{ fontSize: 22, margin: '0 0 20px' }}>{t('settingsTitle')}</h1>

      <section id="sec-uiLanguage" style={card}>
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

      <section id="sec-translateSettings" style={card}>
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

      <section id="sec-autoTranslate" style={card}>
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

      <section id="sec-floatingPanel" style={card}>
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

      <section id="sec-ttsSettings" style={card}>
        <h2 style={h2}>{t('ttsSettings')}</h2>
        <label style={label} htmlFor="tts-speech-lang">
          {t('ttsSpeechLang')}
        </label>
        <select
          id="tts-speech-lang"
          value={settings.ttsSpeechLang || 'auto'}
          onChange={(e) => void patch({ ttsSpeechLang: e.target.value as TtsSpeechLang })}
          style={input}
          aria-label={t('ttsSpeechLang')}
        >
          <option value="auto">{t('ttsSpeechLangAuto')}</option>
          <option value="en">{t('ttsSpeechLangEn')}</option>
          <option value="zh">{t('ttsSpeechLangZh')}</option>
        </select>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748b' }}>{t('ttsSpeechLangHint')}</p>

        <div style={{ ...labelRow, marginTop: 14 }}>
          <label style={{ ...label, marginBottom: 0 }} htmlFor="tts-default-voice">
            {t('ttsDefaultVoice')}
          </label>
          <button
            type="button"
            style={helpBtn}
            aria-expanded={voiceHelpOpen}
            aria-controls="tts-voice-help"
            title={t('ttsVoiceHelpButton')}
            onClick={() => setVoiceHelpOpen((v) => !v)}
          >
            ?
          </button>
          <button type="button" style={helpLinkBtn} onClick={() => setVoiceHelpOpen((v) => !v)}>
            {voiceHelpOpen ? t('ttsVoiceHelpClose') : t('ttsVoiceHelpOpen')}
          </button>
        </div>
        <select
          id="tts-default-voice"
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
        {voiceHelpOpen ? <VoicePackHelpPanel lang={locale} /> : null}

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
        <label style={{ ...label, marginTop: 14 }} htmlFor="tts-end-mode">
          {t('ttsEndMode')}
        </label>
        <select
          id="tts-end-mode"
          value={settings.ttsEndMode || 'stop'}
          onChange={(e) => void patch({ ttsEndMode: e.target.value as TtsEndMode })}
          style={input}
          aria-label={t('ttsEndMode')}
        >
          <option value="loop">{t('ttsEndModeLoop')}</option>
          <option value="stop">{t('ttsEndModeStop')}</option>
          <option value="exit">{t('ttsEndModeExit')}</option>
        </select>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748b' }}>{t('ttsEndModeHint')}</p>
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

      <section id="sec-account" style={card}>
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

      <section id="sec-serviceAddress" style={card}>
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

      <section id="sec-about" style={card}>
        <h2 style={h2}>{t('about')}</h2>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>HxxTranslate</p>
        <p style={{ margin: '8px 0 0', fontSize: 13, color: '#475569' }}>
          {t('aboutVersion')}：1.1.1
        </p>
        <p style={{ margin: '10px 0 0', fontSize: 13, color: '#475569' }}>
          {t('aboutContact')}：
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: '#1677ff' }}>
            {SUPPORT_EMAIL}
          </a>
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 13, color: '#475569' }}>
          {t('aboutWebsite')}：
          <a href={OFFICIAL_SITE} target="_blank" rel="noreferrer" style={{ color: '#1677ff' }}>
            {OFFICIAL_SITE}
          </a>
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
          <button type="button" style={ghost} onClick={() => goNav('privacyPolicy')}>
            {t('privacyPolicy')}
          </button>
          <button type="button" style={ghost} onClick={() => goNav('disclaimer')}>
            {t('disclaimer')}
          </button>
          <button type="button" style={ghost} onClick={() => goNav('termsOfUse')}>
            {t('termsOfUse')}
          </button>
        </div>
      </section>

      <section id="sec-privacyPolicy" style={card}>
        <LegalSection doc={legal.privacy} />
      </section>

      <section id="sec-disclaimer" style={card}>
        <LegalSection doc={legal.disclaimer} />
      </section>

      <section id="sec-termsOfUse" style={card}>
        <LegalSection doc={legal.terms} />
      </section>
      </main>
    </div>
  );
}

function LegalSection({ doc }: { doc: LegalDoc }) {
  return (
    <>
      <h2 style={h2}>{doc.title}</h2>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#94a3b8' }}>{doc.updated}</p>
      {doc.paragraphs.map((p) => (
        <p key={p.slice(0, 24)} style={{ margin: '0 0 10px', fontSize: 13, color: '#334155', lineHeight: 1.65 }}>
          {p}
        </p>
      ))}
    </>
  );
}

function HelpSectionBlock({ section }: { section: HelpSection }) {
  return (
    <div style={{ marginTop: 14 }}>
      <h4 style={{ margin: '0 0 6px', fontSize: 13, color: '#0f172a' }}>{section.title}</h4>
      {section.intro ? (
        <p style={{ margin: '0 0 8px', fontSize: 12, color: '#64748b', lineHeight: 1.55 }}>{section.intro}</p>
      ) : null}
      <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#334155', lineHeight: 1.65 }}>
        {section.steps.map((step) => (
          <li key={step} style={{ marginBottom: 4 }}>
            {linkify(step)}
          </li>
        ))}
      </ol>
      {section.tip ? (
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 12,
            color: '#92400e',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 8,
            padding: '8px 10px',
            lineHeight: 1.55,
          }}
        >
          {section.tip}
        </p>
      ) : null}
    </div>
  );
}

function linkify(text: string) {
  const url = 'https://uupdump.net';
  if (!text.includes(url)) return text;
  const parts = text.split(url);
  return (
    <>
      {parts[0]}
      <a href={url} target="_blank" rel="noreferrer" style={{ color: '#1677ff' }}>
        {url}
      </a>
      {parts.slice(1).join(url)}
    </>
  );
}

function VoicePackHelpPanel({ lang }: { lang: UiLanguage }) {
  const help = getVoicePackHelp(lang);
  return (
    <div
      id="tts-voice-help"
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 10,
        border: '1px solid #bfdbfe',
        background: '#f8fbff',
      }}
    >
      <h3 style={{ margin: '0 0 8px', fontSize: 14, color: '#0f172a' }}>{help.title}</h3>
      <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.55 }}>{help.why}</p>
      <HelpSectionBlock section={help.online} />
      <HelpSectionBlock section={help.offline} />
      <HelpSectionBlock section={help.fullIso} />
      <HelpSectionBlock section={help.afterInstall} />
      <HelpSectionBlock section={help.stillBroken} />
    </div>
  );
}

const shell: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  minHeight: '100vh',
  maxWidth: 1100,
  margin: '0 auto',
};

const sidebar: CSSProperties = {
  position: 'sticky',
  top: 0,
  alignSelf: 'flex-start',
  width: 200,
  flexShrink: 0,
  height: '100vh',
  padding: '24px 12px 24px 16px',
  borderRight: '1px solid #e2e8f0',
  background: '#fff',
  overflowY: 'auto',
};

const sidebarBrand: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: '#0f172a',
  margin: '0 8px 16px',
};

const sidebarNav: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const navItem: CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  border: 0,
  background: 'transparent',
  color: '#475569',
  fontSize: 13,
  padding: '8px 10px',
  borderRadius: 8,
  cursor: 'pointer',
};

const navItemActive: CSSProperties = {
  ...navItem,
  background: '#eff6ff',
  color: '#1d4ed8',
  fontWeight: 600,
};

const main: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '28px 28px 64px',
  maxWidth: 640,
};

const card: CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: 18,
  marginBottom: 16,
  scrollMarginTop: 20,
};

const h2: CSSProperties = { fontSize: 15, margin: '0 0 12px' };
const label: CSSProperties = { display: 'block', fontSize: 13, color: '#475569', marginBottom: 6 };
const labelRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 6,
};
const helpBtn: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: '50%',
  border: '1px solid #93c5fd',
  background: '#eff6ff',
  color: '#1d4ed8',
  fontSize: 13,
  fontWeight: 700,
  lineHeight: '20px',
  padding: 0,
  cursor: 'pointer',
};
const helpLinkBtn: CSSProperties = {
  border: 0,
  background: 'transparent',
  color: '#1677ff',
  fontSize: 12,
  padding: 0,
  cursor: 'pointer',
};
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
