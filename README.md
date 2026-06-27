# IPSHub

IPSHub 是一个 IPS / 代理订阅服务聚合器。当前项目主要面向 **macOS 原生运行**：后端直接在本机 Node.js 进程中运行，生产环境由 `scripts/prod.sh` 构建、启动、更新和健康检查；Docker / NAS 部署保留为可选路径。

## 功能特性

- 集中管理多个代理 / IPS 订阅服务商
- 自动拉取、解析、标准化、合并和去重节点
- 支持多个 Profile，按不同规则输出订阅
- 支持 Clash / Mihomo、Loon、Raw 及 Provider 格式
- 加密存储服务商订阅 URL
- React SPA 后台管理界面
- 刷新日志、访问日志与定时刷新
- 内置 sing-box 集成，提供 Layer 5 延迟诊断探测
- 诊断引擎：节点配置 diff、有效性验证、连通性检测

## 快速开始

### macOS 本地开发

前置要求：

- Node.js 22 LTS
- pnpm 9.x
- Python 3 / Xcode Command Line Tools，用于 native addon 构建

```bash
brew install node pnpm git
xcode-select --install
pnpm install
pnpm dev
```

开发地址：

- 前端：http://localhost:5173
- 后端：http://localhost:8080

也可以使用脚本启动和停止两个开发进程：

```bash
pnpm dev:start
pnpm dev:stop
```

### macOS 生产运行

```bash
cp .env.example .env
# 编辑 .env，至少填写 APP_BASE_URL、APP_SECRET、ADMIN_PASSWORD
pnpm prod build
pnpm prod start
```

常用命令：

```bash
pnpm prod status
pnpm prod logs
pnpm prod restart
pnpm prod update
pnpm prod stop
```

生产构建会把前端产物放到 `public/`，后端进程会同时提供 API、订阅输出、健康检查和 SPA 静态资源。数据库默认写入 `./data/ipshub.db`。

完整 macOS 部署说明见 [deploy/macos/README.md](deploy/macos/README.md)。

### 可选 Docker / NAS 部署

Docker 文件已整理到 `deploy/docker/`，不再是默认入口。需要容器化部署时从仓库根目录运行：

```bash
docker compose --env-file .env -f deploy/docker/docker-compose.yml up -d --build
```

说明见 [deploy/docker/README.md](deploy/docker/README.md)。

## 配置

创建 `.env` 文件：

```bash
cp .env.example .env
```

macOS 原生运行的核心配置：

```dotenv
NODE_ENV=production
APP_BASE_URL=http://127.0.0.1:8080
APP_SECRET=change-me-to-a-very-long-random-string
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me-before-first-start
SERVER_PORT=8080
DB_PATH=./data/ipshub.db
COOKIE_SECURE=false
LOG_LEVEL=info
```

生成随机 `APP_SECRET`：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

| 变量 | 说明 | 必需 | 默认值 |
|------|------|:----:|--------|
| `APP_BASE_URL` | 应用公开地址，用于生成订阅链接 | 是 | 无 |
| `APP_SECRET` | Session 签名和加密密钥 | 是 | 无 |
| `ADMIN_USERNAME` | 初始管理员用户名 | 否 | `admin` |
| `ADMIN_PASSWORD` | 初始管理员密码 | 是 | 无 |
| `SERVER_PORT` | macOS 原生后端监听端口 | 否 | `8080` |
| `DB_PATH` | SQLite 数据库路径 | 否 | `./data/ipshub.db` |
| `LOG_LEVEL` | 日志级别 | 否 | `info` |
| `COOKIE_SECURE` | HTTPS Cookie Secure 标志 | 否 | `false` |
| `WEB_PORT` | Docker nginx 暴露端口，仅 Docker 使用 | 否 | `8088` |
| `NODE_ENV` | 运行环境 | 否 | `production` |

## 使用指南

### 添加服务商订阅

1. 登录后台管理系统
2. 进入 Provider 管理
3. 点击新增 Provider
4. 填写订阅类型、订阅地址、刷新间隔和可选请求头
5. 保存后自动刷新

### 管理节点

1. 进入节点管理
2. 按服务商、协议、名称过滤节点
3. 单独启用、禁用或更新节点

### 创建 Profile

1. 进入 Profile 管理
2. 配置包含规则、排除规则和输出格式
3. 复制生成的订阅 URL

### Clash / Mihomo 示例

```yaml
proxy-providers:
  ipshub:
    url: http://<ipshub>/sub/clash/main?token=xxxx
    interval: 3600
    path: ./providers/ipshub.yml
    health-check:
      enable: true
      url: https://www.gstatic.com/generate_204
      interval: 300
```

### Loon

从 Profile 页面复制 Loon 订阅 URL：

```text
http://<ipshub>/sub/loon/main?token=xxxx
```

## API

认证：

```text
POST /api/auth/login
POST /api/auth/logout
GET /api/auth/me
```

Provider：

```text
GET    /api/providers
POST   /api/providers
GET    /api/providers/:id
PUT    /api/providers/:id
DELETE /api/providers/:id
POST   /api/providers/:id/refresh
```

节点：

```text
GET  /api/nodes
GET  /api/nodes/:id
PUT  /api/nodes/:id
POST /api/nodes/:id/enable
POST /api/nodes/:id/disable
```

Profile：

```text
GET    /api/profiles
POST   /api/profiles
GET    /api/profiles/:id
PUT    /api/profiles/:id
DELETE /api/profiles/:id
POST   /api/profiles/:id/regenerate-token
```

日志：

```text
GET /api/logs/refresh
GET /api/logs/access
```

订阅输出：

```text
GET /sub/clash/:profileName?token=xxxx
GET /sub/loon/:profileName?token=xxxx
GET /sub/raw/:profileName?token=xxxx
GET /sub/provider/:profileName?token=xxxx
```

系统：

```text
GET /health
GET /api/dashboard
```

## 项目结构

```text
ipshub/
├── apps/
│   ├── server/           # Fastify 后端
│   └── web/              # React 前端
├── deploy/
│   ├── macos/            # macOS 原生部署说明和 nginx 示例
│   └── docker/           # 可选 Docker / NAS 部署文件
├── scripts/
│   ├── prod.sh           # macOS 生产运行助手
│   ├── dev-start.sh
│   └── dev-stop.sh
├── data/                 # 本地 SQLite 数据，未提交
├── logs/                 # 本地运行日志，未提交
└── package.json
```

## 技术栈

前端：React 18、TypeScript、Vite、TailwindCSS、TanStack Query、React Router、Axios。

后端：Node.js 22 LTS、Fastify、better-sqlite3、Zod、Pino、node-cron、yaml、sing-box。

部署：macOS 原生 Node.js 进程为主；Docker Compose + nginx 为可选兼容方案。

## 常见问题

### 为什么有些节点没有出现？

检查节点是否被禁用、Profile 过滤规则是否排除了节点，并查看刷新日志。

### 如何重置管理员密码？

需要修改数据库中的管理员记录，或在确认可丢弃数据后删除 `data/ipshub.db` 重新初始化。

### 订阅更新不及时？

检查 Provider 刷新间隔，也可以在后台手动触发刷新并查看日志。

### Clash 无法导入订阅？

确认 token 正确、Profile 包含至少一个节点，并检查浏览器或客户端网络请求。

## 许可证

MIT
