import type { UiLanguage } from '../common/types';

export type HelpSection = {
  title: string;
  intro?: string;
  steps: string[];
  tip?: string;
};

export type VoicePackHelpContent = {
  title: string;
  why: string;
  online: HelpSection;
  offline: HelpSection;
  afterInstall: HelpSection;
  stillBroken: HelpSection;
};

const zhCN: VoicePackHelpContent = {
  title: '如何安装 Windows 英文语音包',
  why: '朗读功能依赖系统自带的英文 TTS 语音。请先点击下方「试听语音」测试；若试听失败或听不到声音，再按本说明安装。建议先试「在线安装」；在线安装失败或卡住时，再使用「离线安装」。',
  online: {
    title: '方法一：在线安装（推荐先试）',
    intro: '适合能正常访问微软更新服务的电脑。',
    steps: [
      '打开 Windows「设置」→「时间和语言」→「语言和区域」（Win10 可能显示为「语言」）。',
      '点击「添加语言」，搜索并添加 English (United States) 或 English (United Kingdom)。',
      '添加完成后，点该语言右侧「…」→「语言选项」。',
      '在「语音」/「语音识别」相关项中下载并安装语言包与语音包（Speech / Text-to-speech）。',
      '也可走另一条路径：「设置」→「时间和语言」→「语音」→「管理语音」→「添加语音」，勾选英文语音后安装。',
      '安装完成后，完全退出 Chrome（托盘图标也要退出），再重新打开本扩展设置页，点击「试听语音」验证。',
    ],
    tip: '若长时间停在「正在下载」、报错或列表里始终没有英文语音，请改用下方离线方法。',
  },
  offline: {
    title: '方法二：离线安装（UUP Dump，体积更小）',
    intro:
      '国内镜像系统常见在线语言包失败。可用 UUP Dump 只下载英语相关语言包/功能包，不必下完整 ISO。下载前请先确认本机 Windows 版本与架构，否则可能装不上。',
    steps: [
      '先查看本机系统信息（小白请按此操作）：在桌面找到「此电脑」（也叫「我的电脑」）→ 鼠标右键 → 点「属性」。也可以：按键盘 Win + I 打开「设置」→「系统」→「关于」。',
      '在打开的页面中记下两项：① Windows 信息——「Windows 规格」里的版本（如 Windows 11）和版本号/OS 内部版本（如 24H2、22H2）；② 设备信息——「设备规格」里的「系统类型」（如 64 位操作系统，基于 x64 的处理器）。多数家用电脑是 64 位 / amd64(x64)。',
      '用浏览器打开 https://uupdump.net 。',
      '在首页搜索框输入刚才记下的版本关键词，例如「Windows 11 24H2」或「Windows 10 22H2」，尽量与本机一致。',
      '进入对应版本后，选择与本机相同的架构（系统类型写 64 位时选 amd64 / x64；极少见的是 arm64），点击「Next」。',
      '语言选择页：若只需要英文语音，优先选 English（或勾选 Extra editions / language packs 中的 English），避免勾选无关语言。',
      '下载选项页：取消不需要的完整系统镜像组件；尽量只保留 Language packs、Features on Demand 中与 English、Speech / TTS / Text to speech 相关的项，以减小体积。',
      '选择下载方式（常用 aria2 脚本），按页面说明下载并运行转换/下载脚本，得到语言包相关文件（常见为 .cab / .esd 等）。',
      '安装语言包：可双击运行得到的安装包，或使用管理员命令提示符执行 lpksetup（「添加语言包」向导选中下载到的包），也可按 UUP Dump / 脚本说明用 DISM 安装。',
      '安装结束后重启电脑，再打开 Chrome → 本扩展设置 →「试听语音」。若下拉框已出现英文语音名称，即表示成功。',
    ],
    tip: '关键：只下英语相关文件即可。完整系统镜像体积很大，朗读只需要语言包/语音功能包。版本或架构选错会导致安装失败，请务必先对照「此电脑 → 属性」里的信息。',
  },
  afterInstall: {
    title: '安装后怎么确认成功',
    steps: [
      '回到本页，刷新设置页（或关掉再打开）。',
      '「默认语音」下拉列表中应出现英文语音（如 Microsoft Aria / Zira / Jenny 等）。',
      '点击「试听语音」，应能听到一句英文。',
      '仍无语音时，到「设置 → 时间和语言 → 语音」确认已安装英文语音，并设为可用。',
    ],
  },
  stillBroken: {
    title: '仍无法朗读时',
    steps: [
      '确认本机是 Windows，且已安装英文语音包（macOS / Linux 语音源不同，步骤不适用）。',
      '确认 Chrome 已完全重启（不要只刷新标签页）。',
      '在 Windows「语音」设置里先用系统自带试听，确认系统本身能出声。',
      '企业版 / LTSC / 精简版若缺少语音组件，优先用 UUP Dump 补齐对应功能包，或换用完整版系统镜像再装语言包。',
      '防火墙或公司策略若拦截微软商店/更新，在线安装通常会失败，请固定走 UUP Dump 离线流程。',
    ],
  },
};

const en: VoicePackHelpContent = {
  title: 'How to install an English voice pack on Windows',
  why: 'Read aloud needs a system English TTS voice. Click Test voice below first. If the test fails or you hear nothing, follow this guide to install a voice pack—try online install first; if that fails or gets stuck, use offline install.',
  online: {
    title: 'Method 1: Online install (try this first)',
    intro: 'Works when the PC can reach Microsoft Update / language services.',
    steps: [
      'Open Windows Settings → Time & language → Language & region (on Windows 10 it may be labeled Language).',
      'Click Add a language, then add English (United States) or English (United Kingdom).',
      'Open that language → Language options.',
      'Download Speech / Text-to-speech packages if listed.',
      'Or go to Settings → Time & language → Speech → Manage voices → Add voices, and add an English voice.',
      'Fully quit Chrome (including tray), reopen this settings page, and click Test voice.',
    ],
    tip: 'If download hangs, errors out, or no English voice appears, use the offline method below.',
  },
  offline: {
    title: 'Method 2: Offline install via UUP Dump (smaller download)',
    intro:
      'Common when online language packs fail. UUP Dump can fetch only English language / FoD packages—no full Windows ISO required. First confirm your Windows version and architecture so the download matches your PC.',
    steps: [
      'Check your PC info (beginner steps): On the desktop, find This PC (also called My Computer) → right-click → Properties. Or press Win + I → Settings → System → About.',
      'Write down two things: ① Windows specs — Edition (e.g. Windows 11) and Version / OS build (e.g. 24H2, 22H2); ② Device specs — System type (e.g. 64-bit operating system, x64-based processor). Most home PCs are 64-bit / amd64 (x64).',
      'Open https://uupdump.net in a browser.',
      'Search using the version you noted (e.g. Windows 11 24H2 or Windows 10 22H2). Match your PC as closely as possible.',
      'Pick the same architecture (choose amd64 / x64 for 64-bit; arm64 only if System type says ARM). Then Next.',
      'On the language page, prefer English (or English language packs only). Avoid unrelated languages.',
      'On download options, uncheck a full OS image if you do not need it. Keep Language packs / Features on Demand items related to English, Speech, or text-to-speech to keep the download small.',
      'Choose a download method (aria2 script is common), run the script as instructed, and obtain the language pack files (.cab / .esd, etc.).',
      'Install with the package installer, lpksetup (Add languages wizard), or DISM as documented by the UUP Dump script.',
      'Reboot, open Chrome → this settings page → Test voice. Success looks like English voice names in the Default voice list.',
    ],
    tip: 'Key point: download English-related packs only. A full ISO is huge and unnecessary for TTS. Wrong version or architecture usually fails—double-check This PC → Properties first.',
  },
  afterInstall: {
    title: 'Verify after install',
    steps: [
      'Reload this settings page.',
      'Default voice should list English voices (e.g. Microsoft Aria / Zira / Jenny).',
      'Click Test voice and confirm you hear English audio.',
      'If still empty, check Settings → Time & language → Speech that an English voice is installed.',
    ],
  },
  stillBroken: {
    title: 'If it still does not work',
    steps: [
      'Confirm you are on Windows with an English voice pack (macOS / Linux use different voice sources).',
      'Fully restart Chrome, not just the tab.',
      'Use Windows Speech settings to preview a system voice and confirm speakers work.',
      'Enterprise / LTSC / slim images may lack speech FoDs—add them via UUP Dump or a fuller image.',
      'If policies block Microsoft Store / Update, skip online install and use UUP Dump offline.',
    ],
  },
};

export function getVoicePackHelp(lang: UiLanguage): VoicePackHelpContent {
  return lang === 'zh-CN' ? zhCN : en;
}
