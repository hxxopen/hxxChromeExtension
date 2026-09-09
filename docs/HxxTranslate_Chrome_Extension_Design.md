# HxxTranslate Chrome 扩展设计文档

**版本：** v1.0 MVP  
**产品名称：** HxxTranslate  
**产品定位：** 面向中文用户的轻量级 Chrome 网页翻译扩展  
**核心后台：** https://www.hxxbot.com

---

## 1. 产品概述

HxxTranslate 是一个专注于**网页翻译**的 Chrome 扩展。

第一阶段不做复杂的 AI 助手能力，也不处理 PDF、图片、Word、视频字幕等其它格式，只解决一个核心问题：

> **打开网页 → 点击 HxxTranslate → 将网页翻译成用户指定的语言。**

HxxTranslate 本身不负责用户体系、订阅、支付和核心翻译模型，这些能力统一由 HxxBot 后台提供。

整体定位：

```text
HxxBot
  └── AI / 用户 / 订阅 / 计费 / 翻译 API
        ↑
        │
  HxxTranslate
  └── Chrome 网页翻译客户端
```

---

# 2. 第一阶段产品目标

### P0 必须实现

1. 翻译当前网页
2. 自动检测源语言
3. 设置目标语言
4. 仅显示译文
5. 原文 + 译文对照
6. 恢复原文
7. HxxBot 用户登录
8. 查询翻译额度
9. 订阅 / 充值
10. 自动翻译开关

### 第一阶段明确不做

- PDF 翻译
- 图片 OCR 翻译
- Word / Excel / PPT 翻译
- YouTube 字幕翻译
- AI 对话
- AI 总结
- 划词解释
- 翻译润色
- 专业术语库
- 翻译历史
- 多种翻译引擎选择

这些功能以后根据产品发展逐步增加。

---

# 3. 产品核心理念

HxxTranslate 不是一个“大而全”的 Chrome AI 助手，而是：

> **一个极简的网页翻译工具。**

用户只需要理解一个核心操作：

```text
打开国外网页
      ↓
点击 HxxTranslate
      ↓
选择目标语言
      ↓
翻译当前网页
```

不要求用户理解后台使用什么 AI 模型。

---

# 4. 用户界面设计

## 4.1 Popup

Popup 应保持极简，只展示最重要的翻译功能。

建议尺寸约：

```text
360 × 460 px
```

界面：

```text
┌────────────────────────────┐
│ 🌐 HxxTranslate             │
│                            │
│ 翻译为                      │
│                            │
│ 🇨🇳 简体中文             ▼ │
│                            │
│ ┌────────────────────────┐ │
│ │      翻译当前网页      │ │
│ └────────────────────────┘ │
│                            │
│ 显示方式                   │
│ ● 仅显示译文               │
│ ○ 原文 + 译文              │
│                            │
│ ┌────────────────────────┐ │
│ │       恢复原文         │ │
│ └────────────────────────┘ │
│                            │
│ ─────────────────────────  │
│                            │
│ ⚙ 设置                    │
└────────────────────────────┘
```

Popup 不需要展示大量账户信息。

账户、套餐、额度、订阅等信息放到设置页面。

---

# 5. 翻译显示模式

这是第一阶段最重要的产品设置之一。

## 5.1 仅显示译文

例如原网页：

```text
The semiconductor industry is undergoing a major transformation.

Global supply chains are changing rapidly.
```

翻译后：

```text
半导体产业正在经历重大变革。

全球供应链正在快速变化。
```

默认建议使用：

> **仅显示译文**

---

## 5.2 原文 + 译文

例如：

```text
The semiconductor industry is undergoing a major transformation.

半导体产业正在经历重大变革。


Global supply chains are changing rapidly.

全球供应链正在快速变化。
```

推荐采用：

> **原文下面直接增加译文**

而不是左右双栏。

原因：

- 不破坏原网页布局
- 适应窄屏
- 适应新闻网站
- 适应博客
- 适应 GitHub
- 适应文档网站
- 实现简单
- 切换显示模式方便

---

# 6. DOM 翻译设计

第一阶段只处理 HTML 网页。

核心流程：

```text
当前网页
   ↓
Content Script
   ↓
扫描 DOM
   ↓
寻找需要翻译的文本节点
   ↓
过滤不应该翻译的节点
   ↓
提取文本
   ↓
分批发送 HxxBot
   ↓
获得译文
   ↓
修改 / 扩展 DOM
```

---

# 7. 不直接破坏原网页 DOM

翻译结果应该由 HxxTranslate 自己维护。

例如原网页：

```html
<p>
    Artificial intelligence is changing the world.
</p>
```

不要直接永久覆盖原文本。

建议内部结构：

```html
<p>
    <span class="hxxtranslate-original">
        Artificial intelligence is changing the world.
    </span>

    <span class="hxxtranslate-translation">
        人工智能正在改变世界。
    </span>
</p>
```

这样可以非常容易实现：

```text
仅显示译文
        ↓
隐藏 .hxxtranslate-original

原文 + 译文
        ↓
显示 .hxxtranslate-original
显示 .hxxtranslate-translation

恢复原文
        ↓
删除 / 隐藏 HxxTranslate 添加的节点
```

---

# 8. CSS 设计

HxxTranslate 添加的 DOM 必须使用独立命名空间，避免污染网站原有 CSS。

例如：

```css
.hxxtranslate-original {
    display: block;
}

.hxxtranslate-translation {
    display: block;
}

.hxxtranslate-only-translation .hxxtranslate-original {
    display: none;
}
```

建议所有样式统一使用：

```text
hxxtranslate-
```

作为前缀。

避免与网站自身 CSS 冲突。

---

# 9. 网页内容过滤

并不是所有文本节点都应该翻译。

第一阶段至少需要过滤：

- script
- style
- noscript
- textarea
- input
- select
- code
- pre 中的代码内容
- SVG
- 隐藏节点
- HxxTranslate 自己创建的节点

重点：

> **不要翻译程序代码。**

例如 GitHub：

```text
正常文章 → 翻译

代码块 → 不翻译
```

---

# 10. 动态网页支持

现代网页大量使用 SPA 和动态加载。

例如：

```text
打开网页
   ↓
第一次翻译
   ↓
用户继续滚动
   ↓
网页加载新内容
   ↓
HxxTranslate 检测到新增 DOM
   ↓
提取新增文本
   ↓
加入翻译队列
   ↓
继续翻译
```

因此 Content Script 应使用：

```javascript
MutationObserver
```

监听网页 DOM 变化。

需要避免：

```text
翻译 DOM
  ↓
DOM 发生变化
  ↓
MutationObserver 再次触发
  ↓
再次翻译
  ↓
无限循环
```

因此所有 HxxTranslate 自己创建的 DOM 必须能够被识别并排除。

---

# 11. 翻译任务队列

不要一次把整个网页发送到后台。

例如一个网页有：

```text
50,000 字符
```

应该拆分：

```text
网页
 ↓
文本节点
 ↓
文本分组
 ↓
Batch 1
Batch 2
Batch 3
...
 ↓
HxxBot Translation API
```

例如：

```text
Batch 1    4,000 字符
Batch 2    4,000 字符
Batch 3    4,000 字符
Batch 4    4,000 字符
```

实际批大小根据 HxxBot API 限制确定。

这样可以：

- 降低单次请求失败概率
- 减少超时
- 支持逐步显示翻译结果
- 控制 API 请求大小
- 方便计费

---

# 12. 翻译过程中的用户体验

点击：

```text
翻译当前网页
```

Popup 或网页浮层显示：

```text
正在翻译...

已完成 35%
```

翻译应该逐步显示。

不要求：

```text
必须等整页翻译完成
        ↓
一次性显示
```

推荐：

```text
Batch 1 完成
    ↓
立即显示

Batch 2 完成
    ↓
立即显示

Batch 3 完成
    ↓
立即显示
```

这样用户感觉会更快。

---

# 13. HxxBot 后台架构

HxxTranslate 不建立独立账户和支付系统。

统一使用：

```text
https://www.hxxbot.com
```

后台负责：

```text
用户认证
用户信息
VIP / SVIP
订阅
支付
翻译额度
翻译计费
翻译 API
AI 模型路由
```

扩展负责：

```text
网页内容
翻译请求
翻译结果
本地配置
用户登录状态
```

---

# 14. API 建议

建议给 HxxTranslate 增加独立的 Extension API。

例如：

```text
POST /api/extension/translate
```

请求：

```json
{
    "source_lang": "auto",
    "target_lang": "zh-CN",
    "segments": [
        {
            "id": "1",
            "text": "The Future of AI"
        },
        {
            "id": "2",
            "text": "Artificial intelligence is changing the world."
        }
    ]
}
```

返回：

```json
{
    "success": true,
    "translations": [
        {
            "id": "1",
            "text": "AI 的未来"
        },
        {
            "id": "2",
            "text": "人工智能正在改变世界。"
        }
    ],
    "usage": {
        "characters": 72,
        "points": 3
    }
}
```

使用 `id` 对应原文本，可以保证：

```text
原文节点
    ↓
翻译请求
    ↓
翻译结果
    ↓
准确写回原位置
```

---

# 15. 登录机制

不建议扩展自己实现用户名密码登录。

推荐：

```text
HxxTranslate
      ↓
点击登录
      ↓
hxxbot.com 登录页面
      ↓
用户完成登录
      ↓
获取 Extension Token
      ↓
返回扩展
```

扩展保存：

```json
{
    "accessToken": "xxxxx",
    "userId": "xxxxx"
}
```

以后调用：

```http
Authorization: Bearer xxxxx
```

这样 HxxBot 可以统一管理所有 Hxx 产品的用户体系。

---

# 16. 订阅体系

HxxTranslate 不自己实现支付。

用户点击：

```text
订阅 / 充值
```

跳转：

```text
hxxbot.com
```

由 HxxBot 完成：

```text
套餐
 ↓
支付
 ↓
VIP
 ↓
额度
 ↓
翻译消费
```

这样以后可以让：

```text
HxxBot
HxxTranslate
HxxOpenWorkbench
其它 Hxx 产品
```

共享统一账户和会员体系。

---

# 17. 设置页面

设置页面也保持简单。

建议：

```text
HxxTranslate 设置

────────────────────────────

翻译设置

默认目标语言

[ 简体中文                 ▼ ]


翻译显示

● 仅显示译文
○ 原文 + 译文


自动翻译

[ 开启 / 关闭 ]


────────────────────────────

账户

fushou3579@163.com

当前套餐：VIP
有效期：2027-03-02

剩余翻译额度：8,520

[ 订阅 / 充值 ]


────────────────────────────

关于

HxxTranslate
Version 1.0.0
```

---

# 18. 自动翻译

第一阶段只需要一个简单开关：

```text
自动翻译
[ 开 / 关 ]
```

关闭：

```text
打开网页
 ↓
不自动翻译
 ↓
用户点击「翻译当前网页」
```

开启：

```text
打开网页
 ↓
检测网页
 ↓
自动翻译
```

后续可以增加网站级设置：

```text
自动翻译的网站

youtube.com
github.com
reuters.com

[ 添加网站 ]
```

但不作为 MVP 必须功能。

---

# 19. Chrome Extension 技术方案

建议使用：

```text
Chrome Extension
Manifest V3

React
TypeScript
Vite
```

主要组成：

```text
Manifest V3
│
├── Service Worker
│
├── Content Script
│
├── Popup
│
└── Options
```

---

# 20. 推荐项目结构

```text
hxxtranslate/
│
├── manifest.json
├── package.json
├── vite.config.ts
│
├── src/
│   ├── background/
│   │   └── service-worker.ts
│   │
│   ├── content/
│   │   ├── content.ts
│   │   ├── translator.ts
│   │   ├── page-translator.ts
│   │   ├── text-node-parser.ts
│   │   ├── translation-queue.ts
│   │   └── dom-manager.ts
│   │
│   ├── popup/
│   │   ├── index.html
│   │   ├── index.tsx
│   │   └── style.css
│   │
│   ├── options/
│   │   ├── index.html
│   │   ├── index.tsx
│   │   └── style.css
│   │
│   ├── api/
│   │   ├── auth.ts
│   │   ├── translate.ts
│   │   └── account.ts
│   │
│   └── common/
│       ├── storage.ts
│       ├── config.ts
│       └── types.ts
│
└── icons/
    ├── 16.png
    ├── 32.png
    ├── 48.png
    └── 128.png
```

---

# 21. Manifest 权限原则

第一版尽量减少权限。

建议从：

```json
{
    "permissions": [
        "storage",
        "activeTab",
        "scripting"
    ]
}
```

开始。

如果后续实现右键翻译，再增加：

```text
contextMenus
```

如果后续增加快捷键，再考虑：

```text
commands
```

核心原则：

> **只申请真正需要的权限。**

这样有利于用户信任以及 Chrome Web Store 审核。

---

# 22. 第一版不做右键和划词

虽然右键翻译、划词翻译以后很有价值，但 MVP 阶段建议先不做。

第一阶段只有：

```text
点击扩展图标
      ↓
Popup
      ↓
翻译当前网页
```

等网页翻译稳定以后再增加：

```text
选中文字
      ↓
翻译
```

以及：

```text
右键
      ↓
使用 HxxTranslate 翻译
```

---

# 23. 页面恢复机制

用户点击：

```text
恢复原文
```

必须能够恢复到翻译之前的状态。

原则：

> **HxxTranslate 不应该破坏原网页。**

因此需要记录：

```text
哪些 DOM 被处理
哪些文本属于原文
哪些 DOM 是 HxxTranslate 新增
```

恢复时：

```text
删除 HxxTranslate 新增节点
恢复原文本显示
清空当前页面翻译状态
```

不建议通过：

```text
location.reload()
```

恢复。

因为重新加载网页可能：

- 丢失页面状态
- 丢失滚动位置
- 重新加载大量资源
- 影响用户当前操作

---

# 24. 翻译状态

Content Script 内部可以维护：

```text
UNTRANSLATED
TRANSLATING
TRANSLATED
RESTORING
```

例如：

```text
当前网页
    │
    ├── 未翻译
    │
    ├── 翻译中
    │
    ├── 已翻译
    │
    └── 恢复原文
```

Popup 根据状态显示：

```text
未翻译：
[ 翻译当前网页 ]

翻译中：
[ 翻译中... ]

已翻译：
[ 恢复原文 ]
```

---

# 25. 错误处理

需要处理：

### 未登录

```text
请先登录 HxxBot

[ 登录 ]
```

### 额度不足

```text
翻译额度不足

[ 订阅 / 充值 ]
```

### API 请求失败

```text
翻译失败，请稍后重试

[ 重试 ]
```

### 网页不支持

例如 Chrome 内部页面：

```text
chrome://
chrome-extension://
```

提示：

```text
当前页面无法翻译。
```

---

# 26. 安全设计

HxxTranslate 不应该保存：

- 用户密码
- 支付信息
- Stripe 信息

只保存必要的认证信息，例如：

```text
accessToken
userId
配置
```

翻译请求通过 HTTPS 发送到：

```text
hxxbot.com
```

---

# 27. 数据存储

第一阶段主要使用：

```text
chrome.storage.local
```

保存：

```json
{
    "targetLanguage": "zh-CN",
    "displayMode": "translation",
    "autoTranslate": false,
    "accessToken": "xxxxx",
    "userId": "xxxxx"
}
```

其中：

```text
displayMode
```

建议：

```text
translation
bilingual
```

分别代表：

```text
translation = 仅译文
bilingual   = 原文 + 译文
```

---

# 28. 后续扩展路线

## V1.0

```text
网页翻译
├── 整页翻译
├── 自动识别源语言
├── 目标语言
├── 仅译文
├── 原文 + 译文
├── 恢复原文
├── HxxBot 登录
├── 额度
└── 订阅
```

## V1.1

```text
├── 划词翻译
├── 右键翻译
├── 快捷键
└── 翻译悬浮按钮
```

## V1.2

```text
├── 网站自动翻译
├── 网站白名单
├── 网站黑名单
└── 翻译历史
```

## V2.0

再考虑：

```text
├── PDF
├── 图片 OCR
├── YouTube 字幕
├── AI 解释
├── AI 总结
├── 专业术语
└── 翻译记忆
```

---

# 29. 最终产品架构

```text
                         HxxBot
                           │
             ┌─────────────┼─────────────┐
             │             │             │
           Auth        Translation     Billing
             │             │             │
             └─────────────┼─────────────┘
                           │
                           │ HTTPS
                           ↓
                    HxxTranslate
                           │
              ┌────────────┼────────────┐
              │            │            │
            Popup      Content Script  Options
              │            │            │
              │            │            │
              │       DOM Translation   │
              │            │            │
              └────────────┼────────────┘
                           │
                           ↓
                         Web Page
```

---

# 30. MVP 最终原则

HxxTranslate 第一版必须坚持：

### 简单

只做网页翻译。

### 快

翻译结果逐步显示，不等待整个网页。

### 稳

不破坏网页原有结构和功能。

### 可恢复

任何时候都可以恢复原文。

### 可配置

用户可以选择：

```text
目标语言
仅译文 / 原文 + 译文
自动翻译开关
```

### 与 HxxBot 深度结合

```text
HxxTranslate
       ↓
HxxBot Account
       ↓
HxxBot Translation API
       ↓
HxxBot Billing
```

---

# 31. 一句话总结

> **HxxTranslate 第一版不是做一个 Chrome AI 助手，而是做一个极简、稳定、专注网页翻译的 Chrome 扩展。**

用户只需要：

```text
打开网页
   ↓
点击 HxxTranslate
   ↓
翻译当前网页
   ↓
阅读中文
```

其它复杂能力全部暂时不要加入。
