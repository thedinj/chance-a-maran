# Deployment Guide

Chance-a-Maran uses the **generic pi-deploy scripts** from the Basket Bot repo.
Basket Bot must be installed first — it registers `pi-app-install` and
`pi-app-update` system-wide and is the canonical source for the shared scripts.

See `~/basket-bot/apps/backend/scripts/DEPLOY.md` for the full guide.

---

## Prerequisites

- Basket Bot is already installed on this Pi
- Node.js v20 is installed
- You are SSH'd in as the `admin` user

---

## Install Chance-a-Maran

First, bring the hoisted scripts up to date with the latest fixes from basket-bot:

```bash
cd ~/basket-bot/apps/backend/scripts && ./update.sh
```

Then clone and install:

```bash
cd ~
git clone https://github.com/thedinj/chance-a-maran.git
cd ~/chance-a-maran && git config core.filemode false
chmod +x apps/backend/scripts/*.sh
pi-app-install ~/chance-a-maran/apps/backend/scripts/deploy.config.sh
```

**Interactive prompts:**
- Edit `.env` — confirm `PORT=3001`, set `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD`
- Enable HTTPS? → `y`, enter `chanceamaran.ddns.net`
- Install Samba? → existing shares will be reused, safe to say `y` or `n`

---

## Update Chance-a-Maran

```bash
pi-app-update ~/chance-a-maran/apps/backend/scripts/deploy.config.sh
```

To update both apps at once (basket-bot first so hoisted scripts stay current):

```bash
cd ~/basket-bot/apps/backend/scripts && ./update.sh && \
pi-app-update ~/chance-a-maran/apps/backend/scripts/deploy.config.sh
```

---

## Useful commands

```bash
# Service
sudo systemctl status chance-a-maran-backend
sudo journalctl -u chance-a-maran-backend -f
sudo systemctl restart chance-a-maran-backend

# Caddy (shared with Basket Bot)
sudo systemctl status caddy
sudo journalctl -u caddy -n 50 --no-pager
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
cat /etc/caddy/conf.d/chance-a-maran.caddy

# Database backup location
ls ~/chance-a-maran/apps/backend/backups/
```

---

## Config summary

| Setting        | Value                          |
|----------------|-------------------------------|
| Backend port   | 3001 (localhost only)         |
| Frontend       | Vite SPA — static files at `apps/mobile/www`, served by Caddy |
| Domain         | chanceamaran.ddns.net         |
| Service name   | `chance-a-maran-backend`      |
| Caddy config   | `/etc/caddy/conf.d/chance-a-maran.caddy` |
| Database       | `apps/backend/database.db`    |
