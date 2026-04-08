#!/bin/bash
# ==============================================================================
# CHANCE-A-MARAN - PI-DEPLOY CONFIGURATION
# ==============================================================================
# Project-specific variables used by the generic install.sh / update.sh scripts.
# Edit this file for your environment before running install.sh.
# ==============================================================================

APP_DISPLAY_NAME="Chance-a-Maran"
APP_SLUG="chance-a-maran"
SERVICE_NAME="chance-a-maran-backend"
CORE_PACKAGE="@chance/core"
DB_INIT_SCRIPT="db:seed"       # pnpm script that initialises/seeds the database

HAS_MOBILE_APP=true            # Builds apps/mobile/ SPA and serves it via Caddy
MOBILE_BUILD_DIR="apps/mobile/www"    # Relative to PROJECT_ROOT; Vite output directory

DEFAULT_DOMAIN="chancegame.ddns.net"      # Default used if user presses Enter at the HTTPS prompt
CADDY_LOG_NAME="chance-a-maran"

GIT_REPO="https://github.com/thedinj/chance-a-maran.git"
