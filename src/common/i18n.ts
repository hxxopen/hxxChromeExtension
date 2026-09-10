import type { UiLanguage } from './types';

export const UI_LANGUAGES: { code: UiLanguage; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '简体中文' },
];

const en = {
  loading: 'Loading…',
  pageNotTranslatable: 'This page cannot be translated.',
  translateTo: 'Translate to',
  translatingProgress: 'Translating… {progress}%',
  translatePage: 'Translate this page',
  translateSelection: 'Translate selection',
  translateSelectionOrFirst: 'Translate selection / first paragraph',
  selectionHintHas: 'Only the current selection will be translated (long text is batched).',
  selectionHintNone:
    'If nothing is selected, the first paragraph is translated. Opening the popup may clear the highlight — select first, then click, or use the floating panel on the right.',
  displayMode: 'Display',
  translationOnly: 'Translation only',
  bilingual: 'Original + translation',
  restoreOriginal: 'Restore original',
  loginFirst: 'Please sign in to HxxBot first',
  insufficientQuota: 'Translation quota exceeded',
  loginFailed: 'Sign-in failed',
  login: 'Sign in',
  subscribeHxxBot: 'Subscribe on HxxBot',
  loginHxxBotAccount: 'Sign in with HxxBot',
  loggedIn: 'Signed in',
  settings: 'Settings',
  settingsTitle: 'HxxTranslate Settings',
  translateSettings: 'Translation',
  defaultTargetLanguage: 'Default target language',
  translationDisplay: 'Display',
  autoTranslate: 'Auto-translate',
  autoTranslatePage: 'Translate the whole page when it opens',
  floatingPanel: 'Page toolbar',
  showFloatingPanel: 'Show the floating toolbar on the right (hover to expand, drag to move)',
  floatingPanelHint: 'Translate the page or selection from the right side without reopening the popup.',
  account: 'Account',
  accountNote: 'HxxBot account — subscription and quota are billed to this account',
  currentPlan: 'Current plan: {name}',
  freePlan: 'Free',
  validUntil: 'Valid until: {date}',
  remainingQuota: 'Remaining translation quota: {remain}',
  subscribeInHxxBot: 'Subscribe in HxxBot',
  logout: 'Sign out',
  loginHint:
    'Sign in with your HxxBot account. No extra registration — subscription and quota stay on that account.',
  loggingIn: 'Signing in…',
  loginHxxBot: 'Sign in to HxxBot',
  cannotLoadAccount: 'Unable to load account info',
  serviceAddress: 'Service URL',
  officialServer: 'Official server',
  about: 'About',
  uiLanguage: 'Interface language',
  uiLanguageHint: 'Your choice is saved and used the next time the extension starts.',
  fabTab: 'T',
  fabDrag: 'Drag to reposition',
  translating: 'Translating…',
  restored: 'Original restored',
  selectionTranslated: 'Selection / first paragraph translated',
  pageTranslated: 'Page translated',
  actionFailed: 'Action failed',
  willTranslateSelection: 'The selection will be translated',
  noSelectionFirstParagraph: 'Translates the first paragraph if nothing is selected',
  translatePageShort: 'Translate page',
  translateSelectionShort: 'Translate selection / first',
  progressDone: '{progress}% done',
  translateFailed: 'Translation failed. Please try again later.',
  noSelectionOrFirst: 'No translatable selection or first paragraph.',
  noTranslatableContent: 'This page has no translatable content.',
  unknownMessage:
    'Unrecognized extension message ({type}). Reload this extension on chrome://extensions and try again.',
  loginCancelled: 'Sign-in cancelled',
  noAuthCode: 'Authorization code not received',
  requestFailed: 'Request failed ({status})',
} as const;

export type MessageKey = keyof typeof en;

const zhCN: Record<MessageKey, string> = {
  loading: '加载中…',
  pageNotTranslatable: '当前页面无法翻译。',
  translateTo: '翻译为',
  translatingProgress: '翻译中… {progress}%',
  translatePage: '翻译当前网页',
  translateSelection: '翻译选中内容',
  translateSelectionOrFirst: '翻译选中 / 首段',
  selectionHintHas: '将只翻译当前选区（过长会分批）',
  selectionHintNone:
    '未检测到选区时译第一段；打开弹窗可能清掉高亮，请先选中再点，或用页面右侧「译」面板',
  displayMode: '显示方式',
  translationOnly: '仅显示译文',
  bilingual: '原文 + 译文',
  restoreOriginal: '恢复原文',
  loginFirst: '请先登录 HxxBot',
  insufficientQuota: '翻译额度不足',
  loginFailed: '登录失败',
  login: '登录',
  subscribeHxxBot: '去 HxxBot 订阅',
  loginHxxBotAccount: '登录 HxxBot 账号',
  loggedIn: '已登录',
  settings: '设置',
  settingsTitle: 'HxxTranslate 设置',
  translateSettings: '翻译设置',
  defaultTargetLanguage: '默认目标语言',
  translationDisplay: '翻译显示',
  autoTranslate: '自动翻译',
  autoTranslatePage: '打开网页后自动翻译整页',
  floatingPanel: '页面控制条',
  showFloatingPanel: '显示右侧悬浮控制条（鼠标靠近展开，可上下拖动）',
  floatingPanelHint: '可在页面右侧直接点「翻译整页 / 选中首段」，无需反复打开扩展弹窗。',
  account: '账户',
  accountNote: 'HxxBot 账号，订阅与额度记在该账户中',
  currentPlan: '当前套餐：{name}',
  freePlan: '免费版',
  validUntil: '有效期：{date}',
  remainingQuota: '剩余翻译额度：{remain}',
  subscribeInHxxBot: '在 HxxBot 会员中心订阅',
  logout: '退出登录',
  loginHint: '使用已有 HxxBot 账号登录。无需单独注册，订阅与翻译额度都记在该账号上。',
  loggingIn: '登录中…',
  loginHxxBot: '登录 HxxBot',
  cannotLoadAccount: '无法加载账户信息',
  serviceAddress: '服务地址',
  officialServer: '官方服务器',
  about: '关于',
  uiLanguage: '界面语言',
  uiLanguageHint: '更改后会保存下来，下次启动扩展时继续使用该语言。',
  fabTab: '译',
  fabDrag: '拖动调整位置',
  translating: '翻译中…',
  restored: '已恢复原文',
  selectionTranslated: '选区/首段已翻译',
  pageTranslated: '整页已翻译',
  actionFailed: '操作失败',
  willTranslateSelection: '将翻译选中内容',
  noSelectionFirstParagraph: '无选区时翻译第一段',
  translatePageShort: '翻译整页',
  translateSelectionShort: '翻译选中/首段',
  progressDone: '已完成 {progress}%',
  translateFailed: '翻译失败，请稍后重试',
  noSelectionOrFirst: '没有可翻译的选中内容或首段。',
  noTranslatableContent: '当前页面没有可翻译内容。',
  unknownMessage: '扩展消息未识别（{type}）。请到 chrome://extensions 重新加载本扩展后重试。',
  loginCancelled: '登录已取消',
  noAuthCode: '未获取到授权码',
  requestFailed: '请求失败 ({status})',
};

const catalogs: Record<UiLanguage, Record<MessageKey, string>> = {
  en,
  'zh-CN': zhCN,
};

let currentLanguage: UiLanguage = 'en';

export function normalizeUiLanguage(value: unknown): UiLanguage {
  return value === 'zh-CN' ? 'zh-CN' : 'en';
}

export function getUiLanguage(): UiLanguage {
  return currentLanguage;
}

export function setUiLanguage(lang: UiLanguage): void {
  currentLanguage = normalizeUiLanguage(lang);
}

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  let text = catalogs[currentLanguage][key] || catalogs.en[key] || key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

export function dateLocale(lang: UiLanguage = currentLanguage): string {
  return lang === 'zh-CN' ? 'zh-CN' : 'en-US';
}
