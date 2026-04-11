#!/bin/bash
set -e

# ==============================================================================
# CHANCE-A-MARAN UPDATE SCRIPT
# ==============================================================================
# For Raspberry Pi Raspbian - Run as admin user
#
# GETTING STARTED - Running an update:
# -------------------------------------
# Always update basket-bot first — it is the canonical source for the shared
# scripts and re-hoists them so pi-app-update is current before running here.
#
# 1. SSH into your Raspberry Pi:
#      ssh admin@your-pi-hostname
#
# 2. Update basket-bot first:
#      cd ~/basket-bot/apps/backend/scripts && ./update.sh
#
# 3. Then update Chance-a-Maran (preferred):
#      pi-app-update ~/chance-a-maran/apps/backend/scripts/deploy.config.sh
#
#    Or use this thin-wrapper (delegates to the same hoisted script):
#      cd ~/chance-a-maran/apps/backend/scripts && ./update.sh
#
# WHAT THIS SCRIPT DOES:
# ----------------------
# - Backs up the SQLite database
# - Pulls the latest code from git
# - Rebuilds the core package, backend, and mobile web app
# - Stops the service, runs any pending migrations, then restarts
# - Runs a health check; automatically rolls back on failure
# - Cleans up old backups (retains the last 10)
#
# NOTE: The actual logic lives in the shared pi-deploy script at
#   /usr/local/lib/pi-deploy/update.sh (installed from basket-bot).
#   If that file is missing, run bootstrap.sh from basket-bot first.
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYSTEM_SCRIPT="/usr/local/lib/pi-deploy/update.sh"

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
