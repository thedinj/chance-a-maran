#!/bin/bash
set -e

# ==============================================================================
# BASKET BOT BACKEND INSTALLATION SCRIPT
# ==============================================================================
# For Raspberry Pi Raspbian - Run as admin user
#
# PREREQUISITES - Getting the code onto your server:
# ------------------------------------------------------------------------------
# 1. SSH into your Raspberry Pi as the admin user:
#    ssh admin@your-pi-hostname
#
# 2. Install Node.js (v18 or higher) if not already installed:
#    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
#    sudo apt-get install -y nodejs
#    # Verify installation: node --version && npm --version
#
# 3. Navigate to your home directory (recommended location):
#    cd ~
#    # This takes you to /home/admin (typical for admin user on Raspbian)
#    # You can clone to any directory you have write permissions for
#    # Use 'pwd' to confirm your current location
#
# 4. Clone the repository from GitHub:
#    git clone https://github.com/thedinj/basket-bot.git
#    # This creates a new directory: ~/basket-bot
#
#    OR, if you've already cloned it, navigate into it and update to latest:
#    cd ~/basket-bot
#    git pull origin main
#
# 5. Configure Git to ignore file mode changes (prevents chmod from showing as change):
#    cd ~/basket-bot
#    git config core.filemode false
#
# 6. Navigate to the backend scripts directory:
#    cd apps/backend/scripts
#
# 7. Make this script executable (if not already):
#    chmod +x install.sh
#
# 8. Run this installation script:
#    ./install.sh
#
# WHAT THIS SCRIPT DOES:
# ------------------------------------------------------------------------------
# - Installs dependencies (pnpm, Node.js packages)
# - Builds the backend application
# - Sets up the SQLite database
# - Configures systemd service for auto-start on boot
# - Optionally configures HTTPS with Caddy reverse proxy
# ==============================================================================

echo "================================================"
echo "Basket Bot Backend Installation"
echo "================================================"
echo ""

# Get the absolute path to the project root (2 levels up from scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/apps/backend"

echo "Project root: $PROJECT_ROOT"
echo "Backend directory: $BACKEND_DIR"
echo ""

# Cleanup function for script failures
SERVICE_CREATED=false
FIREWALL_CONFIGURED=false
cleanup_on_error() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        echo ""
        echo "❌ Installation failed. Cleaning up..."

        # Remove systemd service if created
        if [ "$SERVICE_CREATED" = true ] && [ -n "$SERVICE_NAME" ]; then
            sudo systemctl stop "$SERVICE_NAME" 2>/dev/null || true
            sudo systemctl disable "$SERVICE_NAME" 2>/dev/null || true
            sudo rm -f "/etc/systemd/system/$SERVICE_NAME.service" 2>/dev/null || true
            sudo systemctl daemon-reload
            echo "✓ Removed systemd service"
        fi

        echo "⚠️  Partial installation state. You may need to manually clean up:"
        echo "   - Firewall rules (ufw status)"
        echo "   - Samba shares (/etc/samba/smb.conf)"
        echo "   - Caddy config (/etc/caddy/Caddyfile)"
    fi
}
trap cleanup_on_error EXIT

# Check if running as admin user
CURRENT_USER=$(whoami)
if [ "$CURRENT_USER" != "admin" ]; then
    echo "⚠️  Warning: This script should be run as the 'admin' user."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if pnpm is installed
echo "Checking for pnpm..."
if ! command -v pnpm &> /dev/null; then
    echo "pnpm not found. Installing pnpm globally..."

    # Check if npm is available
    if ! command -v npm &> /dev/null; then
        echo "❌ npm is not installed. Please install Node.js first:"
        echo "   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
        echo "   sudo apt-get install -y nodejs"
        echo ""
        echo "   Then verify installation:"
        echo "   node --version && npm --version"
        exit 1
    fi

    sudo npm install -g pnpm
else
    echo "✓ pnpm is already installed ($(pnpm --version))"
fi
echo ""

# Check if Node.js is installed (v18 or higher recommended)
echo "Checking Node.js version..."
NODE_VERSION=$(node --version 2>/dev/null || echo "not found")
if [ "$NODE_VERSION" = "not found" ]; then
    echo "❌ Node.js is not installed. Please install Node.js v18 or higher."
    exit 1
else
    echo "✓ Node.js version: $NODE_VERSION"
fi
echo ""

# Check if sqlite3 is installed (useful for database inspection)
echo "Checking for sqlite3..."
if ! command -v sqlite3 &> /dev/null; then
    echo "sqlite3 not found. Installing sqlite3..."
    sudo apt-get update
    sudo apt-get install -y sqlite3
    echo "✓ sqlite3 installed"
else
    echo "✓ sqlite3 is already installed ($(sqlite3 --version))"
fi
echo ""

# Install and configure UFW firewall
echo "Checking and configuring firewall (UFW)..."
if ! command -v ufw &> /dev/null; then
    echo "UFW not found. Installing UFW..."
    sudo apt-get update
    sudo apt-get install -y ufw
    echo "✓ UFW installed"
else
    echo "✓ UFW is already installed"
fi

# Check if UFW is enabled
if ! sudo ufw status | grep -q "Status: active"; then
    echo ""
    echo "================================================"
    echo "Firewall Security Configuration"
    echo "================================================"
    echo ""
    echo "⚠️  CRITICAL: UFW firewall is not enabled."
    echo ""
    echo "Before enabling UFW, SSH access (port 22) will be allowed"
    echo "to prevent being locked out of your server."
    echo ""
    echo "The following ports will be configured:"
    echo "  - Port 22  (SSH - for remote access)"
    echo "  - Port 80  (HTTP - required for Let's Encrypt)"
    echo "  - Port 443 (HTTPS)"
    echo ""
    echo "Your backend application port will be added automatically"
    echo "based on your configuration choices."
    echo ""
    read -p "Enable UFW firewall now? (Y/n): " -n 1 -r
    echo ""

    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        # Allow SSH first (critical to prevent lockout!)
        sudo ufw allow 22/tcp
        echo "✓ SSH access allowed (port 22)"

        # Allow common HTTPS ports
        sudo ufw allow 80/tcp
        sudo ufw allow 443/tcp
        echo "✓ HTTP/HTTPS ports allowed (80, 443)"

        # Set defaults
        sudo ufw default deny incoming
        sudo ufw default allow outgoing
        echo "✓ Default policies set (deny incoming, allow outgoing)"

        # Enable UFW
        echo ""
        echo "Enabling UFW firewall..."
        sudo ufw --force enable
        echo "✓ UFW firewall enabled"
        echo ""
        sudo ufw status numbered
    else
        echo "⚠️  Skipping UFW setup. You will need to configure firewall manually."
        echo "   For security, this is NOT recommended for production servers."
    fi
else
    echo "✓ UFW firewall is already enabled"
    echo ""
    echo "Current firewall status:"
    sudo ufw status numbered
fi
echo ""

# Navigate to project root
cd "$PROJECT_ROOT"

# Install dependencies
echo "Installing dependencies..."
if ! pnpm install; then
    echo "❌ Failed to install dependencies"
    exit 1
fi
echo "✓ Dependencies installed"
echo ""

# Build core package
echo "Building core package..."
if ! pnpm --filter @basket-bot/core build; then
    echo "❌ Failed to build core package"
    exit 1
fi
echo "✓ Core package built"
echo ""

# Set up environment file (must be done BEFORE building backend)
echo "Setting up environment file..."
cd "$BACKEND_DIR"
if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo "Creating .env from .env.example..."
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"

    # Generate a random JWT secret
    JWT_SECRET=$(openssl rand -base64 32)
    sed -i "s|JWT_SECRET=\"your-secret-key-change-this-in-production\"|JWT_SECRET=\"$JWT_SECRET\"|g" "$BACKEND_DIR/.env"

    # Set production environment
    sed -i 's|NODE_ENV="development"|NODE_ENV="production"|g' "$BACKEND_DIR/.env"

    echo "✓ .env file created with random JWT secret"
else
    echo "✓ .env file already exists"
    echo "Updating NODE_ENV to production..."

    # Ensure production environment
    sed -i 's|NODE_ENV="development"|NODE_ENV="production"|g' "$BACKEND_DIR/.env"
fi

echo ""
echo "⚠️  IMPORTANT: Please edit $BACKEND_DIR/.env and verify/update:"
echo "   - ADMIN_EMAIL"
echo "   - ADMIN_NAME"
echo "   - ADMIN_PASSWORD"
echo "   - JWT_SECRET (if using existing .env)"
echo ""
read -p "Press Enter after you've updated the .env file..."
echo ""

# Validate required .env fields
echo "Validating .env configuration..."
ADMIN_EMAIL=$(grep -E '^ADMIN_EMAIL=' "$BACKEND_DIR/.env" | cut -d '=' -f 2 | tr -d '"')
ADMIN_PASSWORD=$(grep -E '^ADMIN_PASSWORD=' "$BACKEND_DIR/.env" | cut -d '=' -f 2 | tr -d '"')

if [ "$ADMIN_EMAIL" = "admin@example.com" ] || [ -z "$ADMIN_EMAIL" ]; then
    echo "❌ ADMIN_EMAIL is not configured in .env file"
    echo "   Please edit $BACKEND_DIR/.env and set a valid admin email"
    exit 1
fi

if [ "$ADMIN_PASSWORD" = "change-this-password" ] || [ -z "$ADMIN_PASSWORD" ]; then
    echo "❌ ADMIN_PASSWORD is not configured in .env file"
    echo "   Please edit $BACKEND_DIR/.env and set a secure admin password"
    exit 1
fi

echo "✓ .env configuration validated"
echo ""

# Build backend (after .env is configured and validated)
echo "Building backend..."
if ! pnpm build; then
    echo "❌ Backend build failed"
    exit 1
fi
echo "✓ Backend built"
echo ""

# Ask if user wants to enable HTTPS with Caddy
echo "================================================"
echo "HTTPS Configuration (Optional)"
echo "================================================"
echo ""
echo "Would you like to enable HTTPS using Caddy?"
echo "This provides free automatic SSL certificates via Let's Encrypt."
echo ""
echo "Prerequisites:"
echo "  - You have a domain name pointing to this server"
echo "  - Ports 80 and 443 are forwarded to this server"
echo ""
read -p "Enable HTTPS? (y/N): " -n 1 -r
echo ""
ENABLE_HTTPS=false
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ENABLE_HTTPS=true

    # Get domain name
    echo ""
    read -p "Enter your domain name [basketbot.ddns.net]: " DOMAIN_NAME
    DOMAIN_NAME=${DOMAIN_NAME:-basketbot.ddns.net}

    if [ -z "$DOMAIN_NAME" ]; then
        echo "❌ Domain name is required for HTTPS. Skipping HTTPS setup."
        ENABLE_HTTPS=false
    else
        # Validate domain name format (basic check)
        if ! echo "$DOMAIN_NAME" | grep -qE '^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$'; then
            echo "❌ Invalid domain name format: $DOMAIN_NAME"
            echo "   Domain should be like: example.com or subdomain.example.com"
            ENABLE_HTTPS=false
        fi
    fi
fi
echo ""

# Initialize database (before service creation)
echo "Initializing database..."
if ! pnpm db:init; then
    echo "❌ Database initialization failed"
    exit 1
fi
echo "✓ Database initialized"
echo ""

# Create systemd service file
SERVICE_NAME="basket-bot-backend"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"
SERVICE_CREATED=true

echo "Creating systemd service..."
sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Basket Bot Backend Service
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$BACKEND_DIR
Environment="NODE_ENV=production"
Environment="PATH=/usr/bin:/usr/local/bin:$HOME/.local/share/pnpm"
ExecStart=$(which pnpm) start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

[Install]
WantedBy=multi-user.target
EOF

echo "✓ Systemd service file created at $SERVICE_FILE"
echo ""

# Reload systemd, enable and start the service
echo "Configuring systemd service..."
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl start "$SERVICE_NAME"
echo "✓ Service enabled and started"
echo ""

# Wait for service to start (with timeout)
echo "Waiting for service to start..."
MAX_WAIT=30
COUNT=0
while [ $COUNT -lt $MAX_WAIT ]; do
    if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
        echo "✓ Service is running (started in ${COUNT}s)"
        sudo systemctl status "$SERVICE_NAME" --no-pager -l
        break
    fi
    sleep 1
    COUNT=$((COUNT + 1))

    if [ $COUNT -eq $MAX_WAIT ]; then
        echo "❌ Service failed to start within ${MAX_WAIT} seconds"
        echo ""
        echo "Service status:"
        sudo systemctl status "$SERVICE_NAME" --no-pager -l
        echo ""
        echo "Recent logs:"
        sudo journalctl -u "$SERVICE_NAME" -n 50 --no-pager
        exit 1
    fi
done
echo ""

# Get port from .env file
PORT=$(grep -E '^PORT=' "$BACKEND_DIR/.env" | cut -d '=' -f 2 | tr -d '"' || echo "3000")

# Configure firewall to allow application access
echo "Configuring firewall for application access..."

if command -v ufw &> /dev/null && sudo ufw status | grep -q "Status: active"; then
    echo "Detected active UFW firewall"

    # Always allow backend port for flexibility (direct access, debugging)
    echo "Allowing backend port $PORT..."

    # Check if rule already exists
    if ! sudo ufw status | grep -q "$PORT/tcp"; then
        sudo ufw allow $PORT/tcp
        echo "✓ Firewall rule added (ufw allow $PORT/tcp)"
    else
        echo "✓ Firewall rule already exists for port $PORT"
    fi

    if [ "$ENABLE_HTTPS" = true ]; then
        echo "✓ HTTPS mode: Backend accessible via reverse proxy and directly on port $PORT"
    else
        echo "✓ Direct access mode: Backend accessible on port $PORT"
    fi

    echo ""
    echo "Current firewall status:"
    sudo ufw status numbered
elif command -v iptables &> /dev/null; then
    echo "⚠️  UFW not active. Falling back to iptables configuration."

    # Determine which ports to open
    if [ "$ENABLE_HTTPS" = true ]; then
        PORTS="80 443"
    else
        PORTS="$PORT"
    fi

    for port in $PORTS; do
        if ! sudo iptables -C INPUT -p tcp --dport $port -j ACCEPT 2>/dev/null; then
            sudo iptables -A INPUT -p tcp --dport $port -j ACCEPT
            echo "✓ Firewall rule added (iptables -A INPUT -p tcp --dport $port -j ACCEPT)"
        else
            echo "✓ Firewall rule already exists for port $port"
        fi
    done

    # Save iptables rules
    if command -v iptables-save &> /dev/null; then
        sudo sh -c "iptables-save > /etc/iptables/rules.v4" 2>/dev/null || true
        echo "✓ iptables rules saved"
    fi
else
    echo "⚠️  No firewall detected or configured."
    echo "   For security, consider enabling UFW:"
    echo "   1. Allow SSH: sudo ufw allow 22/tcp"
    echo "   2. Allow app port: sudo ufw allow $PORT/tcp"
    echo "   3. Enable firewall: sudo ufw enable"
fi
echo ""

# Install and configure Caddy if HTTPS is enabled
if [ "$ENABLE_HTTPS" = true ]; then
    echo "================================================"
    echo "Installing Caddy"
    echo "================================================"
    echo ""

    # Check if Caddy is already installed
    if command -v caddy &> /dev/null; then
        echo "✓ Caddy is already installed ($(caddy version))"
    else
        echo "Installing Caddy..."

        # Install dependencies
        sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl

        # Add Caddy repository
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list

        # Install Caddy
        sudo apt update
        sudo apt install -y caddy

        echo "✓ Caddy installed"
    fi
    echo ""

    # Create Caddyfile
    echo "Creating Caddyfile..."
    CADDYFILE="/etc/caddy/Caddyfile"

    sudo tee "$CADDYFILE" > /dev/null <<EOF
# Basket Bot Backend - Automatic HTTPS
$DOMAIN_NAME {
    # Reverse proxy to Next.js backend
    reverse_proxy localhost:$PORT

    # Enable gzip compression
    encode gzip

    # Security headers
    header {
        # Enable HSTS (6 months)
        Strict-Transport-Security "max-age=15552000; includeSubDomains"
        # Prevent clickjacking
        X-Frame-Options "SAMEORIGIN"
        # Prevent MIME sniffing
        X-Content-Type-Options "nosniff"
        # Enable XSS filter
        X-XSS-Protection "1; mode=block"
    }

    # Log access
    log {
        output file /var/log/caddy/basketbot-access.log {
            roll_size 10mb
            roll_keep 5
        }
    }
}
EOF

    echo "✓ Caddyfile created at $CADDYFILE"
    echo ""

    # Create log directory
    sudo mkdir -p /var/log/caddy
    sudo chown caddy:caddy /var/log/caddy

    # Enable and start Caddy
    echo "Starting Caddy service..."
    sudo systemctl enable caddy
    sudo systemctl restart caddy

    # Wait for Caddy to start (with timeout)
    echo "Waiting for Caddy to start..."
    MAX_WAIT=10
    COUNT=0
    CADDY_STARTED=false
    while [ $COUNT -lt $MAX_WAIT ]; do
        if sudo systemctl is-active --quiet caddy; then
            echo "✓ Caddy is running (started in ${COUNT}s)"
            CADDY_STARTED=true
            break
        fi
        sleep 1
        COUNT=$((COUNT + 1))
    done

    if [ "$CADDY_STARTED" = false ]; then
        echo "⚠️  Caddy failed to start within ${MAX_WAIT} seconds"
        echo ""
        echo "Caddy status:"
        sudo systemctl status caddy --no-pager -l
        echo ""
        echo "Recent logs:"
        sudo journalctl -u caddy -n 50 --no-pager
        echo ""
        echo "⚠️  HTTPS setup incomplete. Backend is still accessible on port $PORT."
        echo "   Check logs and Caddyfile configuration."
    fi
    echo ""
fi

# Optional Samba installation for network file access
echo ""
read -p "Install Samba for network file access from Windows? (y/N): " -n 1 -r
echo ""
INSTALL_SAMBA=false
if [[ $REPLY =~ ^[Yy]$ ]]; then
    INSTALL_SAMBA=true

    echo "================================================"
    echo "Installing Samba"
    echo "================================================"
    echo ""

    if command -v smbd &> /dev/null; then
        echo "✓ Samba is already installed"
    else
        echo "Installing Samba..."
        sudo apt-get update
        sudo apt-get install -y samba samba-common-bin
        echo "✓ Samba installed"
    fi

    # Configure shares
    SAMBA_CONF="/etc/samba/smb.conf"

    # Backup existing config if this is first time
    if [ ! -f "$SAMBA_CONF.backup" ]; then
        sudo cp "$SAMBA_CONF" "$SAMBA_CONF.backup"
        echo "✓ Samba config backed up"
    fi

    echo ""
    echo "Configuring Samba shares..."

    # Share 1: Basket Bot project (read-write)
    if ! grep -q "\[basket-bot\]" "$SAMBA_CONF"; then
        sudo tee -a "$SAMBA_CONF" > /dev/null <<EOF

# Basket Bot Backend Files (read-write)
[basket-bot]
    comment = Basket Bot Application Files
    path = $PROJECT_ROOT
    browseable = yes
    read only = no
    create mask = 0644
    directory mask = 0755
    valid users = $CURRENT_USER
EOF
        echo "✓ basket-bot share configured (read-write)"
    else
        echo "✓ basket-bot share already exists"
    fi

    # Share 2: System logs (read-only)
    if ! grep -q "\[logs\]" "$SAMBA_CONF"; then
        # Add admin user to adm group for log access
        sudo usermod -a -G adm "$CURRENT_USER"

        sudo tee -a "$SAMBA_CONF" > /dev/null <<EOF

# System and Application Logs (read-only)
[logs]
    comment = System and Application Logs
    path = /var/log
    browseable = yes
    read only = yes
    valid users = $CURRENT_USER
EOF
        echo "✓ logs share configured (read-only)"
        echo "  Note: Log out and back in for group permissions to take effect"
    else
        echo "✓ logs share already exists"
    fi

    # Share 3: Caddy config (if HTTPS enabled) - configuration only, permissions set after password
    CONFIGURE_CADDY_SHARE=false
    if [ "$ENABLE_HTTPS" = true ]; then
        if ! grep -q "\[caddy-config\]" "$SAMBA_CONF"; then
            CONFIGURE_CADDY_SHARE=true

            sudo tee -a "$SAMBA_CONF" > /dev/null <<EOF

# Caddy Configuration Files (read-write)
[caddy-config]
    comment = Caddy Reverse Proxy Configuration
    path = /etc/caddy
    browseable = yes
    read only = no
    create mask = 0644
    directory mask = 0755
    valid users = $CURRENT_USER
EOF
            echo "✓ caddy-config share configured (read-write)"
        else
            echo "✓ caddy-config share already exists"
        fi
    fi

    # Set Samba password
    echo ""
    echo "Set Samba password for user '$CURRENT_USER':"
    echo "(This can be the same as your Linux password for convenience)"
    echo ""

    # Check if user exists in Samba database
    if ! sudo pdbedit -L | grep -q "^$CURRENT_USER:"; then
        # User doesn't exist, add and set password interactively
        sudo smbpasswd -a "$CURRENT_USER"
    else
        # User already exists
        echo "Samba user '$CURRENT_USER' already exists."
        read -p "Reset Samba password? (y/N): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo smbpasswd "$CURRENT_USER"
        fi
    fi

    # Ensure user is enabled
    sudo smbpasswd -e "$CURRENT_USER"
    echo ""
    echo "✓ Samba user configured"

    # Now that password is set successfully, adjust Caddy permissions if needed
    if [ "$CONFIGURE_CADDY_SHARE" = true ]; then
        sudo chown -R caddy:"$CURRENT_USER" /etc/caddy 2>/dev/null || true
        sudo chmod -R g+w /etc/caddy 2>/dev/null || true
        echo "✓ Caddy directory permissions updated for Samba access"
    fi

    # Restart Samba services
    sudo systemctl restart smbd
    sudo systemctl enable smbd
    sudo systemctl restart nmbd 2>/dev/null || true
    sudo systemctl enable nmbd 2>/dev/null || true
    echo "✓ Samba services started"

    # Configure firewall for Samba
    if command -v ufw &> /dev/null && sudo ufw status | grep -q "Status: active"; then
        if ! sudo ufw status | grep -q "Samba"; then
            sudo ufw allow Samba
            echo "✓ Firewall configured for Samba"
        else
            echo "✓ Samba firewall rules already exist"
        fi
    fi

    # Get IP address
    SERVER_IP=$(hostname -I | awk '{print $1}')

    echo ""
    echo "================================================"
    echo "Samba Network Access Configured"
    echo "================================================"
    echo ""
    echo "From Windows File Explorer, access:"
    echo "  \\\\$SERVER_IP\\basket-bot       (Application files - read/write)"
    echo "  \\\\$SERVER_IP\\logs              (System logs - read-only)"
    if [ "$ENABLE_HTTPS" = true ]; then
        echo "  \\\\$SERVER_IP\\caddy-config      (Caddy config - read/write)"
    fi
    echo ""
    echo "Username: $CURRENT_USER"
    echo "Password: (the Samba password you just set)"
    echo ""
    echo "Tip: In Windows, you can map these as network drives for"
    echo "     easy access. Right-click 'This PC' → 'Map network drive'"
    echo ""
fi

# Display useful commands
echo "================================================"
echo "Installation Complete!"
echo "================================================"
echo ""
echo "The backend service is now running and will start automatically on boot."

if [ "$ENABLE_HTTPS" = true ]; then
    echo ""
    echo "HTTPS Configuration:"
    echo "  Domain: https://$DOMAIN_NAME"
    echo "  Certificate: Automatic (Let's Encrypt)"
    echo "  Renewal: Automatic (handled by Caddy)"
    echo ""
    echo "⚠️  IMPORTANT: Ensure your domain's DNS is configured correctly"
    echo "   and ports 80/443 are forwarded to this server."
    echo ""
    echo "Caddy commands:"
    echo "  sudo systemctl status caddy        # Check Caddy status"
    echo "  sudo systemctl restart caddy       # Restart Caddy"
    echo "  sudo journalctl -u caddy -f        # View Caddy logs"
    echo "  caddy validate --config /etc/caddy/Caddyfile  # Test config"
    echo ""
    echo "Test HTTPS:"
    echo "  curl -I https://$DOMAIN_NAME"
    echo ""
    echo "Update mobile app configuration:"
    echo "  Edit apps/mobile/.env and set:"
    echo "  VITE_API_BASE_URL=https://$DOMAIN_NAME"
else
    echo "Firewall configured to allow network access on port $PORT."
fi
echo ""
echo "Backend service commands:"
echo "  sudo systemctl status $SERVICE_NAME    # Check service status"
echo "  sudo systemctl restart $SERVICE_NAME   # Restart service"
echo "  sudo systemctl stop $SERVICE_NAME      # Stop service"
echo "  sudo systemctl start $SERVICE_NAME     # Start service"
echo "  sudo journalctl -u $SERVICE_NAME -f   # View live logs"
echo "  sudo journalctl -u $SERVICE_NAME -n 100  # View last 100 log lines"
echo ""
echo "After making changes to code or .env:"
echo "  1. Rebuild: cd $BACKEND_DIR && pnpm build"
echo "  2. Restart: sudo systemctl restart $SERVICE_NAME"
echo ""

if [ "$ENABLE_HTTPS" = true ]; then
    echo "Backend accessible at:"
    echo "  HTTPS:   https://$DOMAIN_NAME"
    echo "  Local:   http://localhost:$PORT"
    echo ""
    echo "Admin portal:"
    echo "  https://$DOMAIN_NAME/admin"
else
    echo "Backend should be accessible at:"
    echo "  Local:   http://localhost:$PORT"
    echo "  Network: http://$(hostname -I | awk '{print $1}'):$PORT"
    echo ""
    echo "Admin portal:"
    echo "  http://localhost:$PORT/admin"
fi

echo ""
echo "Environment file location: $BACKEND_DIR/.env"
echo "Database location: $BACKEND_DIR/database.db"

if [ "$ENABLE_HTTPS" = true ]; then
    echo "Caddyfile location: /etc/caddy/Caddyfile"
    echo "Caddy logs: /var/log/caddy/basketbot-access.log"
    echo ""
    echo "For detailed HTTPS setup documentation, see:"
    echo "  $PROJECT_ROOT/docs/HTTPS_SETUP.md"
fi

echo ""
echo "================================================"
echo "Firewall Configuration"
echo "================================================"
echo ""

if command -v ufw &> /dev/null && sudo ufw status | grep -q "Status: active"; then
    echo "UFW Firewall Status:"
    sudo ufw status numbered | head -n 10
    echo ""
    echo "UFW commands:"
    echo "  sudo ufw status numbered         # View all firewall rules"
    echo "  sudo ufw allow <port>/tcp        # Allow a port"
    echo "  sudo ufw delete <rule-number>    # Remove a rule"
    echo "  sudo ufw disable                 # Disable firewall (not recommended)"
    echo "  sudo ufw enable                  # Enable firewall"
    echo ""
    echo "⚠️  Important: Port 22 (SSH) is allowed to prevent lockout."
    echo "   Do not remove this rule unless using another access method."
else
    echo "⚠️  UFW firewall is not active."
    echo "   For security, consider enabling it:"
    echo "   1. sudo ufw allow 22/tcp"
    echo "   2. sudo ufw enable"
fi

if [ "$INSTALL_SAMBA" = true ]; then
    echo ""
    echo "================================================"
    echo "Network File Access (Samba)"
    echo "================================================"
    echo ""
    echo "From Windows:"
    echo "  1. Open File Explorer"
    echo "  2. In address bar: \\\\$SERVER_IP"
    echo "  3. Enter credentials when prompted"
    echo ""
    echo "Available shares:"
    echo "  \\\\$SERVER_IP\\basket-bot       (read/write)"
    echo "  \\\\$SERVER_IP\\logs              (read-only)"
    if [ "$ENABLE_HTTPS" = true ]; then
        echo "  \\\\$SERVER_IP\\caddy-config      (read/write)"
    fi
    echo ""
    echo "Username: $CURRENT_USER"
    echo ""
    echo "Samba commands:"
    echo "  sudo systemctl status smbd       # Check Samba status"
    echo "  sudo systemctl restart smbd      # Restart Samba"
    echo "  sudo smbpasswd $CURRENT_USER     # Change Samba password"
    echo "  sudo nano /etc/samba/smb.conf    # Edit Samba config"
    echo ""
    echo "To edit files remotely:"
    echo "  - Use Notepad++ or VS Code to open files directly from network share"
    echo "  - Or map network drive: Right-click 'This PC' → 'Map network drive'"
fi

echo ""

# Make update script executable
chmod +x "$BACKEND_DIR/scripts/update.sh"

echo ""
echo "================================================"
echo "Database Inspection Guide (SQLite3)"
echo "================================================"
echo ""
echo "To inspect the database, use sqlite3 CLI:"
echo ""
echo "1. Open the database:"
echo "   sqlite3 $BACKEND_DIR/database.db"
echo ""
echo "2. Common commands (run inside sqlite3):"
echo "   .tables                      # List all tables"
echo "   .schema User                 # Show User table schema"
echo "   .schema                      # Show schema for all tables"
echo "   .headers on                  # Enable column headers"
echo "   .mode column                 # Enable column-aligned output"
echo ""
echo "3. Query examples:"
echo "   SELECT COUNT(*) FROM User;                    # Count total users"
echo "   SELECT id, email, name FROM User;             # List all users"
echo "   SELECT * FROM User WHERE email LIKE '%admin%'; # Find admin users"
echo "   SELECT COUNT(*) FROM Store;                   # Count stores"
echo "   SELECT * FROM Household;                      # View all households"
echo "   SELECT * FROM RefreshToken;                   # View active tokens"
echo ""
echo "4. Exit sqlite3:"
echo "   .quit"
echo ""
echo "Quick one-liner examples (no need to enter sqlite3 shell):"
echo "   sqlite3 $BACKEND_DIR/database.db 'SELECT COUNT(*) FROM User;'"
echo "   sqlite3 $BACKEND_DIR/database.db 'SELECT email, name FROM User;'"
echo ""
echo "================================================"
echo ""

# Disable cleanup trap on successful completion
trap - EXIT
