#!/bin/bash
set -e

# ==============================================================================
# CHANCE-A-MARAN INSTALLATION SCRIPT
# ==============================================================================
# For Raspberry Pi Raspbian - Run as admin user
#
# GETTING STARTED - First-time setup:
# ------------------------------------
# 1. Install basket-bot first (it bootstraps the shared pi-deploy scripts):
#
#    If basket-bot is not yet cloned:
#      cd ~
#      git clone https://github.com/thedinj/basket-bot.git
#      cd basket-bot && git config core.filemode false
#
#    Then bootstrap:
#      cd ~/basket-bot/apps/backend/scripts
#      chmod +x bootstrap.sh install.sh update.sh
#      ./bootstrap.sh
#
#    (You only need to do this once per Pi. If basket-bot is already installed,
#    the shared scripts are likely already in place.)
#
# 2. SSH into your Raspberry Pi as the admin user (if not already):
#      ssh admin@your-pi-hostname
#
# 3. Install Node.js v20 if not already installed:
#      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
#      sudo apt-get install -y nodejs
#      node --version && npm --version   # verify
#
# 4. Clone chance-a-maran (recommended: ~/chance-a-maran):
#      cd ~
#      git clone https://github.com/thedinj/chance-a-maran.git
#
# 5. Disable file mode change tracking:
#      cd ~/chance-a-maran && git config core.filemode false
#
# 6. Edit deploy.config.sh if needed (e.g. to set DEFAULT_DOMAIN):
#      nano ~/chance-a-maran/apps/backend/scripts/deploy.config.sh
#
# 7. Make this script executable and run it:
#      cd ~/chance-a-maran/apps/backend/scripts
#      chmod +x install.sh update.sh
#      ./install.sh
#
# WHAT THIS SCRIPT DOES:
# ----------------------
# - Installs pnpm dependencies across the monorepo
# - Builds the shared core package, backend, and mobile web app
# - Creates apps/backend/.env (prompts you to set admin credentials)
# - Initialises the SQLite database
# - Creates a systemd service (chance-a-maran-backend) for auto-start on boot
# - Installs and configures Caddy to serve the mobile SPA and proxy the API
# - Optionally configures HTTPS with Let's Encrypt
# - Optionally installs Samba for Windows network file access
#
# POST-INSTALL: Import legacy card data
# --------------------------------------
# The install script seeds the database (admin user, app settings) but does NOT
# import legacy card data. After installation completes, run:
#
#   cd ~/chance-a-maran/apps/backend
#   pnpm db:import
#
# This reads raw_assets/old_database.sql (included in the repo — no manual copy
# needed) and imports cards, images, and requirement elements into SQLite.
# The import is idempotent: safe to re-run, it skips if data already exists.
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYSTEM_SCRIPT="/usr/local/lib/pi-deploy/install.sh"

if [ ! -f "$SYSTEM_SCRIPT" ]; then
    echo "❌ Shared pi-deploy scripts not found at /usr/local/lib/pi-deploy/"
    echo ""
    echo "   Install basket-bot first to bootstrap the shared scripts:"
    echo "     cd ~/basket-bot/apps/backend/scripts"
    echo "     chmod +x bootstrap.sh && ./bootstrap.sh"
    echo ""
    echo "   Then re-run this script."
    exit 1
fi

exec "$SYSTEM_SCRIPT" "$SCRIPT_DIR/deploy.config.sh"
