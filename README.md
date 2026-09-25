# HxxTranslate

<p align="center">
  <img src="icons/128.png" width="96" height="96" alt="HxxTranslate logo">
</p>

<p align="center">
  <strong>面向中文用户的轻量级 Chrome 网页翻译扩展</strong><br>
  A lightweight Manifest V3 Chrome extension for translating web pages.<br>
  账户、订阅与翻译能力由 <a href="https://www.hxxbot.com">HxxBot</a> 提供。
</p>

<p align="center">
  <img alt="Manifest V3" src="https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white">
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-green.svg">
</p>

---

打开网页 → 点击 HxxTranslate → 将页面翻译成你指定的语言。

扩展本身不维护用户体系、支付或翻译模型，只作为 Chrome 客户端调用 HxxBot API。

```text
HxxBot（账号 / 订阅 / 额度 / 翻译 API）
        ↑
  HxxTranslate（Chrome 网页翻译客户端）
```

## 功能

- **整页翻译**：抽取页面可见文本，分批调用翻译接口并写回 DOM
- **选区 / 首段**：翻译当前选中内容（只译选中部分，不扩成整段）；无选区时翻译第一段
- **显示模式**：仅显示译文，或原文下方对照译文（不破坏原布局）
- **一键恢复**：随时还原翻译前的页面
- **目标语言**：简体中文、繁體中文、英语、日语、韩语等 16 种
- **悬浮控制条**：页面右侧「译」面板，可拖动位置，无需反复打开弹窗
- **自动翻译**：打开网页后自动翻译整页（可在设置中关闭）
- **界面多语言**：扩展界面支持 English / 简体中文
- **朗读（TTS）**：基于系统语音朗读网页中/英文（详见下方）
- **HxxBot 登录**：通过 `chrome.identity` 完成桌面端 OAuth，额度记在同一账号

当前版本不包含 PDF / 图片 OCR、Office 文档、视频字幕、划词解释或 AI 对话。

### 本版本新增：朗读（TTS）

> 版本约 **1.1.x**（`develop`）。朗读走系统 `chrome.tts`，需本机已安装对应语言的语音包。

- **整页 / 选区朗读**：弹窗与右侧悬浮条均可发起；有选中文字时只读选中部分
- **中英文自动识别**：仅支持中文、英文；其它语言会提示不支持
- **朗读语言设置**：自动 / 英文 / 中文  
  - **自动**：整页优先读**翻译前原文**  
  - **指定语言**：优先匹配原文，再匹配译文；都不匹配则不朗读  
  - **选区**：选中什么读什么（按选中文本识别语言）
- **迷你播放器**：段进度、字幕高亮追踪当前词/字、上一段 / 暂停 / 下一段、语速调节
- **播完行为**（设置页与播放器内均可切换，默认循环）：
  - 循环播放
  - 停止并保留播放器（可点继续重播）
  - 自动退出播放器
- **语音包帮助**：设置页提供 Windows 英文语音包在线 / 离线（UUP Dump）安装说明；中文 Windows 通常自带中文语音

## 快速开始

### 环境

- Node.js 18+
- npm 9+
- Chrome 或 Edge（Chromium，支持 Manifest V3）

### 安装依赖并构建

```bash
git clone https://github.com/hxxopen/hxxChromeExtension.git
cd hxxChromeExtension
npm install
npm run build
```

构建产物在 `dist/`，这就是可加载的扩展目录。

### 加载到浏览器

1. 打开 `chrome://extensions`（Edge 为 `edge://extensions`）
2. 打开右上角 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择项目中的 `dist` 文件夹

修改源码后重新执行 `npm run build`（或使用下方的 watch 模式），再到扩展管理页点击刷新。

### 开发模式

```bash
npm run dev
```

会以 watch 方式构建 Popup / Options。Service Worker 与 Content Script 变更后请再执行一次完整 `npm run build`，然后刷新扩展。

## 使用说明

1. 点击工具栏图标打开弹窗，选择目标语言
2. 登录 [HxxBot](https://www.hxxbot.com) 账号（翻译需要额度）
3. 点击 **翻译当前网页**，或使用页面右侧 **译** 面板
4. 需要对照阅读时，切换为 **原文 + 译文**
5. 需要朗读时：选中文字后点 **朗读选中**，或点 **朗读整页**；播放器内可调语速与播完模式
6. 账户、套餐、剩余额度、朗读语言、语音包帮助、服务地址等在 **设置** 页查看

`chrome://`、扩展商店等受限页面无法注入内容脚本，因此不可翻译 / 朗读。

## 打包发布

```bash
npm run pack
```

会先完整构建，再把 `dist/` 打成 zip（`manifest.json` 位于压缩包根目录，图标一并打入）：

```text
release/HxxTranslate-<version>.zip
```

将该 zip 上传到 [Chrome 网上应用店开发者后台](https://chrome.google.com/webstore/devconsole) 即可提交审核。

> Chrome 不允许用户双击 zip / crx 直接安装。本机调试请用「加载已解压的扩展程序」指向 `dist/`。

## 项目结构

```text
├── manifest.json              # Manifest V3 配置
├── popup.html / options.html  # 弹窗与设置页入口
├── icons/                     # 16 / 32 / 48 / 128 工具栏与商店图标
├── src/
│   ├── background/            # Service Worker：登录、翻译代理、消息分发
│   ├── content/               # 内容脚本：DOM 抽取、写回、悬浮条、进度、TTS
│   ├── popup/                 # 工具栏弹窗（React）
│   ├── options/               # 设置页（React，含朗读与语音包帮助）
│   ├── api/                   # HxxBot HTTP 客户端
│   └── common/                # 类型、存储、消息协议、i18n
├── scripts/pack.mjs           # 生成商店用 zip
├── docs/                      # 设计说明、计费约定、TTS 设计稿
└── vite*.config.ts            # Popup / SW / Content 三套构建
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 扩展规范 | Chrome Extension Manifest V3 |
| 语言 | TypeScript（strict） |
| UI | React 18 |
| 构建 | Vite 5（Popup / Options / Service Worker / Content Script 分别打包） |
| 后端 | HxxBot REST API（默认 `https://www.hxxbot.com`） |

## 配置

设置页可修改 **服务地址**（`apiBase`）。留空站点地址时：

- 生产环境默认指向 `https://www.hxxbot.com`
- 本地 API 若为 `http://localhost:8080`，登录页会推断为 `http://localhost:3000`

主要接口：

| 用途 | 方法 | 路径 |
|------|------|------|
| 发起登录 | `POST` | `/api/auth/desktop/init` |
| 换取 Token | `POST` | `/api/auth/desktop/token` |
| 账户与额度 | `GET` | `/api/extension/account` |
| 网页翻译 | `POST` | `/api/extension/translate` |

登录使用 `chrome.identity.launchWebAuthFlow`，回调地址为扩展的 `https://<extension-id>.chromiumapp.org/`。自建后端时需放行该 redirect URI，并将 `client_id` 设为 `hxxtranslate-extension`。

## 权限说明

| 权限 | 用途 |
|------|------|
| `storage` | 保存设置与登录态 |
| `identity` | HxxBot OAuth 登录 |
| `activeTab` / `scripting` / `tabs` | 向当前标签页注入脚本并通信，执行翻译 / 朗读 |
| `tts` | 调用系统语音朗读中/英文 |
| 主机权限 | 仅请求 `hxxbot.com`（以及本地开发用的 localhost） |

扩展不会读取与翻译无关的浏览历史，也不会把页面内容发往 HxxBot 以外的服务器。翻译请求只提交抽取后的文本片段。

## 脚本

```bash
npm run dev         # 监听构建 Popup / Options
npm run build       # 类型检查 + 完整生产构建
npm run pack        # 构建并生成 release/*.zip
npm run typecheck   # 仅 tsc --noEmit
```

## 文档

- [产品与技术设计](docs/HxxTranslate_Chrome_Extension_Design.md)
- [账号与计费约定](docs/Billing.md)
- [朗读（TTS）设计](docs/HxxTranslate_TTS_Design/HxxTranslate_TTS_Design.md)

## 贡献

欢迎 Issue 与 Pull Request。提交前请：

1. 保持改动聚焦，避免无关重构
2. 执行 `npm run typecheck` 与 `npm run build`
3. 在 Chrome 中加载 `dist/`，验证弹窗、整页翻译、选区翻译、恢复原文，以及整页/选区朗读与播放器

较大的功能建议先开 Issue 讨论范围（本仓库定位是网页翻译客户端，而不是全能 AI 助手）。

## 许可证

[MIT](LICENSE) © hxxopen

翻译服务、账号与订阅由 [HxxBot](https://www.hxxbot.com) 提供，使用时需遵守其服务条款。
