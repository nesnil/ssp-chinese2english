# 中译英每日闯关 Web App

家庭中译英练习网页。题库在构建时由仓库 Markdown 生成 JSON，运行时使用 SQLite 保存进度，并通过 DeepSeek 批改答案。

## 功能

- 家庭口令登录。
- Season / Day 闯关地图。
- 单题练习、AI 批改、参考答案展示。
- Day 完整练习次数与最新完整练习平均分。
- 总进度、完成 Day 数、已练题目数、完成均分。
- 低分题自动进入复习，默认阈值 `80`。
- 管理后台支持题库、单词、模型/TTS、钱包设置，以及模型调用历史查询。
- 模型历史记录批改、TTS 和 Siri 语音钱包解析的成功/失败、耗时、请求/响应摘要，便于排查问题且不保存 API Key。
- 复习中心：
  - 当前需复习数。
  - 累计复习过的题目数。
  - 已掌握题数和复习提交次数。
  - 按题目查看每次复习分数轨迹。
  - 按记录查看最近 100 条复习提交。

## 本地开发

```bash
npm install
npm run build:data
APP_PASSWORD=change-me \
SESSION_SECRET=dev-secret-change-me \
DEEPSEEK_BASE_URL=https://api.deepseek.com \
DEEPSEEK_API_KEY=your-key \
DEEPSEEK_MODEL=deepseek-chat \
DATABASE_PATH=../data/c2e.sqlite \
npm run dev
```

访问：

```text
http://localhost:3000
```

## 构建

本地根路径构建：

```bash
VITE_BASE_PATH=/ npm run build
```

部署到子路径（例如 `/subpath/`）时使用：

```bash
VITE_BASE_PATH=/subpath/ npm run build
```

## 测试

```bash
npm test
npm run typecheck
```

## 环境变量

必需：

- `APP_PASSWORD`
- `SESSION_SECRET`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL`

可选：

- `PORT`，默认 `3000`
- `SIRI_API_TOKEN`，未设则 Siri 语音钱包端点（`/api/siri/wallet*`）返回 503（见 `docs/siri-shortcut.md`）
- `DATABASE_PATH`，默认 `/app/data/c2e.sqlite`
- `AI_TIMEOUT_MS`，默认 `30000`
- `REVIEW_SCORE_THRESHOLD`，默认 `80`
- `TTS_PROVIDER`，默认 `volcengine`
- `TTS_BASE_URL`
- `TTS_API_KEY` / `TTS_MODEL` / `TTS_VOICE` / `TTS_FORMAT`（OpenAI-compatible TTS 默认值）
- `TTS_APP_ID` / `TTS_ACCESS_TOKEN` / `TTS_CLUSTER` / `TTS_VOICE_TYPE` / `TTS_ENCODING`（火山引擎 TTS 默认值；新版 API Key 模式中 `TTS_ACCESS_TOKEN` 填 API Key，`TTS_CLUSTER` 填 Resource ID，`TTS_VOICE_TYPE` 填 Speaker）
- `TTS_TIMEOUT_MS`，默认 `30000`
- `WORD_AUDIO_GENERATED_DIR`，默认 SQLite 数据库旁的 `word-audio/generated`

## 持久化

SQLite 文件应放在外部数据卷中。Docker 默认挂载：

```text
./data:/app/data
```

SQLite 使用 WAL 模式，迁移数据时需要注意 `c2e.sqlite`、`c2e.sqlite-wal`、`c2e.sqlite-shm` 三个文件。

模型配置、TTS 配置、钱包规则、模型调用历史、题库/单词后台编辑和学习进度都保存在 SQLite 中；重建镜像不会覆盖这些运行时数据。
