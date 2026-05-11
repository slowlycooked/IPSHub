# IPSHub – 群晖 NAS Docker 部署指南

## 架构概览

```
宿主机 NAS
  ├─ :8088  → ipshub-frontend (nginx:1.27-alpine)
  │               ├─ / → React SPA 静态文件
  │               ├─ /api/  → 反向代理 → ipshub-backend:8080
  │               ├─ /sub/  → 反向代理 → ipshub-backend:8080
  │               └─ /health → 反向代理 → ipshub-backend:8080
  └─ (内部) → ipshub-backend (node:20-alpine)
                  └─ 数据持久化 → ./data/ipshub.db
```

---

## 一、NAS 目录建议

```
/volume1/docker/ipshub/
├── data/            # ← SQLite 数据库（自动创建）
├── config/          # ← 可选配置覆盖（自动创建）
├── docker-compose.yml
├── Dockerfile
├── nginx.conf
└── .env             # ← 从 .env.example 复制并修改
```

> 建议使用独立目录，避免与其他容器文件混用，也方便整体备份。

---

## 二、上传代码到 NAS

### 方式 A：Git（推荐）

通过 SSH 登录 NAS：

```bash
ssh admin@192.168.1.100
mkdir -p /volume1/docker/ipshub
cd /volume1/docker/ipshub
git clone https://github.com/yourname/ipshub.git .
```

### 方式 B：Synology File Station / SFTP

1. 在本地打包项目（排除 `node_modules`、`dist`、`data`）：
   ```bash
   # 在开发机上执行
   cd /path/to/IPSHub
   tar --exclude='node_modules' --exclude='dist' --exclude='data' \
       --exclude='.git' -czf ipshub.tar.gz .
   ```
2. 通过 File Station 上传 `ipshub.tar.gz` 到 `/volume1/docker/ipshub/`
3. SSH 登录 NAS 解压：
   ```bash
   cd /volume1/docker/ipshub && tar -xzf ipshub.tar.gz
   ```

### 方式 C：rsync（增量同步，适合后续更新）

```bash
rsync -avz --exclude='node_modules' --exclude='dist' --exclude='data' \
  --exclude='.git' \
  /local/path/to/IPSHub/ \
  admin@192.168.1.100:/volume1/docker/ipshub/
```

---

## 三、首次启动

### 1. 确认 Docker Compose 版本

```bash
docker compose version   # 群晖 DSM 7.2+ 支持 docker compose (V2)
# 如果提示命令不存在，使用旧版:
docker-compose version
```

### 2. 创建并填写 `.env`

```bash
cd /volume1/docker/ipshub
cp .env.example .env
vi .env    # 或用 nano
```

**必须修改的字段：**

| 变量 | 说明 | 示例 |
|------|------|------|
| `APP_BASE_URL` | NAS 对外暴露的地址，订阅链接会使用此 URL | `http://192.168.1.100:8088` |
| `APP_SECRET` | Session 签名密钥，随机 32 字节 hex | 见下方生成命令 |
| `ADMIN_PASSWORD` | 管理员密码，首次启动后写入数据库 | `MyStr0ngPass!` |

生成 `APP_SECRET`：

```bash
# 在 NAS 上执行（需要 Docker 已安装 node）
docker run --rm node:20-alpine \
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. 一键构建并启动

```bash
cd /volume1/docker/ipshub
docker compose up -d --build
```

> 首次构建需下载基础镜像并编译，耗时约 5–10 分钟（取决于网络和 NAS 性能）。

### 4. 确认服务运行

```bash
docker compose ps
# 预期输出:
# NAME                STATUS          PORTS
# ipshub-backend      running (healthy)
# ipshub-frontend     running (healthy)   0.0.0.0:8088->80/tcp
```

浏览器访问：`http://NAS_IP:8088`

---

## 四、日志查看

```bash
# 实时跟踪两个服务的日志
docker compose logs -f

# 仅查看后端日志（API、错误、Provider 刷新）
docker compose logs -f backend

# 仅查看前端日志（nginx 访问日志）
docker compose logs -f frontend

# 查看最近 100 行
docker compose logs --tail=100 backend
```

---

## 五、停止 / 重启 / 更新

```bash
# 停止（保留容器和数据）
docker compose stop

# 完全删除容器（数据在 ./data/ 中，不受影响）
docker compose down

# 重启服务
docker compose restart

# 更新代码后重新构建并热替换
git pull                        # 或 rsync 更新文件
docker compose up -d --build    # 重新构建镜像并重启
```

---

## 六、确认订阅链接使用正确的地址

订阅链接由后端根据 `APP_BASE_URL` 环境变量生成。

**检查当前配置：**

```bash
# 查看后端实际读取到的 APP_BASE_URL
docker compose exec backend sh -c 'echo $APP_BASE_URL'
```

**前端获取配置的接口：**

```
GET http://NAS_IP:8088/api/config
# 返回: {"baseUrl":"http://192.168.1.100:8088"}
```

**场景示例：**

| 访问方式 | `APP_BASE_URL` 值 | `COOKIE_SECURE` |
|----------|-------------------|-----------------|
| NAS 内网 IP，无 TLS | `http://192.168.1.100:8088` | `false` |
| NAS 群晖反向代理，自定义域名 + HTTPS | `https://sub.example.com` | `true` |
| NAS 端口转发，公网 IP | `http://1.2.3.4:8088` | `false` |

修改后需重启后端：

```bash
# 修改 .env 中的 APP_BASE_URL，然后：
docker compose up -d backend   # 仅重建后端，前端不需要重建
```

---

## 七、常见问题排查

### ① 端口不通（浏览器无法访问 `http://NAS_IP:8088`）

```bash
# 1. 确认容器端口绑定
docker compose ps
docker port ipshub-frontend

# 2. 确认 NAS 防火墙开放了 8088 端口
# 群晖路径：控制面板 → 安全性 → 防火墙 → 新增规则

# 3. 确认端口未被占用
ss -tlnp | grep 8088
```

### ② 容器启动失败（`backend` 一直 restarting）

```bash
# 查看启动错误
docker compose logs backend --tail=50

# 常见原因 1：APP_SECRET 未设置或仍是默认值
# 解决：修改 .env 中的 APP_SECRET，然后 docker compose up -d backend

# 常见原因 2：data/ 目录权限问题
ls -la /volume1/docker/ipshub/data/
# 如果权限不对：
chmod 755 /volume1/docker/ipshub/data/

# 常见原因 3：端口 8080 被占用（内部端口，不应发生）
# 查看是否有其他容器使用了同一内部端口
docker network inspect ipshub_default
```

### ③ 环境变量未生效

```bash
# 确认 .env 文件存在且格式正确（等号两侧无空格，值无引号包裹）
cat .env

# 确认容器内部读取到的值
docker compose exec backend env | grep APP_

# 修改 .env 后必须重新创建容器才能生效
docker compose up -d --force-recreate backend
```

### ④ 数据未持久化（重启后数据消失）

```bash
# 确认 volume 挂载正确
docker compose exec backend ls -la /app/data/
# 预期看到: ipshub.db

# 检查宿主机目录是否存在数据
ls -la /volume1/docker/ipshub/data/

# 如果 data/ 目录不存在，手动创建后重启
mkdir -p /volume1/docker/ipshub/data
docker compose up -d backend
```

### ⑤ 登录后立即跳回登录页（Cookie 问题）

```bash
# 检查 COOKIE_SECURE 配置
# 如果用 http:// 访问（无 TLS），COOKIE_SECURE 必须为 false
grep COOKIE_SECURE .env
# 应该是: COOKIE_SECURE=false

# 修改后重启后端
docker compose up -d --force-recreate backend
```

### ⑥ 前端显示空白 / API 请求 502

```bash
# 502 表示 nginx 无法连接到后端，检查后端健康状态
docker compose ps

# 后端健康检查日志
docker compose logs backend --tail=30

# 测试后端直接响应（临时暴露后端端口调试）
# 修改 docker-compose.yml，在 backend 下加 ports: ["8089:8080"]
# 然后访问 http://NAS_IP:8089/health
```

### ⑦ 构建失败（pnpm 相关错误）

```bash
# 清理 Docker 构建缓存后重试
docker builder prune -f
docker compose build --no-cache
```

---

## 八、备份与恢复

### 备份

```bash
# 只需备份 data/ 目录（SQLite 数据库）和 .env 文件
tar -czf ipshub-backup-$(date +%Y%m%d).tar.gz \
    /volume1/docker/ipshub/data \
    /volume1/docker/ipshub/.env
```

### 恢复

```bash
# 停止服务，还原数据，重启
docker compose down
tar -xzf ipshub-backup-YYYYMMDD.tar.gz -C /
docker compose up -d
```

---

## 九、通过群晖反向代理启用 HTTPS（可选）

1. 群晖 DSM → **控制面板 → 登录门户 → 高级 → 反向代理服务器**
2. 新增规则：
   - 来源：`HTTPS 443`，主机名：`sub.example.com`
   - 目标：`HTTP 127.0.0.1:8088`
3. 申请并绑定 Let's Encrypt 证书（DSM 内置向导）
4. 修改 `.env`：
   ```bash
   APP_BASE_URL=https://sub.example.com
   COOKIE_SECURE=true
   ```
5. 重建后端容器：`docker compose up -d --force-recreate backend`
