# macOS Native Production Deployment

This guide runs IPSHub directly on macOS without Docker. It is the primary
deployment path for this repo. The production helper pulls updates with git,
builds the server and web app, initializes or migrates the SQLite database
during startup, and keeps the service running in the background.

## 1. Install prerequisites

```bash
brew install node pnpm git
```

The project expects Node.js 20+ and pnpm 8+. Node.js 22 LTS is recommended.
If native dependency rebuilds fail, install Xcode Command Line Tools:

```bash
xcode-select --install
```

## 2. Configure `.env`

```bash
cp .env.example .env
```

For direct macOS hosting, update at least these values:

```dotenv
NODE_ENV=production
APP_BASE_URL=http://YOUR_MAC_MINI_IP:8080
APP_SECRET=replace-with-a-long-random-secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-before-first-start
SERVER_PORT=8080
DB_PATH=./data/ipshub.db
COOKIE_SECURE=false
LOG_LEVEL=info
```

Generate a strong secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

If you put the app behind HTTPS, set `APP_BASE_URL` to the HTTPS URL and set
`COOKIE_SECURE=true`.

## 3. First deployment

```bash
chmod +x scripts/prod.sh
scripts/prod.sh build
scripts/prod.sh start
```

The first startup creates the SQLite database at `DB_PATH`, creates tables,
runs schema migrations, and creates the initial admin user if it does not exist.

Check the service:

```bash
scripts/prod.sh status
curl http://127.0.0.1:8080/health
```

## 4. Update from git and restart

Each time you want to update the Mac mini deployment:

```bash
scripts/prod.sh update
```

This runs `git pull --ff-only`, installs locked dependencies, builds the server
and frontend, stages frontend assets into `public/`, stops the old process, and
starts the new one. Database schema updates run automatically at startup.

By default, updates stop if the working tree has uncommitted changes. To allow
an update anyway:

```bash
IPSHUB_ALLOW_DIRTY=1 scripts/prod.sh update
```

## Optional nginx reverse proxy

The Docker nginx config under `deploy/docker/` proxies to the Docker service
name `backend:8080`. Do not use it directly for host-mode macOS deployment.

For a direct macOS install where `.env` uses `SERVER_PORT=8189`, use
`deploy/macos/nginx.conf`:

```bash
sudo cp deploy/macos/nginx.conf /opt/homebrew/etc/nginx/servers/ipshub.conf
sudo nginx -t
sudo brew services restart nginx
```

If the frontend shows `Request failed with status 502`, verify nginx is proxying
to the same port printed by:

```bash
scripts/prod.sh status
```

## 5. Daily commands

```bash
scripts/prod.sh status
scripts/prod.sh logs
scripts/prod.sh restart
scripts/prod.sh stop
```

## Native SQLite rebuild

IPSHub uses `better-sqlite3`, which includes a native macOS binary. If Node.js
or pnpm changes, rebuild it on the Mac mini before starting:

```bash
scripts/prod.sh rebuild
```

If the rebuild fails on macOS, install Xcode Command Line Tools:

```bash
xcode-select --install
```

Node.js 22 LTS is recommended for production. Very new Node.js versions may
need a local native rebuild because prebuilt binaries are not always available.

Runtime files are stored in:

- `data/` for SQLite and related database files
- `logs/ipshub.log` for process logs
- `.ipshub.pid` for the background process ID
- `public/` for generated frontend assets served by the backend
