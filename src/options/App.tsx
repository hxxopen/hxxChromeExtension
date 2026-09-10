import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import type { AccountInfo, DisplayMode, ExtensionSettings } from '../common/types';
import { OFFICIAL_API_BASE, TARGET_LANGUAGES } from '../common/types';

type AuthState = { accessToken: string; userId: string; email: string } | null;

async function send<T>(msg: unknown): Promise<T> {
  return chrome.runtime.sendMessage(msg) as Promise<T>;
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function App() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [auth, setAuth] = useState<AuthState>(null);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const s = await send<ExtensionSettings>({ type: 'GET_SETTINGS' });
    const a = await send<AuthState>({ type: 'GET_AUTH' });
    setSettings(s);
    setAuth(a);
    if (a?.accessToken) {
      try {
        const acc = await send<AccountInfo>({ type: 'GET_ACCOUNT' });
        setAccount(acc);
        setError(null);
      } catch (e) {
        setAccount(null);
        setError((e as Error).message || '无法加载账户信息');
      }
    } else {
      setAccount(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = async (p: Partial<ExtensionSettings>) => {
    const next = await send<ExtensionSettings>({ type: 'SAVE_SETTINGS', patch: p });
    setSettings(next);
  };

  const onLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      await send({ type: 'LOGIN' });
      await load();
    } catch (e) {
      setError((e as Error).message || '登录失败');
    } finally {
      setBusy(false);
    }
  };

  const onLogout = async () => {
    await send({ type: 'LOGOUT' });
    setAuth(null);
    setAccount(null);
  };

  if (!settings) return <div style={{ padding: 24 }}>加载中…</div>;

  const ent = account?.entitlement;
  const remain = ent?.quota_remain ?? 0;

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 20px 48px' }}>
      <h1 style={{ fontSize: 22, margin: '0 0 24px' }}>HxxTranslate 设置</h1>

      <section style={card}>
        <h2 style={h2}>翻译设置</h2>
        <label style={label}>默认目标语言</label>
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

        <div style={{ marginTop: 16, fontSize: 13, color: '#475569' }}>翻译显示</div>
        <label style={radio}>
          <input
            type="radio"
            checked={settings.displayMode === 'translation'}
            onChange={() => void patch({ displayMode: 'translation' satisfies DisplayMode })}
          />
          仅显示译文
        </label>
        <label style={radio}>
          <input
            type="radio"
            checked={settings.displayMode === 'bilingual'}
            onChange={() => void patch({ displayMode: 'bilingual' satisfies DisplayMode })}
          />
          原文 + 译文
        </label>
      </section>

      <section style={card}>
        <h2 style={h2}>自动翻译</h2>
        <label style={radio}>
          <input
            type="checkbox"
            checked={settings.autoTranslate}
            onChange={(e) => void patch({ autoTranslate: e.target.checked })}
          />
          打开网页后自动翻译整页
        </label>
      </section>

      <section style={card}>
        <h2 style={h2}>页面控制条</h2>
        <label style={radio}>
          <input
            type="checkbox"
            checked={settings.showFloatingPanel !== false}
            onChange={(e) => void patch({ showFloatingPanel: e.target.checked })}
          />
          显示右侧悬浮控制条（鼠标靠近展开，可上下拖动）
        </label>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748b' }}>
          可在页面右侧直接点「翻译整页 / 选中首段」，无需反复打开扩展弹窗。
        </p>
      </section>

      <section style={card}>
        <h2 style={h2}>账户</h2>
        {auth?.accessToken && account ? (
          <>
            <p style={{ margin: '0 0 8px' }}>{account.user.email || auth.email}</p>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#64748b' }}>
              HxxBot 账号，订阅与额度记在该账户中
            </p>
            <p style={{ margin: '0 0 4px', fontSize: 14 }}>
              当前套餐：{ent?.product_name || '免费版'}
            </p>
            <p style={{ margin: '0 0 4px', fontSize: 14 }}>有效期：{formatDate(ent?.period_end)}</p>
            <p style={{ margin: '0 0 16px', fontSize: 14 }}>
              剩余翻译额度：{remain.toLocaleString()}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={primary} onClick={() => void send({ type: 'OPEN_SUBSCRIBE' })}>
                在 HxxBot 会员中心订阅
              </button>
              <button type="button" style={ghost} onClick={() => void onLogout()}>
                退出登录
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 14, color: '#475569' }}>
              使用已有 HxxBot 账号登录。无需单独注册，订阅与翻译额度都记在该账号上。
            </p>
            <button type="button" style={primary} disabled={busy} onClick={() => void onLogin()}>
              {busy ? '登录中…' : '登录 HxxBot'}
            </button>
          </>
        )}
        {error ? <p style={{ color: '#b91c1c', fontSize: 13 }}>{error}</p> : null}
      </section>

      <section style={card}>
        <h2 style={h2}>服务地址</h2>
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
            官方服务器
          </button>
        </div>
      </section>

      <section style={card}>
        <h2 style={h2}>关于</h2>
        <p style={{ margin: 0 }}>HxxTranslate</p>
        <p style={{ margin: '4px 0 0', color: '#64748b' }}>Version 1.0.0</p>
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
