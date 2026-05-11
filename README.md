# IPSHub

一个 IPS / 代理订阅服务聚合器，支持在群晖 NAS 上通过 Docker 部署。

## 功能特性

- 🔄 集中管理多个代理/IPS 订阅服务商
- 📦 自动拉取、解析、标准化、合并和去重节点
- 🎯 支持多个 Profile，按不同规则输出订阅
- 🔀 支持 Clash/Mihomo 和 Loon 两种格式
- 🔐 加密存储服务商订阅 URL，安全可靠
- 🐳 一键 Docker Compose 部署
- 📊 完整的后台管理界面
- 📝 详细的日志记录

## 快速开始

### 本地开发

#### 前置要求
- Node.js 20+
- pnpm 8+

#### 安装依赖
```bash
pnpm install
```

#### 启动开发服务器
```bash
# 同时启动前端和后端
pnpm dev

# 或单独启动前端
cd apps/web && pnpm dev

# 或单独启动后端
cd apps/server && pnpm dev
```

前端：http://localhost:5173
后端：http://localhost:8080
API 文档：http://localhost:8080/api/docs

### Docker 部署

#### 群晖 NAS 部署

1. 准备 docker-compose.yml
```bash
cp docker-compose.yml docker-compose.prod.yml
# 编辑 docker-compose.prod.yml，修改环境变量
```

2. 通过 Synology Container Manager
   - 打开 Container Manager
   - Project → Create → Upload docker-compose.yml
   - 配置端口、卷挂载
   - Launch Project

3. 访问
```
http://<nas-ip>:8088
```

#### 普通 Docker 环境

```bash
docker-compose up -d
```

访问 http://localhost:8088

## 配置说明

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NODE_ENV` | 运行环境 | `development` |
| `LOG_LEVEL` | 日志级别 | `debug` |
| `APP_BASE_URL` | 应用地址 | `http://localhost:8088` |
| `APP_SECRET` | 加密密钥 | - |
| `ADMIN_USERNAME` | 初始管理员用户名 | - |
| `ADMIN_PASSWORD` | 初始管理员密码 | - |
| `DB_PATH` | 数据库路径 | `./data/ipshub.db` |
| `SERVER_PORT` | 服务器端口 | `8080` |

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

**前端**：React 18 + TypeScript + Vite + TailwindCSS + TanStack Query

**后端**：Node.js + Fastify + SQLite + Drizzle ORM + TypeScript

**部署**：Docker + Docker Compose

## 许可证

MIT

## 支持

如有问题，请提交 Issue 或 Discussion。
