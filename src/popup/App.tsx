import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import type { DisplayMode, ExtensionSettings } from '../common/types';
import { TARGET_LANGUAGES } from '../common/types';
import type { PageStatusPayload } from '../common/messages';

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
    const [s, a, status] = await Promise.all([
      send<ExtensionSettings>({ type: 'GET_SETTINGS' }),
      send<AuthState>({ type: 'GET_AUTH' }),
      send<PageStatusPayload>({ type: 'GET_PAGE_STATUS' }).catch(
        () =>
          ({
            status: 'UNTRANSLATED',
            progress: 0,
            translatable: false,
            error: '当前页面无法翻译。',
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

  const patchSettings = async (patch: Partial<ExtensionSettings>) => {
    const next = await send<ExtensionSettings>({ type: 'SAVE_SETTINGS', patch });
    setSettings(next);
  };

  const handleResult = (status: PageStatusPayload & { error?: string }) => {
    setPage(status);
    if (status.errorCode === 'UNAUTHENTICATED') {
      setNotice(formatErrorNotice('请先登录 HxxBot', status));
    } else if (status.errorCode === 'INSUFFICIENT_QUOTA') {
      setNotice(formatErrorNotice('翻译额度不足', status));
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
      setNotice((e as Error).message || '登录失败');
    } finally {
      setBusy(false);
    }
  };

  if (!settings) {
    return <div style={{ padding: 20 }}>加载中…</div>;
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
      </header>

      {blocked ? (
        <p style={{ color: '#b45309', fontSize: 13 }}>当前页面无法翻译。</p>
      ) : (
        <>
          <label style={{ display: 'block', fontSize: 13, color: '#475569', marginBottom: 6 }}>翻译为</label>
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
              ? `翻译中… ${page?.progress || 0}%`
              : '翻译当前网页'}
          </button>

          <button
            type="button"
            disabled={translating}
            onClick={() => void onTranslateSelection()}
            style={{ ...secondaryBtn(translating), marginTop: 8 }}
          >
            {hasSelection ? '翻译选中内容' : '翻译选中 / 首段'}
          </button>
          <p style={{ margin: '6px 0 0', fontSize: 11, color: '#64748b' }}>
            {hasSelection
              ? '将只翻译当前选区（过长会分批）'
              : '未检测到选区时译第一段；打开弹窗可能清掉高亮，请先选中再点，或用页面右侧「译」面板'}
          </p>

          <div style={{ margin: '16px 0 8px', fontSize: 13, color: '#475569' }}>显示方式</div>
          <label style={radioStyle}>
            <input
              type="radio"
              name="mode"
              checked={settings.displayMode === 'translation'}
              onChange={() => void patchSettings({ displayMode: 'translation' satisfies DisplayMode })}
            />
            仅显示译文
          </label>
          <label style={radioStyle}>
            <input
              type="radio"
              name="mode"
              checked={settings.displayMode === 'bilingual'}
              onChange={() => void patchSettings({ displayMode: 'bilingual' satisfies DisplayMode })}
            />
            原文 + 译文
          </label>

          <button type="button" disabled={!translated || busy} onClick={() => void onRestore()} style={secondaryBtn(!translated)}>
            恢复原文
          </button>
        </>
      )}

      {notice ? (
        <div style={{ marginTop: 12, fontSize: 13, color: '#b91c1c' }}>
          <div>{notice}</div>
          {notice.includes('登录') ? (
            <button type="button" onClick={() => void onLogin()} style={{ ...linkBtn, marginTop: 6 }}>
              登录
            </button>
          ) : null}
          {notice.includes('额度') ? (
            <button
              type="button"
              onClick={() => void send({ type: 'OPEN_SUBSCRIBE' })}
              style={{ ...linkBtn, marginTop: 6 }}
            >
              去 HxxBot 订阅
            </button>
          ) : null}
        </div>
      ) : null}

      <hr style={{ border: 0, borderTop: '1px solid #e2e8f0', margin: '18px 0 12px' }} />
      {!auth?.accessToken ? (
        <button type="button" disabled={busy} onClick={() => void onLogin()} style={{ ...linkBtn, marginBottom: 10 }}>
          登录 HxxBot 账号
        </button>
      ) : (
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>{auth.email || '已登录'}</div>
      )}
      <button
        type="button"
        onClick={() => chrome.runtime.openOptionsPage()}
        style={{ ...linkBtn, display: 'flex', alignItems: 'center', gap: 6 }}
      >
        ⚙ 设置
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
