# HxxTranslate 与 HxxBot 账号

扩展是**纯前端客户端**：没有自己的用户库、支付或翻译服务。

只要有一个 **HxxBot 账号**（https://www.hxxbot.com），即可：

1. 在扩展里登录该账号
2. 在会员中心订阅 HxxTranslate 套餐
3. 额度、订单、Stripe 订阅全部记在这个 `users.id` 上

```
HxxBot 账号
 ├── VIP / 积分（对话）
 └── HxxTranslate 套餐与字符额度（同一账户）
         ↑
   Chrome 扩展只带登录 token 调 API
```

套餐形态可以和 VIP 不同（按字符计），但**账户是同一个**，不会再注册翻译专用账号。
