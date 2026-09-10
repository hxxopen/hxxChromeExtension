export type DisplayMode = 'translation' | 'bilingual';

/** Extension UI language (not the translation target). */
export type UiLanguage = 'en' | 'zh-CN';

export type PageTranslateStatus = 'UNTRANSLATED' | 'TRANSLATING' | 'TRANSLATED' | 'RESTORING';

export type ExtensionSettings = {
  targetLanguage: string;
  displayMode: DisplayMode;
  autoTranslate: boolean;
  /** Interface language; persisted in chrome.storage.local */
  uiLanguage: UiLanguage;
  /** API 根地址（翻译/账户接口） */
  apiBase: string;
  /**
   * 网站根地址（登录页 /auth、会员中心）。
   * 留空则按 apiBase 推断：本地 :8080 → :3000，其余与 apiBase 相同。
   */
  siteBase: string;
  /** 页面右侧悬浮控制条 */
  showFloatingPanel: boolean;
  /** 悬浮条距视口顶部百分比 0–100 */
  floatingPanelTop: number;
};

export type AuthState = {
  accessToken: string;
  userId: string;
  email: string;
};

export type TranslateSegment = {
  id: string;
  text: string;
};

export type TranslateUsage = {
  characters: number;
  remaining?: number;
  limit?: number;
  unit?: string;
};

export type EntitlementInfo = {
  product_line: string;
  product_code: string;
  product_name: string;
  status: string;
  period_start?: string;
  period_end?: string;
  quota_limit: number;
  quota_used: number;
  quota_remain: number;
  quota_unit: string;
  source: string;
};

export type AccountInfo = {
  user: {
    id: number;
    email: string;
    username: string;
    nickname: string;
  };
  entitlement: EntitlementInfo;
  subscribe_url: string;
};

export type TranslateProduct = {
  code: string;
  name: string;
  amount_cents: number;
  currency: string;
  interval: string;
  description?: string;
  entitlements?: Record<string, number>;
};

export const OFFICIAL_API_BASE = 'https://www.hxxbot.com';

export const DEFAULT_SETTINGS: ExtensionSettings = {
  targetLanguage: 'zh-CN',
  displayMode: 'translation',
  autoTranslate: false,
  uiLanguage: 'en',
  apiBase: OFFICIAL_API_BASE,
  siteBase: '',
  showFloatingPanel: true,
  floatingPanelTop: 40,
};

/**
 * 浏览器登录页 / 会员中心使用的站点根地址。
 * 本地把 API 指到 :8080 时，页面仍在前端 :3000，不能把 /auth 打到后端。
 */
export function resolveSiteBase(settings: Pick<ExtensionSettings, 'apiBase' | 'siteBase'>): string {
  const explicit = (settings.siteBase || '').trim().replace(/\/$/, '');
  if (explicit) return explicit;

  const api = (settings.apiBase || OFFICIAL_API_BASE).replace(/\/$/, '');
  try {
    const u = new URL(api);
    const host = u.hostname.toLowerCase();
    if ((host === 'localhost' || host === '127.0.0.1') && (u.port === '8080' || u.port === '')) {
      // 空 port + http 默认 80，本地开发常见是显式 8080
      if (u.port === '8080') {
        u.port = '3000';
        return u.origin;
      }
    }
  } catch {
    /* keep api */
  }
  return api;
}

/** 会员中心订阅页：跟网站地址，不写死官网 */
export function buildSubscribeUrl(settings: Pick<ExtensionSettings, 'apiBase' | 'siteBase'>): string {
  return `${resolveSiteBase(settings)}/member?tab=plan&product_line=hxxtranslate`;
}

/** 与后端 extension 限额对齐（字符按 Unicode code point） */
export const LIMITS = {
  /** 单段最大字符（客户端拆分阈值，低于后端 2000） */
  maxSegmentChars: 1800,
  /** 单次请求总字符 */
  maxBatchChars: 3800,
  /** 单次请求最多段落片段数 */
  maxSegmentsPerBatch: 60,
  /** 整页分批：每批最多段落数（短段落可合并） */
  maxParagraphsPerBatch: 5,
} as const;

export const BATCH_MAX_CHARS = LIMITS.maxBatchChars;

export const TARGET_LANGUAGES: { code: string; label: string }[] = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'ru', label: 'Русский' },
  { code: 'pt', label: 'Português' },
  { code: 'it', label: 'Italiano' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'th', label: 'ไทย' },
  { code: 'ar', label: 'العربية' },
  { code: 'hi', label: 'हिन्दी' },
];

export const CLIENT_ID = 'hxxtranslate-extension';
