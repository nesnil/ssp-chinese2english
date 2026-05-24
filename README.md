# ssp-chinese2english

本仓库整理 SSP（Shanghai Students' Post）《中译英 每日一练》资料，并提供一个可 Docker 部署的家庭练习网页。

## 内容概览

- 题库资料：4 季 224 天，1115 题。
- 原始资料：按季度保存图片和 PDF。
- 结构化结果：按季度、按天拆分的 Markdown。
- 练习应用：React + TypeScript 前端，Node/Express 后端，SQLite 持久化，DeepSeek AI 批改。

## 练习应用功能

- 家庭口令登录。
- Season / Day 闯关地图。
- 每题中译英输入、AI 批改、参考答案展示。
- Day 完整练习次数、最新完整练习均分、总完成均分。
- 低于阈值自动进入复习，默认阈值为 80 分。
- 复习中心：
  - 当前需复习题数。
  - 累计复习过的题目数。
  - 已掌握题数与复习提交次数。
  - 按题目查看复习分数轨迹。
  - 按记录查看最近 100 条复习提交。
- Docker 镜像内打包题库，运行时只依赖外部 SQLite 数据卷和环境变量。

## 目录结构

- `imgs/`：按季度整理的原始练习图片。
- `pdf/`：按天生成的 PDF。
- `result/`：校对后的 Markdown 题库。
  - `C2E-S1.md` 到 `C2E-S4.md`
  - `s1_days/` 到 `s4_days/`
- `tools/`：资料转换、校验与合并脚本。
- `web/`：中译英每日闯关 Web 应用。
- `Dockerfile`、`docker-compose.yml`：应用容器化部署配置。
- `DEPLOY.md`：手动发布到云主机的流程。
- `AGENTS.md`：给后续 Codex 线程使用的项目与发布说明。

## 本地开发

```bash
cd web
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

## Docker 本地运行

准备 `.env` 或导出环境变量后运行：

```bash
docker compose up -d --build
```

默认访问：

```text
http://localhost:3000
```

SQLite 数据默认保存在宿主机：

```text
./data/c2e.sqlite
```

## 云端部署

生产站点部署在：

```text
https://example.com/app/
```

云端部署需要使用 `/c2e/` 子路径构建：

```bash
cd web
VITE_BASE_PATH=/c2e/ npm run build
cd ..
docker build --build-arg VITE_BASE_PATH=/c2e/ -t c2e-practice:latest .
```

完整手动发布流程见 `DEPLOY.md`。

## 环境变量

必需：

- `APP_PASSWORD`：家庭登录口令。
- `SESSION_SECRET`：Cookie 签名密钥。
- `DEEPSEEK_BASE_URL`：DeepSeek OpenAI-compatible API 地址。
- `DEEPSEEK_API_KEY`：DeepSeek Key。
- `DEEPSEEK_MODEL`：模型名。

可选：

- `PORT`：容器内端口，默认 `3000`。
- `DATABASE_PATH`：SQLite 文件路径，默认 `/app/data/c2e.sqlite`。
- `AI_TIMEOUT_MS`：AI 批改超时，默认 `30000`。
- `REVIEW_SCORE_THRESHOLD`：进入复习的分数线，默认 `80`。

## 验证

```bash
cd web
npm test
npm run typecheck
VITE_BASE_PATH=/c2e/ npm run build
```

## 数据与安全

- `data/`、`web/node_modules/`、`web/dist/`、`web/generated/` 不提交到 Git。
- 题库随 Docker 镜像打包。
- 用户进度保存在外部 SQLite volume。
- 不要把 `.env`、DeepSeek Key、家庭口令提交到仓库。

## License

MIT License
