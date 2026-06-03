# ssp-chinese2english（C2E 每日闯关）

一个**自建的家庭英语练习 Web 应用**，围绕 SSP（Shanghai Students' Post）《中译英 每日一练》语料构建。孩子把中文句子翻译成英文，由 DeepSeek（OpenAI 兼容的对话 API）实时批改打分，进度记录在 SQLite。除中译英外，还有一套基于上海中考考纲词表（含发音）的**单词默写**练习，以及一个供家长使用的**后台管理系统**。

应用 UI 与所有面向用户的文案均为中文。

> 本仓库同时也包含当初把扫描图片/PDF 整理成结构化题库的**数据准备流水线**（`imgs/`、`pdf/`、`tools/`、`scripts/` 等）。这部分不是运行时应用的一部分，平时很少改动 —— 可运行、可部署的产物是 `web/` 下的全栈应用。

---

## 功能一览

### 中译英（每日闯关）
- **家庭口令登录**，Season / Day 闯关地图（4 季 · 224 天 · 1115 题）。
- 每题输入英文 → **DeepSeek AI 批改**：分数、鼓励语、最关键问题、修改建议、参考答案；满分有随机彩蛋表扬。
- Day 完整练习次数、最新完整练习均分、总完成均分。
- 分数低于阈值（默认 80）自动进入**复习中心**：当前需复习题数、累计复习题数、已掌握题数、按题查看分数轨迹、最近 100 条复习记录。

### 单词默写（词汇练习）
- 基于上海中考考纲词表（约 1650 词），**A–Z 分组、5 词一关**的闯关表。
- **听发音**（内置 mp3）→ 默写英文单词 + 各词性中文意思 → AI 批改 → 通过后默写**例句**。
- 单词级别的掌握/待复习状态，与中译英进度相互独立。

### 后台管理（家长专用）
- **独立管理员口令**（`ADMIN_PASSWORD`），与孩子的家庭口令分离；孩子进不了后台。
- 入口：登录页的「管理员登录」链接，或 `#admin` URL hash，或管理员登录后顶栏的齿轮。
- **题库管理**：列出全部中译英题目，按 Season / Day 筛选、关键词搜索、分页；增删改查（参考答案可改）。
- **单词管理**：列出全部单词，按**分类**（中考考纲/高中/四六级候选等）筛选、**A–Z 首字母**筛选、搜索、分页；增删改查，编辑词性（下拉）、释义、例句、分类（多选），列表内可试听发音。
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

更详细的架构说明见 [`CLAUDE.md`](CLAUDE.md)。

---

## 目录结构

| 路径 | 说明 |
| --- | --- |
| `web/` | **可部署的全栈应用**（React + Express + SQLite）。|
| `result/` | 校对后的 Markdown 题库（`s1_days/`…`s4_days/`）。|
| `middle-school-wordlist/` | 单词语料（`data/` JSON + `sound/` 发音 mp3）。|
| `imgs/`、`pdf/`、`tools/`、`scripts/`、`research/` | 数据准备流水线（非运行时）。|
| `Dockerfile`、`docker-compose.yml` | 容器化部署配置。|
| `CLAUDE.md` | 面向 AI 助手的架构与约定说明。|
| `AGENTS.md`、`DEPLOY.md` | 项目说明与手动发布流程。|

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

若部署在某个**子路径**下（由 Nginx 反代），客户端**必须**用对应子路径构建，否则资源/接口 404。以 `/c2e/` 为例：

```bash
cd web
VITE_BASE_PATH=/c2e/ npm run build
cd ..
docker build --build-arg VITE_BASE_PATH=/c2e/ -t c2e-practice:latest .
```

完整发布流程（rsync 同步、构建重启、Nginx 配置、数据迁移、健康检查）见 [`DEPLOY.md`](DEPLOY.md) 与 [`AGENTS.md`](AGENTS.md)。**正常发布切勿同步或覆盖远端的 `data/` 与 `.env`。**

---

## 环境变量

**必需：**

| 变量 | 说明 |
| --- | --- |
| `APP_PASSWORD` | 家庭登录口令（孩子练习用）。|
| `SESSION_SECRET` | Cookie 签名密钥。|
| `DEEPSEEK_BASE_URL` | DeepSeek OpenAI 兼容 API 地址。|
| `DEEPSEEK_API_KEY` | DeepSeek Key。|
| `DEEPSEEK_MODEL` | 模型名。|

**可选：**

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | 未设 | 启用后台管理；不设则 `/api/admin/login` 返回 503。|
| `PORT` | `3000` | 容器内端口。|
| `DATABASE_PATH` | `/app/data/c2e.sqlite` | SQLite 文件路径。|
| `AI_TIMEOUT_MS` | `30000` | AI 批改超时。|
| `REVIEW_SCORE_THRESHOLD` | `80` | 进入复习的分数线。|

未配置 AI/鉴权变量时服务仍能启动，但 `/api/health` 会报告未配置，相关接口返回 503。

---

## 版本号

顶栏显示的版本号来自**最近的 git tag**（构建时由 `web/vite.config.ts` 执行 `git describe` 注入；无 tag 时回退到 `package.json` version）。发布新版本：

```bash
git tag -a v1.0.2 -m "..."
git push origin main --tags
# 重新构建即可，前端自动显示新版本号
```

---

## 数据与安全

- `data/`、`.env`、`web/node_modules/`、`web/dist/`、`web/generated/` 不提交到 Git。
- 语料随 Docker 镜像打包；用户进度保存在外部 SQLite volume。
- 切勿把 `.env`、DeepSeek Key、家庭/管理员口令提交到仓库。

## License

MIT License
