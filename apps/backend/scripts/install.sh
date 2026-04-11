#!/bin/bash
set -e

# ==============================================================================
# CHANCE-A-MARAN INSTALLATION SCRIPT
# ==============================================================================
# For Raspberry Pi Raspbian - Run as admin user
#
# GETTING STARTED - First-time setup:
# ------------------------------------
# basket-bot must be installed first — it is the canonical source for the shared
# pi-deploy scripts. See ~/basket-bot/apps/backend/scripts/DEPLOY.md for the
# full guide, including how to install basket-bot itself.
#
# 1. SSH into your Raspberry Pi as the admin user:
#      ssh admin@your-pi-hostname
#
# 2. Update basket-bot to ensure the hoisted scripts have all the latest fixes:
#      cd ~/basket-bot/apps/backend/scripts && ./update.sh
#
# 3. Clone chance-a-maran (recommended: ~/chance-a-maran):
#      cd ~
#      git clone https://github.com/thedinj/chance-a-maran.git
#      cd ~/chance-a-maran && git config core.filemode false
#
# 4. Make these scripts executable:
#      chmod +x ~/chance-a-maran/apps/backend/scripts/*.sh
#
# 5. Run the install (preferred — uses the up-to-date hoisted script directly):
#      pi-app-install ~/chance-a-maran/apps/backend/scripts/deploy.config.sh
#
#    Or use this thin-wrapper (delegates to the same hoisted script):
#      cd ~/chance-a-maran/apps/backend/scripts && ./install.sh
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
