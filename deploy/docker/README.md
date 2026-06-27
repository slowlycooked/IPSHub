# Optional Docker Deployment

Native macOS is the primary deployment target for IPSHub. Keep this directory
for NAS or container-only environments.

## Run with Docker Compose

From the repository root:

```bash
cp .env.example .env
# Edit .env. For Docker, APP_BASE_URL usually uses WEB_PORT and DB_PATH is
# overridden to /app/data/ipshub.db by docker-compose.yml.
docker compose --env-file .env -f deploy/docker/docker-compose.yml up -d --build
```

The frontend is exposed on `WEB_PORT` and proxies `/api`, `/sub`, and `/health`
to the backend container.

## Synology NAS

Upload `deploy/docker/docker-compose.yml` in Container Manager or run Compose
from an SSH session. Persistent files still live in the repository-level
`data/` and `config/` directories through the relative volume mounts.

## Build Notes

The Dockerfile has separate stages for web dependencies, server dependencies,
web build, server build, sing-box download, backend runtime, and nginx frontend.
The sing-box binary is downloaded from GitHub Releases during the Docker build.

To override the sing-box version:

```bash
docker compose --env-file .env -f deploy/docker/docker-compose.yml build \
  --build-arg SING_BOX_VERSION=1.11.0
```
