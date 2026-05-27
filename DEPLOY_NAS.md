# IPSHub 群晖 NAS Docker 部署指南

> 适用场景：本地开发完成后，部署到群晖 NAS / DSM / Container Manager。  
> 推荐方式：**本地构建镜像 → 导出镜像包 → 上传 NAS → NAS 导入镜像 → docker compose 启动**。  
> 不推荐：在 NAS 上直接 `docker compose up -d --build`，因为 NAS 编译 Node 原生依赖较慢，尤其是 `better-sqlite3`、`node-gyp` 这类依赖。

---

## 1. 部署目标

本部署方案目标：

- 本地完成 Docker 镜像构建，减少 NAS CPU/内存压力。
- NAS 只负责运行容器，不负责源码编译。
- 支持前端、后端双镜像部署。
- 支持数据、配置、日志持久化。
- 支持后续版本快速更新与回滚。

推荐最终运行结构：

```text
/volume1/docker/ipshub/
├── docker-compose.prod.yml
├── .env
├── data/
├── config/
├── logs/
├── backups/
└── images/
    └── ipshub-images-latest.tar.gz
```

---

## 2. 前置条件

### 2.1 本地机器要求

本地需要安装：

```bash
docker --version
docker buildx version
```

建议本地使用 Docker Desktop。

### 2.2 NAS 要求

NAS 需要安装：

- DSM 7.x
- Container Manager
- SSH 已启用
- 当前 SSH 用户具备 `sudo docker` 权限

NAS 上验证 Docker：

```bash
sudo docker ps
```

如果出现 Docker socket 权限问题，使用：

```bash
sudo docker ps
```

不要直接用普通用户执行 `docker ps`，除非已经配置好 Docker 用户组权限。

---

## 3. 确认 NAS CPU 架构

在 NAS 上执行：

```bash
uname -m
```

常见结果：

```text
x86_64
```

对应本地构建参数：

```bash
--platform linux/amd64
```

如果返回：

```text
aarch64
```

对应本地构建参数：

```bash
--platform linux/arm64
```

> 你的 NAS 如果之前构建日志里出现 `linux | x64`，一般就是 `linux/amd64`。

---

## 4. 本地构建镜像

在本地项目根目录执行。

### 4.1 构建后端镜像

```bash
docker buildx build \
  --platform linux/amd64 \
  --target backend \
  -t ipshub-backend:latest \
  --load \
  .
```

### 4.2 构建前端镜像

```bash
docker buildx build \
  --platform linux/amd64 \
  --target frontend \
  -t ipshub-frontend:latest \
  --load \
  .
```

### 4.3 验证本地镜像

```bash
docker images | grep ipshub
```

预期看到：

```text
ipshub-backend     latest
ipshub-frontend    latest
```

---

## 5. 导出镜像包

本地执行：

```bash
docker save ipshub-backend:latest ipshub-frontend:latest | gzip > ipshub-images-latest.tar.gz
```

检查文件大小：

```bash
ls -lh ipshub-images-latest.tar.gz
```

建议按版本号保留一份：

```bash
cp ipshub-images-latest.tar.gz ipshub-images-1.0.0.tar.gz
```

---

## 6. 上传镜像包到 NAS

本地执行：

```bash
scp ipshub-images-latest.tar.gz your_user@NAS_IP:/volume1/docker/ipshub/images/
```

示例：

```bash
scp ipshub-images-latest.tar.gz martin@192.168.1.10:/volume1/docker/ipshub/images/
```

如果 NAS 上还没有目录，先 SSH 到 NAS 创建：

```bash
mkdir -p /volume1/docker/ipshub/images
mkdir -p /volume1/docker/ipshub/data
mkdir -p /volume1/docker/ipshub/config
mkdir -p /volume1/docker/ipshub/logs
mkdir -p /volume1/docker/ipshub/backups
```

---

## 7. NAS 导入镜像

SSH 登录 NAS：

```bash
ssh your_user@NAS_IP
```

进入部署目录：

```bash
cd /volume1/docker/ipshub
```

导入镜像：

```bash
gunzip -c images/ipshub-images-latest.tar.gz | sudo docker load
```

检查镜像：

```bash
sudo docker images | grep ipshub
```

预期看到：

```text
ipshub-backend     latest
ipshub-frontend    latest
```

---

## 8. NAS 生产 Compose 文件

在 NAS 上创建：

```bash
cd /volume1/docker/ipshub
nano docker-compose.prod.yml
```

写入以下内容：

```yaml
services:
  ipshub-backend:
    image: ipshub-backend:latest
    container_name: ipshub-backend
    restart: unless-stopped
    ports:
      - "8080:8080"
    env_file:
      - .env
    volumes:
      - ./data:/app/data
      - ./config:/app/config
      - ./logs:/app/logs
    networks:
      - ipshub-net

  ipshub-frontend:
    image: ipshub-frontend:latest
    container_name: ipshub-frontend
    restart: unless-stopped
    ports:
      - "8088:80"
    depends_on:
      - ipshub-backend
    networks:
      - ipshub-net

networks:
  ipshub-net:
    driver: bridge
```

关键点：

- NAS 上的 `docker-compose.prod.yml` **不要写 `build:`**。
- 只使用 `image:` 引用已经导入的镜像。
- 这样启动时不会在 NAS 上重新编译。

---

## 9. 配置 .env

在 NAS 上创建：

```bash
cd /volume1/docker/ipshub
nano .env
```

示例：

```env
NODE_ENV=production
PORT=8080
DATA_DIR=/app/data
CONFIG_DIR=/app/config
LOG_DIR=/app/logs

# 按实际情况修改
JWT_SECRET=please-change-this-secret
SUBSCRIPTION_REFRESH_INTERVAL=3600
```

注意：

- 不要把本地开发环境的敏感配置直接暴露到公网。
- 如果有 token、secret、订阅密钥，统一放 `.env` 或 NAS 的私有配置目录。

---

## 10. 启动服务

在 NAS 上执行：

```bash
cd /volume1/docker/ipshub
sudo docker compose -f docker-compose.prod.yml up -d
```

查看容器状态：

```bash
sudo docker compose -f docker-compose.prod.yml ps
```

查看日志：

```bash
sudo docker compose -f docker-compose.prod.yml logs -f
```

只看后端日志：

```bash
sudo docker logs -f ipshub-backend
```

只看前端日志：

```bash
sudo docker logs -f ipshub-frontend
```

---

## 11. 访问服务

前端访问地址：

```text
http://NAS_IP:8088
```

后端健康检查：

```text
http://NAS_IP:8080/health
```

如果配置了群晖反向代理或域名，最终可以使用：

```text
https://your-domain.com
```

Clash / Loon 订阅地址不要再使用本地开发地址：

```text
http://localhost:5173/sub/clash/xxx?token=xxx
```

需要改成 NAS 地址：

```text
http://NAS_IP:8088/sub/clash/xxx?token=xxx
```

或者域名地址：

```text
https://your-domain.com/sub/clash/xxx?token=xxx
```

---

## 12. 后续更新流程

### 12.1 本地重新构建

```bash
docker buildx build \
  --platform linux/amd64 \
  --target backend \
  -t ipshub-backend:latest \
  --load \
  .


docker buildx build \
  --platform linux/amd64 \
  --target frontend \
  -t ipshub-frontend:latest \
  --load \
  .
```

### 12.2 本地导出镜像包

```bash
docker save ipshub-backend:latest ipshub-frontend:latest | gzip > ipshub-images-latest.tar.gz
```

### 12.3 上传到 NAS

```bash
scp ipshub-images-latest.tar.gz your_user@NAS_IP:/volume1/docker/ipshub/images/
```

### 12.4 NAS 导入新镜像

```bash
cd /volume1/docker/ipshub
gunzip -c images/ipshub-images-latest.tar.gz | sudo docker load
```

### 12.5 重启服务

```bash
sudo docker compose -f docker-compose.prod.yml up -d --force-recreate
```

### 12.6 查看日志

```bash
sudo docker compose -f docker-compose.prod.yml logs -f
```

---

## 13. 版本化发布方式

推荐发布时保留版本号，方便回滚。

### 13.1 本地构建版本镜像

```bash
docker buildx build \
  --platform linux/amd64 \
  --target backend \
  -t ipshub-backend:1.0.1 \
  -t ipshub-backend:latest \
  --load \
  .


docker buildx build \
  --platform linux/amd64 \
  --target frontend \
  -t ipshub-frontend:1.0.1 \
  -t ipshub-frontend:latest \
  --load \
  .
```

### 13.2 导出指定版本

```bash
docker save ipshub-backend:1.0.1 ipshub-frontend:1.0.1 | gzip > ipshub-images-1.0.1.tar.gz
```

### 13.3 NAS 使用指定版本

修改 `docker-compose.prod.yml`：

```yaml
services:
  ipshub-backend:
    image: ipshub-backend:1.0.1

  ipshub-frontend:
    image: ipshub-frontend:1.0.1
```

启动：

```bash
sudo docker compose -f docker-compose.prod.yml up -d
```

---

## 14. 回滚方案

如果新版本异常，先确认旧版本镜像是否还在：

```bash
sudo docker images | grep ipshub
```

修改 `docker-compose.prod.yml`：

```yaml
services:
  ipshub-backend:
    image: ipshub-backend:1.0.0

  ipshub-frontend:
    image: ipshub-frontend:1.0.0
```

重新启动：

```bash
sudo docker compose -f docker-compose.prod.yml up -d --force-recreate
```

查看日志：

```bash
sudo docker compose -f docker-compose.prod.yml logs -f
```

---

## 15. 常见问题排查

### 15.1 NAS 上执行 docker 报 permission denied

错误示例：

```text
permission denied while trying to connect to the Docker daemon socket
```

处理方式：

```bash
sudo docker ps
sudo docker compose -f docker-compose.prod.yml ps
```

如果 `sudo` 可以执行，说明只是当前用户没有 Docker socket 权限。

---

### 15.2 不小心又在 NAS 上 build 了

检查 `docker-compose.prod.yml` 是否还有：

```yaml
build:
```

生产 compose 里应该只保留：

```yaml
image: ipshub-backend:latest
image: ipshub-frontend:latest
```

启动时不要用：

```bash
sudo docker compose up -d --build
```

应该用：

```bash
sudo docker compose -f docker-compose.prod.yml up -d
```

---

### 15.3 启动后访问不了前端

检查容器状态：

```bash
sudo docker ps
```

检查前端日志：

```bash
sudo docker logs -f ipshub-frontend
```

检查端口是否映射：

```bash
sudo docker port ipshub-frontend
```

确认浏览器访问：

```text
http://NAS_IP:8088
```

同时确认 DSM 防火墙是否放行 `8088`。

---

### 15.4 后端健康检查失败

检查后端日志：

```bash
sudo docker logs -f ipshub-backend
```

进入容器检查：

```bash
sudo docker exec -it ipshub-backend sh
```

容器内检查端口：

```bash
wget -qO- http://localhost:8080/health
```

如果没有 `wget`，需要确认 Dockerfile runtime stage 是否安装了 `wget`。

---

### 15.5 上传到 NAS 后报 exec format error

通常是镜像架构不匹配。

NAS 是 `x86_64` 时，本地必须用：

```bash
--platform linux/amd64
```

检查镜像架构：

```bash
sudo docker inspect ipshub-backend:latest | grep Architecture
```

预期：

```text
"Architecture": "amd64"
```

---

### 15.6 better-sqlite3 / node-gyp 构建慢或失败

这是为什么推荐本地构建，而不是 NAS 构建。

如果必须在 Dockerfile 里处理 native build 依赖，Alpine 需要：

```dockerfile
RUN apk add --no-cache python3 make g++ sqlite-dev
```

如果使用 Debian 镜像，需要：

```dockerfile
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    sqlite3 \
    libsqlite3-dev \
    dumb-init \
    wget \
    && rm -rf /var/lib/apt/lists/*
```

但推荐做法仍然是：**本地构建镜像，NAS 只运行镜像**。

---

## 16. 一键发布命令参考

可以在本地创建脚本：

```bash
nano deploy-nas.sh
```

内容：

```bash
#!/usr/bin/env bash
set -e

NAS_USER="your_user"
NAS_HOST="NAS_IP"
NAS_DIR="/volume1/docker/ipshub"
PLATFORM="linux/amd64"
VERSION="latest"

IMAGE_BACKEND="ipshub-backend:${VERSION}"
IMAGE_FRONTEND="ipshub-frontend:${VERSION}"
PACKAGE="ipshub-images-${VERSION}.tar.gz"

echo "[1/5] Build backend image"
docker buildx build \
  --platform "${PLATFORM}" \
  --target backend \
  -t "${IMAGE_BACKEND}" \
  --load \
  .

echo "[2/5] Build frontend image"
docker buildx build \
  --platform "${PLATFORM}" \
  --target frontend \
  -t "${IMAGE_FRONTEND}" \
  --load \
  .

echo "[3/5] Save images"
docker save "${IMAGE_BACKEND}" "${IMAGE_FRONTEND}" | gzip > "${PACKAGE}"

echo "[4/5] Upload package to NAS"
scp "${PACKAGE}" "${NAS_USER}@${NAS_HOST}:${NAS_DIR}/images/"

echo "[5/5] Load and restart on NAS"
ssh "${NAS_USER}@${NAS_HOST}" "cd ${NAS_DIR} && gunzip -c images/${PACKAGE} | sudo docker load && sudo docker compose -f docker-compose.prod.yml up -d --force-recreate && sudo docker compose -f docker-compose.prod.yml ps"

echo "Deploy completed."
```

授权：

```bash
chmod +x deploy-nas.sh
```

执行：

```bash
./deploy-nas.sh
```

---

## 17. 最小部署命令汇总

### 本地执行

```bash
docker buildx build --platform linux/amd64 --target backend -t ipshub-backend:latest --load .
docker buildx build --platform linux/amd64 --target frontend -t ipshub-frontend:latest --load .
docker save ipshub-backend:latest ipshub-frontend:latest | gzip > ipshub-images-latest.tar.gz
scp ipshub-images-latest.tar.gz your_user@NAS_IP:/volume1/docker/ipshub/images/
```

### NAS 执行

```bash
cd /volume1/docker/ipshub
gunzip -c images/ipshub-images-latest.tar.gz | sudo docker load
sudo docker compose -f docker-compose.prod.yml up -d --force-recreate
sudo docker compose -f docker-compose.prod.yml logs -f
```

---

## 18. 最终原则

生产部署时保持以下原则：

```text
本地负责 build
NAS 负责 run
Compose 不写 build
数据目录必须挂载
每次发布保留版本号
异常时通过切换 image tag 回滚
```
