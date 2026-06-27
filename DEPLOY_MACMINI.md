# Mac mini Production Deployment

This guide runs IPSHub directly on a macOS host without Docker. The production
helper pulls updates with git, builds the server and web app, initializes or
migrates the SQLite database during startup, and keeps the service running in
the background.

## 1. Install prerequisites

```bash
brew install node pnpm git
```

The project expects Node.js 20+ and pnpm 8+. Node.js 22 LTS is recommended.

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

## 5. Daily commands

```bash
scripts/prod.sh status
scripts/prod.sh logs
scripts/prod.sh restart
scripts/prod.sh stop
```

Runtime files are stored in:

- `data/` for SQLite and related database files
- `logs/ipshub.log` for process logs
- `.ipshub.pid` for the background process ID
- `public/` for generated frontend assets served by the backend

