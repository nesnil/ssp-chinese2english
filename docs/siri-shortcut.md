# Siri 语音控制钱包（iOS 快捷指令搭建指南）

通过 iPhone「快捷指令」App + 服务端 AI 语意解析，实现语音操作学习奖励钱包：

> 「嘿 Siri，打开钱包」→ Siri：「已打开，要拿钱吗？」→ 你：「给她加 5 元，因为今天作业全对」→ Siri：「已加 5 元，备注"今天作业全对"，当前余额 23 元。」

## 前置条件

1. 服务端 `.env` 已配置 `SIRI_API_TOKEN`（生成方式：`openssl rand -hex 24`），并已重启容器。
2. `GET /api/health` 返回 `"siriConfigured": true`。
3. AI 模型（DeepSeek）已在后台配置（自然语言指令需要它；固定金额指令和查余额不需要）。

以下步骤中的占位符请替换为你自己的值：

- `https://your-domain.example/your-path` → 你的站点地址（不带末尾斜杠）
- `<SIRI_API_TOKEN>` → `.env` 里的真实 token

## API 一览

| 端点 | 方法 | 用途 |
|---|---|---|
| `/api/siri/wallet/command` | POST | 自然语言指令（服务端 AI 解析），体：`{"text": "..."}` |
| `/api/siri/wallet/adjust` | POST | 固定金额加/扣钱，体：`{"amountYuan": 5, "note": "可选"}`（负数为扣） |
| `/api/siri/wallet` | GET | 查余额 |

三个端点都需要请求头 `Authorization: Bearer <SIRI_API_TOKEN>`，都返回 `speech` 字段（可直接朗读的中文整句）。

自然语言指令支持：加钱（"加 5 元，奖励作业全对"）、扣钱（"扣 2 元，上课讲话"）、查余额（"还有多少钱"）。金额、动作白名单、单次上限（100 元）均在服务端强制校验；无关内容会被解析为"没听懂"，不会动钱包。

## 指令一：「打开钱包」（主指令，自然语言）

在快捷指令 App 中新建快捷指令，命名为 **打开钱包**（名字就是 Siri 唤醒语，可自定），依次添加动作：

1. **要求输入**
   - 输入类型：文本
   - 提示：`已打开，要拿钱吗？`（Siri 会朗读这句话并等待你说话；提示语可随时改，无需改服务端）
2. **获取 URL 内容**
   - URL：`https://your-domain.example/your-path/api/siri/wallet/command`
   - 方法：POST
   - 头部：`Authorization` = `Bearer <SIRI_API_TOKEN>`
   - 请求体：JSON，字段 `text` = 变量「提供的输入」
3. **获取词典值**：获取「URL 内容」中 `speech` 的值
4. **朗读文本**：朗读「词典值」

用法：对 iPhone / AirPods / HomePod 说「嘿 Siri，打开钱包」，在提问后说出自然语言指令即可。如果说了无关内容（如"不用了"），Siri 会回"没听懂"且不会动钱包。

## 指令二：「钱包加五元」（可选，一句话直达）

复制以下结构，可做出任意固定金额指令（无追问、不走 AI、零延迟）：

1. **获取 URL 内容**
   - URL：`https://your-domain.example/your-path/api/siri/wallet/adjust`
   - 方法：POST
   - 头部：`Authorization` = `Bearer <SIRI_API_TOKEN>`
   - 请求体：JSON，`amountYuan` = `5`（扣钱用负数，如 `-2`；可加 `note` 字段写固定备注）
2. **获取词典值**：`speech`
3. **朗读文本**

## 指令三：「查钱包余额」

1. **获取 URL 内容**
   - URL：`https://your-domain.example/your-path/api/siri/wallet`
   - 方法：GET
   - 头部：`Authorization` = `Bearer <SIRI_API_TOKEN>`
2. **获取词典值**：`speech`
3. **朗读文本**

## HomePod 使用

HomePod 本身不运行快捷指令，需开启"个人请求"由 Siri 转发到你的 iPhone 执行：

家庭 App → 你的 HomePod → 设置 → 「个人请求」→ 开启（iPhone 需与 HomePod 同一网络且已登录同一 Apple ID）。

## 安全说明

- Token 等同支付口令：只保存在自己手机的快捷指令里，不要分享快捷指令给他人。
- 若怀疑泄露：修改云端 `.env` 中的 `SIRI_API_TOKEN` 并重启容器，旧 token 立即作废。
- 所有语音操作以 `adjust` 类型入账，孩子端钱包流水和管理后台账本都能看到金额与备注，可随时核对。
