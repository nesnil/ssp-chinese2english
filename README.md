# ssp-chinese2english（C2E 每日闯关）

一个**自建的家庭英语练习 Web 应用**，围绕 SSP（Shanghai Students' Post）《中译英 每日一练》语料构建。孩子把中文句子翻译成英文，由 DeepSeek（OpenAI 兼容的对话 API）实时批改打分，进度记录在 SQLite。除中译英外，还有一套基于上海中考考纲词表（含发音）的**单词默写**练习，以及一个供家长使用的**后台管理系统**。

应用 UI 与所有面向用户的文案均为中文。

> 本仓库同时也包含当初把扫描图片/PDF 整理成结构化题库的**数据准备流水线**（`imgs/`、`pdf/`、`tools/`、`scripts/` 等）。这部分不是运行时应用的一部分，平时很少改动 —— 可运行、可部署的产物是 `web/` 下的全栈应用。

---

## 功能一览

### 中译英（每日闯关）
- **家庭口令登录**，Season / Day 闯关地图；题量统计按当前 SQLite 题库动态展示，支持后台补充题。
- 每题输入英文 → **DeepSeek AI 批改**：分数、鼓励语、最关键问题、修改建议、参考答案；满分有随机彩蛋表扬。
- Day 完整练习次数、最新完整练习均分、总完成均分。
- 分数低于阈值（默认 80）自动进入**复习中心**：当前需复习题数、累计复习题数、已掌握题数、按题查看分数轨迹、最近 100 条复习记录。

### 中考词汇练习
- 基于上海中考考纲词表（约 1650 词），**A–Z 分组、5 词一关**的闯关表。
- **听发音**（内置 mp3）→ 默写英文单词 + 各词性中文意思 → AI 批改 → 通过后默写**例句**。
- 单词级别的掌握/待复习状态，与中译英进度相互独立。

### 高考词汇练习
- 基于高中候选词表（`senior-candidate` 分类）的**A–Z 分组、10 词一关**闯关表，与中考词汇练习并列于首页标签。
- **听发音** → 默写英文单词 + 各词性中文意思 → AI 批改；**不需要默写例句**。
- 进度（掌握/待复习）与中考词汇练习互相独立，同一个单词在两套模式下各有独立的提交记录。
- 钱包结算方式不同：按**整组平均分**在完成一组后一次性结算（可配置奖励/扣除平均分阈值），而非逐题结算。

### 每日完成情况（活动日历）
- 首页右上角日历图标进入，按年展示全年每天的练习记录。
- 每天格子分三行展示：中译英、中考词汇、高考词汇；蓝色为三项都有记录，黄色为当天有练习，灰色为未练。
- 点击格子查看当天详情：具体完成的关卡/词汇关、练习类型、时间、得分。
- 顶栏汇总：当前连续天数、最长连续天数、年度完成天数、总均分。
- 数据时区固定使用上海时间（`Asia/Shanghai`），与服务器环境变量 `TZ` 一致。

### 钱包奖励（零花钱激励）
- 中译英 / 中考词汇练习达到**奖励分数**：随机奖励整元零花钱（默认 100 分、1～3 元），每道题（或每个单词的某个阶段）**历史上只奖一次**。
- 单题**首次**得分低于**扣除分数**：随机扣除整元零花钱（默认低于 60 分、1～2 元），只在首次有效提交时扣，复习不会扣，AI 批改失败的提交不奖不罚。
- **高考词汇练习**按整组平均分结算：完成一组后，均分达到配置阈值（默认 90 分）奖励，低于扣除阈值（默认 70 分）扣罚；同一组仅结算一次；复习模式不结算。
- 顶栏实时显示**余额**，反馈卡片里有当次奖惩提示。
- 余额达到**提现门槛**（默认 10 元）可发起提现，家长在后台标记「已发放」后清零。
- 金额与门槛均由家长在后台调；**不走环境变量**。

### 后台管理（家长专用）
- **独立管理员口令**（`ADMIN_PASSWORD`），与孩子的家庭口令分离；孩子进不了后台。
- 入口：登录页的「管理员登录」链接，或 `#admin` URL hash，或管理员登录后顶栏的齿轮。
- **题库管理**：列出全部中译英题目，按 Season / Day 筛选、关键词搜索、分页；增删改查（参考答案可改）。
- **单词管理**：列出全部单词，按**分类**（中考考纲/高中/四六级候选等）筛选、**A–Z 首字母**筛选、搜索、分页；增删改查，编辑词性（下拉）、释义、例句、分类（多选），列表内可试听发音，缺发音时可生成/重新生成 mp3。
- **AI 模型配置**：在后台「模型」页填写批改用的 Base URL、API Key、模型名、超时（毫秒），保存即时生效、无需改环境变量重启；提供「测试连接」按钮先验证再保存。保存的配置存入 SQLite（`model_settings` 表），优先级高于启动时的 `DEEPSEEK_*` 环境变量；未保存任何配置时回退到环境变量。API Key 仅写不回显。
- **TTS 发音模型配置**：后台「模型」页单独配置发音 provider，支持 OpenAI-compatible 与火山引擎；火山新版配置包含 Base URL、API Key、Resource ID、Speaker、Encoding、超时。保存到 SQLite（`tts_settings` 表），优先级高于启动时的 `TTS_*` 环境变量；API Key 仅写不回显。生成音频保存在外部数据卷的 `word-audio/generated/`。
- **钱包管理**：在后台「钱包」页设置奖励/扣除分数条件、奖惩金额区间与提现门槛（单位元），以及高考词汇整组结算的平均分阈值；处理待发放的提现（标记「已发放」），手动 ±调整余额（需填原因），查看分页流水。
- 编辑即时生效（写入 SQLite 后内存缓存重建），无需重新构建或部署。**ID 稳定**：题目/单词的关联键不变，删除只软警告、不级联删历史记录。

### 其他
- 顶栏显示**版本号**（来自最近的 git tag，构建时注入）。
- Docker 镜像内打包语料，运行时只依赖外部 SQLite 数据卷和环境变量。

---

## 技术架构

**两段构建，单进程运行。** Vite 把 React SPA 构建到 `dist/public`，`tsc` 把 Express 服务端构建到 `dist/server`。运行时单个 Express 进程同时：在 `/api/*` 提供 API、托管 `dist/public` 静态资源、其余路由回退到 `index.html`（客户端路由）。

**语料：构建期种子 → SQLite → 内存缓存。**
- `scripts/build-question-bank.mjs` 解析 `result/s{1..4}_days/*.md`（编号的 `N. 中文 (提示词)` 行 + 下一行 `  - English answer`）生成 `web/generated/question-bank.json`。
- `web/scripts/build-word-bank.mjs` 读取 `middle-school-wordlist/data/*.json` + `sound/` 音频目录生成 `web/generated/word-bank.json`。
- 这两个 JSON 是 gitignore 的**构建产物**，会随 Docker 镜像打包。
- 服务端**首次启动**把它们**播种**进 SQLite 的 `questions` / `words` 表（仅当表为空，幂等）；之后从 SQLite 读、建内存缓存，后台编辑写回 SQLite 并重建缓存。即：JSON 只是初始种子，真正的可编辑数据源是 `/app/data` 卷里的 SQLite，跨镜像重建依然保留。

**批改（`grader.ts`）** 以严格 JSON 模式调用 DeepSeek，中文系统提示。失败（超时/非 200/非 JSON）不抛错给前端，而是返回 `score: 0` 的兜底结果并标记待批改；只有缺少 DeepSeek 配置才抛 `AiConfigError`（映射为 503）。

**鉴权** 家庭口令登录（`POST /api/login`）签发 HMAC 签名的 httpOnly Cookie；`requireAuth` 守卫所有 `/api/*`（除 health 与登录路由）。管理员口令走 `POST /api/admin/login`，在会话上标记 `role='admin'`，`requireAdmin` 守卫 `/api/admin/*`。

**钱包（`wallet_transactions`）** 一张带符号金额的流水表（`reward`/`penalty`/`withdraw`/`adjust`），余额由 `SUM(amount_cents)` **推导**、从不落库。两个提交路由批改后各调一次结算并把奖惩附在响应里；达到奖励分数的每个 ref 只奖一次，低于扣除分数仅首次有效提交扣一次，AI 失败的提交不结算。余额可为负（设计如此）。规则有 `tests/wallet-rules.test.mjs` 覆盖。

更详细的架构与约定说明保存在仓库内的开发文档中（含部署坐标，未公开）。

---

## 目录结构

| 路径 | 说明 |
| --- | --- |
| `web/` | **可部署的全栈应用**（React + Express + SQLite）。|
| `result/` | 校对后的 Markdown 题库（`s1_days/`…`s4_days/`）。|
| `middle-school-wordlist/` | 单词语料（`data/` JSON + `sound/` 发音 mp3）。|
| `imgs/`、`pdf/`、`tools/`、`scripts/`、`research/` | 数据准备流水线（非运行时）。|
| `Dockerfile`、`docker-compose.yml` | 容器化部署配置。|

---

## 本地开发

```bash
cd web
npm install
npm run build:data          # 生成 generated/*.json 种子（dev/test 会自动先跑）
APP_PASSWORD=change-me \
ADMIN_PASSWORD=admin-change-me \
SESSION_SECRET=dev-secret-change-me \
DEEPSEEK_BASE_URL=https://api.deepseek.com \
DEEPSEEK_API_KEY=your-key \
DEEPSEEK_MODEL=deepseek-chat \
DATABASE_PATH=../data/c2e.sqlite \
npm run dev
```

访问 <http://localhost:3000>。

> 注意：`npm run dev` **不是** Vite 热更新开发服务器，而是用 `tsx watch` 跑服务端、并由 Express 托管**已构建的** `dist/public`。改了客户端代码需要重新 `npm run build:client`（或 `npm run build`）才能在浏览器看到。

### 常用命令（均在 `web/` 下）

```bash
npm run dev          # 构建种子 + tsx watch 服务端
npm test             # 构建种子/校验/编译服务端 + node --test 跑测试
npm run typecheck    # 客户端 + 服务端 类型检查
npm run build        # 构建种子 + 校验 + vite 构建 + tsc 服务端 → dist/
```

---

## Docker 本地运行

准备 `.env`（见下方环境变量）后：

```bash
docker compose up -d --build
```

访问 <http://localhost:3000>，SQLite 默认落在宿主机 `./data/c2e.sqlite`。

---

## 云端部署

若部署在某个**子路径**下（由 Nginx 反代），客户端**必须**用对应子路径构建，否则资源/接口 404。以 `/subpath/` 为例：

```bash
cd web
VITE_BASE_PATH=/subpath/ npm run build
cd ..
docker build --build-arg VITE_BASE_PATH=/subpath/ -t c2e-practice:latest .
```

部署到根路径时用 `VITE_BASE_PATH=/`。**正常发布切勿同步或覆盖运行环境里的 `data/` 与 `.env`。**

---

## 环境变量

**必需：**

| 变量 | 说明 |
| --- | --- |
| `APP_PASSWORD` | 家庭登录口令（孩子练习用）。|
| `SESSION_SECRET` | Cookie 签名密钥。|
| `DEEPSEEK_BASE_URL` | AI 批改的 OpenAI 兼容 API 地址（默认值，可被后台「模型」配置覆盖）。|
| `DEEPSEEK_API_KEY` | AI 批改 Key（默认值，可被后台「模型」配置覆盖）。|
| `DEEPSEEK_MODEL` | 模型名（默认值，可被后台「模型」配置覆盖）。|

**可选：**

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | 未设 | 启用后台管理；不设则 `/api/admin/login` 返回 503。|
| `PORT` | `3000` | 容器内端口。|
| `TZ` | `Asia/Shanghai` | 服务器时区；影响活动日历的「今天」判断与时间显示。|
| `DATABASE_PATH` | `/app/data/c2e.sqlite` | SQLite 文件路径。|
| `AI_TIMEOUT_MS` | `30000` | AI 批改超时（默认值，可被后台「模型」配置覆盖）。|
| `REVIEW_SCORE_THRESHOLD` | `80` | 进入复习的分数线。|
| `TTS_PROVIDER` | `volcengine` | TTS 启动默认 provider：`volcengine` 或 `openai-compatible`。|
| `TTS_BASE_URL` | provider 默认值 | TTS API 地址（默认值，可被后台「模型」配置覆盖）。|
| `TTS_API_KEY` | 未设 | OpenAI-compatible TTS Key。|
| `TTS_MODEL` | `gpt-4o-mini-tts` | OpenAI-compatible TTS 模型名。|
| `TTS_VOICE` | `alloy` | OpenAI-compatible TTS voice。|
| `TTS_FORMAT` | `mp3` | OpenAI-compatible 音频格式。|
| `TTS_APP_ID` | 未设 | 火山旧版 App ID；新版 API Key 模式可留空。|
| `TTS_ACCESS_TOKEN` | 未设 | 火山引擎新版 API Key，保存到兼容字段。|
| `TTS_CLUSTER` | 未设 | 火山引擎 `X-Api-Resource-Id`，如 `seed-tts-2.0`。|
| `TTS_VOICE_TYPE` | 未设 | 火山引擎 Speaker / 音色 ID。|
| `TTS_ENCODING` | `mp3` | 火山引擎 Encoding。|
| `TTS_TIMEOUT_MS` | `30000` | TTS 请求超时。|
| `WORD_AUDIO_GENERATED_DIR` | 数据库旁的 `word-audio/generated` | 生成发音文件目录，Docker 默认落在 `/app/data/word-audio/generated`。|

`DEEPSEEK_*` / `AI_TIMEOUT_MS` 是 AI 批改的**启动默认值**；管理员在后台「模型」页保存配置后，运行时改用 SQLite 里的配置（优先级更高），无需改环境变量重启。未保存任何后台配置且环境变量也未设时，AI 批改相关接口返回 503。

`TTS_*` / `WORD_AUDIO_GENERATED_DIR` 是 TTS 发音的**启动默认值**；管理员在后台「模型」页保存 TTS 配置后，运行时改用 SQLite 里的配置。新增/改名单词会尝试自动生成发音；练习播放缺失发音时也会懒生成。生成文件位于外部数据卷，重启容器不会丢。

未配置 AI/鉴权变量时服务仍能启动，但 `/api/health` 会报告未配置，相关接口返回 503。

---

## 版本号

顶栏显示的版本号在构建时由 `web/vite.config.ts` 注入，解析优先级：环境变量 `APP_VERSION` → 最近的 git tag（`git describe`）→ `package.json` version。发布新版本时同时更新二者最稳妥：

```bash
# 1) 更新 web/package.json 的 "version"（无 git 信息的环境以此为准）
# 2) 打 tag 保持一致
git tag -a v1.1.1 -m "..."
git push origin main --tags
# 重新构建即可，前端自动显示新版本号
```

---

## 数据与安全

- `data/`、`.env`、`web/node_modules/`、`web/dist/`、`web/generated/` 不提交到 Git。
- 语料随 Docker 镜像打包；用户进度保存在外部 SQLite volume。
- 切勿把 `.env`、DeepSeek Key、TTS Key/Access Token、家庭/管理员口令提交到仓库。

## License

MIT License
