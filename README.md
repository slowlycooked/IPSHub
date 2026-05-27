# IPSHub

一个 IPS / 代理订阅服务聚合器，支持在群晖 NAS 上通过 Docker 部署。

## 功能特性

- 🔄 集中管理多个代理/IPS 订阅服务商
- 📦 自动拉取、解析、标准化、合并和去重节点
- 🎯 支持多个 Profile，按不同规则输出订阅
- 🔀 支持 Clash/Mihomo、Loon、Raw 及 Provider 四种格式
- 🔐 加密存储服务商订阅 URL，安全可靠
- 🐳 多阶段 Docker Compose 一键部署（backend + nginx）
- 📊 完整的后台管理界面（React SPA）
- 📝 详细的刷新日志与访问日志
- 🔬 内置 **sing-box** 集成，提供 Layer 5 延迟诊断探测
- 🧩 诊断引擎：节点配置 diff、有效性验证、连通性检测

## 快速开始

### 本地开发

#### 前置要求
- Node.js 22 LTS（`node --version` 应 ≥ 22.0.0）
- pnpm 9.x（`npm install -g pnpm@9`）
- Python 3（用于编译 better-sqlite3 native addon）

#### 安装依赖
```bash
pnpm install
```

#### 启动开发服务器
```bash
# 同时启动前端和后端（带热重载）
pnpm dev

# 或单独启动前端
cd apps/web && pnpm dev

# 或单独启动后端
cd apps/server && pnpm dev
```

前端：http://localhost:5173  
后端：http://localhost:8080

---

### Docker 部署

> 完整的分步 Docker 打包指南见文末 **[Docker Build Step Guide](#docker-build-step-guide)** 章节。

#### 群晖 NAS 部署

1. 准备环境变量文件：
```bash
cp .env.example .env
# 编辑 .env，至少填写 APP_SECRET、ADMIN_PASSWORD、APP_BASE_URL
```

2. 构建并启动：
```bash
docker compose up -d --build
```

3. 通过 Synology Container Manager
   - 打开 Container Manager → Project → Create → Upload `docker-compose.yml`
   - 配置端口（默认 8088）、卷挂载 `./data` 和 `./config`
   - Launch Project

4. 访问
```
http://<nas-ip>:8088
```

#### 普通 Docker 环境

```bash
docker compose up -d --build
```

访问 http://localhost:8088

## 配置说明

### .env 示例

创建 `.env` 文件（**不要提交到 Git**）：
```dotenv
# 应用公开地址（用于生成订阅链接）
APP_BASE_URL=http://192.168.1.100:8088

# 必填：32+ 字符随机字符串，用于 session 签名和加密
APP_SECRET=change-me-to-a-very-long-random-string-32chars

# 管理员账号（首次初始化后修改数据库生效）
ADMIN_USERNAME=admin
ADMIN_PASSWORD=yourSecurePassword

# 前端端口（宿主机）
WEB_PORT=8088

# Cookie 安全（HTTPS 反代后设为 true）
COOKIE_SECURE=false

# 日志级别：trace / debug / info / warn / error
LOG_LEVEL=info
```

### 环境变量说明

| 变量 | 说明 | 必需 | 默认值 |
|------|------|:----:|--------|
| `APP_BASE_URL` | 应用公开地址（用于生成订阅链接） | ✅ | — |
| `APP_SECRET` | Session 签名密钥（≥32 字符） | ✅ | — |
| `ADMIN_USERNAME` | 初始管理员用户名 | 否 | `admin` |
| `ADMIN_PASSWORD` | 初始管理员密码 | ✅ | — |
| `SERVER_PORT` | 后端监听端口（容器内部） | 否 | `8080` |
| `WEB_PORT` | 前端暴露到宿主机的端口 | 否 | `8088` |
| `LOG_LEVEL` | 日志级别 | 否 | `info` |
| `COOKIE_SECURE` | Cookie Secure 标志 | 否 | `false` |
| `DB_PATH` | SQLite 数据库路径（容器内） | 否 | `/app/data/ipshub.db` |
| `NODE_ENV` | 运行环境 | 否 | `production` |

## 使用指南

### 1. 添加服务商订阅

1. 登录后台管理系统
2. 菜单 → Provider 管理
3. 点击 "新增 Provider"
4. 填写订阅信息：
   - 名称：例如 "我的 A 服务商"
   - 订阅类型：自动识别、Clash YAML、Base64 URI、纯文本 URI
   - 订阅地址：服务商提供的订阅 URL
   - 刷新间隔：例如 360（6 小时）
   - User-Agent 等高级配置（可选）
5. 保存后自动刷新

### 2. 管理节点

1. 菜单 → 节点管理
2. 查看所有已导入的节点
3. 支持按服务商、协议、名称过滤
4. 可以单独启用/禁用节点

### 3. 创建 Profile

1. 菜单 → Profile 管理
2. 点击 "新增 Profile"
3. 配置规则：
   - **包含规则**：包含的服务商、协议等
   - **排除规则**：排除过期节点、流量通知节点等
   - **输出格式**：Clash、Loon、Raw 等
4. 一键生成订阅 URL

### 4. 在 Clash 中使用

1. 从 IPSHub Profile 页面复制 Clash 订阅 URL
2. 在 Clash 配置中添加订阅源
3. 配置示例：
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

### 5. 在 Loon 中使用

1. 从 IPSHub Profile 页面复制 Loon 订阅 URL
2. 在 Loon 配置中添加订阅源
3. URL：http://<ipshub>/sub/loon/main?token=xxxx

## API 文档

### 认证

```
POST /api/auth/login
POST /api/auth/logout
GET /api/auth/me
```

### Provider 管理

```
GET    /api/providers
POST   /api/providers
GET    /api/providers/:id
PUT    /api/providers/:id
DELETE /api/providers/:id
POST   /api/providers/:id/refresh
```

### 节点管理

```
GET  /api/nodes
GET  /api/nodes/:id
PUT  /api/nodes/:id
POST /api/nodes/:id/enable
POST /api/nodes/:id/disable
```

### Profile 管理

```
GET    /api/profiles
POST   /api/profiles
GET    /api/profiles/:id
PUT    /api/profiles/:id
DELETE /api/profiles/:id
POST   /api/profiles/:id/regenerate-token
```

### 日志

```
GET /api/logs/refresh
GET /api/logs/access
```

### 订阅输出

```
GET /sub/clash/:profileName?token=xxxx
GET /sub/loon/:profileName?token=xxxx
GET /sub/raw/:profileName?token=xxxx
GET /sub/provider/:profileName?token=xxxx
```

### 系统

```
GET /health
GET /api/dashboard
```

## 安全说明

- ✅ 服务商订阅 URL 加密存储
- ✅ 管理后台需要登录认证
- ✅ 订阅输出使用 token 认证
- ✅ 完整的 SSRF 防护
- ✅ 日志自动脱敏
- ✅ 支持配置化密钥管理

## 常见问题

### Q: 为什么有些节点没有出现？
A: 检查：
1. 节点是否被禁用
2. Profile 过滤规则是否排除了这个节点
3. 查看日志了解节点解析情况

### Q: 如何重置管理员密码？
A: 需要修改数据库或删除 data/ipshub.db 重新初始化

### Q: 订阅更新不及时？
A: 
1. 检查 Provider 刷新间隔设置
2. 可以在后台手动触发刷新
3. 查看日志排查拉取失败原因

### Q: Clash 无法导入订阅？
A: 
1. 确认 token 正确
2. 确认 Profile 包含至少一个节点
3. 查看浏览器开发者工具中的网络请求

## 开发

### 项目结构

```
ipshub/
├── apps/
│   ├── web/              # React 前端
│   └── server/           # Node.js 后端
├── Dockerfile
├── docker-compose.yml
└── package.json
```

### 技术栈

**前端**

| 库 | 版本 | 用途 |
|----|------|------|
| React | 18 | UI 框架 |
| TypeScript | 5.3 | 类型安全 |
| Vite | 5 | 构建工具 |
| TailwindCSS | 3.4 | 样式 |
| TanStack Query | 5.28 | 数据请求 / 缓存 |
| React Router DOM | 7 | 前端路由 |
| Axios | 1.6 | HTTP 客户端 |

**后端**

| 库 | 版本 | 用途 |
|----|------|------|
| Node.js | 22 LTS | 运行时 |
| Fastify | 4.25 | Web 框架 |
| better-sqlite3 | 12.9 | SQLite ORM |
| Zod | 3.22 | Schema 验证 |
| Pino | 8.17 | 结构化日志 |
| node-cron | 3.0 | 定时任务 |
| yaml | 2.4 | YAML 解析 |
| sing-box | 1.11 | Layer 5 延迟探测 |

**部署**：Docker + Docker Compose + nginx 1.27 + dumb-init

## 许可证

MIT

## 支持

如有问题，请提交 Issue 或 Discussion。

---

## Docker Build Step Guide

本指南覆盖从零开始构建 IPSHub Docker 镜像的完整流程，包括 sing-box 二进制集成。

### 前置要求

| 工具 | 最低版本 | 检查命令 |
|------|----------|---------|
| Docker Engine | 25.0+ | `docker --version` |
| Docker Compose plugin | 2.24+ | `docker compose version` |
| 网络访问 | — | 需要访问 GitHub Releases（sing-box）|

---

### Step 1 — 克隆仓库 & 准备环境变量

```bash
git clone <repo-url> ipshub
cd ipshub

# 从示例文件创建 .env
cp .env.example .env   # 如果没有 .env.example，手动创建（见配置说明章节）
```

编辑 `.env`，**至少填写以下三项**：
```dotenv
APP_BASE_URL=http://<your-host-ip>:8088
APP_SECRET=<随机32+字符字符串>
ADMIN_PASSWORD=<强密码>
```

生成随机 `APP_SECRET` 的方法：
```bash
# macOS / Linux
openssl rand -hex 32

# 或 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### Step 2 — 验证 sing-box 版本（可选）

Dockerfile 默认安装 sing-box `1.11.0`。  
如需指定版本，可通过 build arg 覆盖：

```bash
# 查看可用版本
open https://github.com/SagerNet/sing-box/releases

# 使用指定版本构建（示例）
docker compose build --build-arg SING_BOX_VERSION=1.11.0
```

---

### Step 3 — 构建镜像

```bash
# 拉取基础镜像缓存并构建（推荐首次使用）
docker compose build --pull

# 之后增量构建（利用层缓存）
docker compose build
```

**构建阶段说明：**

| Stage | 基础镜像 | 作用 |
|-------|----------|------|
| `web-deps` | `node:22-alpine` | 安装 Web 依赖（无 native 编译） |
| `server-deps` | `node:22-alpine` | 安装 Server 依赖（编译 better-sqlite3） |
| `web-builder` | `web-deps` | 构建 Vite SPA |
| `server-builder` | `server-deps` | 编译 TypeScript 服务端 |
| `singbox` | `alpine:3.20` | 下载 sing-box 二进制 |
| `backend` | `node:22-alpine` | 生产运行时 + sing-box 二进制 |
| `frontend` | `nginx:1.27-alpine` | 静态文件 + 反向代理 |

> **构建优化**：`--target frontend` 只经过 `web-deps → web-builder` 两个阶段，不触发 `better-sqlite3` 的 C++ 编译，速度显著提升。

> **网络提示**：sing-box 二进制从 GitHub Releases 下载，若网络受限可在构建前配置代理：
> ```bash
> export HTTPS_PROXY=http://your-proxy:port
> docker compose build
> ```

---

### Step 4 — 验证 sing-box 是否成功集成

```bash
# 构建完成后，检查 backend 镜像中的 sing-box 版本
docker run --rm --entrypoint="" \
  $(docker compose config | grep 'image:' | head -1 | awk '{print $2}') \
  sing-box version

# 或直接查看 backend 容器日志（启动后）
docker compose logs backend | grep -i "sing-box"
```

若输出类似 `sing-box version 1.11.0`，说明集成成功。  
若输出 `sing-box not available`，Layer 5 延迟探测功能将被跳过，其余功能不受影响。

---

### Step 5 — 初次启动

```bash
# 后台启动所有服务
docker compose up -d

# 查看启动状态（等待 backend healthy）
docker compose ps

# 查看实时日志
docker compose logs -f
```

等待 `ipshub-backend` 状态变为 `healthy` 后访问：
```
http://localhost:8088        # 或你设置的 APP_BASE_URL
```

使用 `.env` 中设置的 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 登录。

---

### Step 6 — 推送到私有镜像仓库（NAS 部署）

```bash
# 打标签
docker tag ipshub-backend:latest <registry>/ipshub-backend:1.0.0
docker tag ipshub-frontend:latest <registry>/ipshub-frontend:1.0.0

# 推送
docker push <registry>/ipshub-backend:1.0.0
docker push <registry>/ipshub-frontend:1.0.0
```

群晖 NAS 可在 Container Manager → Registry 中配置私有仓库后拉取。

---

### Step 7 — 数据持久化 & 升级

**数据目录结构：**
```
./data/
└── ipshub.db      # SQLite 主数据库（自动创建）
./config/          # 可选配置覆盖文件
```

**升级步骤：**
```bash
# 1. 备份数据库
cp ./data/ipshub.db ./data/ipshub.db.bak

# 2. 拉取新代码
git pull

# 3. 重新构建并重启（数据库不受影响）
docker compose up -d --build
```

---

### 常见构建问题排查

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| `better-sqlite3` 编译失败 | 缺少 `python3/make/g++` | Dockerfile 已包含，检查 Alpine 网络 |
| sing-box 下载超时 | GitHub 访问受限 | 设置 `HTTPS_PROXY` 环境变量后重建 |
| `--frozen-lockfile` 报错 | `pnpm-lock.yaml` 与 `package.json` 不同步 | 本地运行 `pnpm install` 更新锁文件 |
| 前端显示白屏 | nginx 反代配置问题 | 检查 `nginx.conf` 中 backend 地址是否正确 |
| 健康检查一直 `starting` | 后端启动慢（native module 加载） | 等待 15s start_period 过后再检查 |
