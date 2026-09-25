import type { UiLanguage } from '../common/types';

export type LegalDoc = {
  title: string;
  updated: string;
  paragraphs: string[];
};

export type LegalBundle = {
  privacy: LegalDoc;
  disclaimer: LegalDoc;
  terms: LegalDoc;
};

const CONTACT_EMAIL = 'fushou@hxxbot.com';
const SITE_URL = 'https://www.hxxbot.com';

export const SUPPORT_EMAIL = CONTACT_EMAIL;
export const OFFICIAL_SITE = SITE_URL;

const zhCN: LegalBundle = {
  privacy: {
    title: '隐私政策',
    updated: '更新日期：2026-09-25',
    paragraphs: [
      'HxxTranslate（以下简称「本扩展」）由 hxxopen / HxxBot 团队提供。我们重视您的隐私，本政策说明本扩展如何收集、使用与保护信息。',
      '本扩展的唯一用途是翻译您当前打开的网页文本，并提供可选的系统语音朗读。我们不会将本扩展用于广告投放、跨站追踪或与翻译无关的浏览行为分析。',
      '当您发起翻译时，本扩展会抽取页面上的可见文本片段，发送至 HxxBot（hxxbot.com）翻译接口以获取译文。请求中通常不包含完整页面 HTML、Cookie 或与翻译无关的浏览历史。',
      '为完成登录、查询账户与翻译额度，本扩展可能通过 OAuth 获取并在本地保存登录凭证（如 access token），以及您的界面语言、目标语言、显示方式、朗读偏好等设置。上述数据默认保存在您本机浏览器的 chrome.storage.local 中。',
      '朗读功能使用浏览器 / 操作系统提供的本地 TTS 能力，朗读文本在本地处理；我们不会为此单独将朗读内容上传到第三方语音云（除非您使用的系统语音本身依赖厂商服务）。',
      '我们仅在提供翻译、账户与相关支持所必需的范围内使用数据，不会出售您的个人信息。因提供翻译服务之必需，待翻译文本会传输至 HxxBot 服务器处理。',
      `如您对本政策有疑问，请联系：${CONTACT_EMAIL}。您也可访问 ${SITE_URL} 了解 HxxBot 服务相关说明。`,
      '我们可能适时更新本政策。重大变更时，将通过产品内说明或网站公告等方式提示。继续使用本扩展即视为知悉更新后的政策。',
    ],
  },
  disclaimer: {
    title: '免责声明',
    updated: '更新日期：2026-09-25',
    paragraphs: [
      '本扩展按「现状」提供。翻译结果由机器翻译生成，可能存在不准确、不完整或不当之处，请勿将其作为医疗、法律、金融等专业意见的唯一依据。',
      '因网页结构复杂、站点限制（如 chrome:// 等）、网络或第三方服务异常等原因，翻译或朗读可能失败、延迟或显示异常。我们将尽力改进，但不保证在所有页面、所有环境下均可用。',
      '朗读依赖您设备上的系统语音包与浏览器 TTS 能力。若缺少对应语言语音、系统策略限制或硬件静音等，可能导致无声或效果不佳，需由用户自行安装/配置系统语音。',
      '您对使用本扩展所产生的后果自行负责，包括但不限于对网页内容的理解偏差、操作失误，或因翻译/朗读结果作出的决策。在适用法律允许的最大范围内，开发者不对间接、附带或后果性损害承担责任。',
      '账户、订阅、额度与翻译服务由 HxxBot 提供，相关服务可用性、计费与条款以 HxxBot 当时有效的服务说明为准。',
      `如有问题，请联系 ${CONTACT_EMAIL}。`,
    ],
  },
  terms: {
    title: '用户协议',
    updated: '更新日期：2026-09-25',
    paragraphs: [
      '欢迎使用 HxxTranslate。访问或使用本扩展，即表示您同意本协议及隐私政策。若不同意，请停止使用并卸载本扩展。',
      '您应合法使用本扩展，不得利用本服务从事违法违规、侵犯他人权益、干扰服务正常运行或逆向工程、滥用接口等行为。',
      '翻译功能需要 HxxBot 账号与可用额度。您应妥善保管账号与登录凭证，对账号下的操作负责。因额度不足、订阅到期或违规导致的功能受限，由您与 HxxBot 账户体系约定处理。',
      '本扩展及其界面、图标、文档等知识产权归开发者或权利人所有。未经授权，不得复制、修改、销售或以本扩展名义提供第三方服务。',
      '我们可能更新本扩展功能与本协议。更新后继续使用，即视为接受修订内容。',
      '本协议适用中华人民共和国法律（冲突法除外）。争议应友好协商；协商不成的，提交开发者所在地有管辖权的人民法院解决。',
      `联系方式：${CONTACT_EMAIL}；官方网站：${SITE_URL}。`,
    ],
  },
};

const en: LegalBundle = {
  privacy: {
    title: 'Privacy Policy',
    updated: 'Last updated: 2026-09-25',
    paragraphs: [
      'HxxTranslate (the “Extension”) is provided by the hxxopen / HxxBot team. This policy explains how we collect, use, and protect information.',
      'The Extension’s sole purpose is to translate text on the web page you are viewing and optionally read it aloud with system TTS. We do not use the Extension for ads, cross-site tracking, or unrelated browsing analytics.',
      'When you start a translation, the Extension extracts visible text snippets and sends them to the HxxBot (hxxbot.com) translation API. Requests generally do not include full page HTML, cookies, or browsing history unrelated to translation.',
      'To sign in and check quota, the Extension may obtain OAuth credentials and store them locally, along with preferences such as UI language, target language, display mode, and read-aloud settings, in chrome.storage.local on your device.',
      'Read aloud uses browser/OS TTS. Spoken text is handled locally; we do not separately upload speech audio to a third-party cloud unless your system voice itself relies on a vendor service.',
      'We use data only as needed to provide translation, account features, and support. We do not sell your personal information. Text submitted for translation is processed on HxxBot servers as required to provide the service.',
      `Questions: ${CONTACT_EMAIL}. See also ${SITE_URL}.`,
      'We may update this policy. Material changes may be announced in-product or on the website. Continued use means you acknowledge the updated policy.',
    ],
  },
  disclaimer: {
    title: 'Disclaimer',
    updated: 'Last updated: 2026-09-25',
    paragraphs: [
      'The Extension is provided “as is.” Machine translations may be inaccurate or incomplete and must not be relied on as sole professional advice (medical, legal, financial, etc.).',
      'Complex pages, restricted URLs (e.g. chrome://), network issues, or third-party outages may cause failures or odd display. We do not guarantee availability on every site or environment.',
      'TTS depends on installed system voices and browser support. Missing voice packs, policies, or muted devices may result in no audio; you must configure system speech as needed.',
      'You are responsible for outcomes of using the Extension. To the fullest extent permitted by law, we are not liable for indirect, incidental, or consequential damages.',
      'Accounts, subscriptions, quota, and translation service are provided by HxxBot under its then-current terms.',
      `Contact: ${CONTACT_EMAIL}.`,
    ],
  },
  terms: {
    title: 'Terms of Use',
    updated: 'Last updated: 2026-09-25',
    paragraphs: [
      'By using HxxTranslate you agree to these Terms and the Privacy Policy. If you do not agree, stop using and uninstall the Extension.',
      'Use the Extension lawfully. Do not abuse the service, infringe others’ rights, disrupt operations, reverse engineer, or misuse APIs.',
      'Translation requires a HxxBot account and available quota. Keep credentials safe; you are responsible for activity under your account.',
      'Intellectual property in the Extension, UI, icons, and docs belongs to the developers or rightful owners. Unauthorized copying, modification, or resale is prohibited.',
      'We may update features and these Terms. Continued use after updates constitutes acceptance.',
      'These Terms are governed by the laws of the People’s Republic of China (excluding conflict-of-law rules). Disputes should first be resolved amicably; otherwise by a court with jurisdiction where the developer is located.',
      `Contact: ${CONTACT_EMAIL}. Website: ${SITE_URL}.`,
    ],
  },
};

export function getLegalBundle(lang: UiLanguage): LegalBundle {
  return lang === 'zh-CN' ? zhCN : en;
}
