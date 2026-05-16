#!/bin/bash
# Pixory — start all backend services + Metro bundler
#
# Usage:
#   ./start.sh          — backend only (use when app already installed on phone)
#   ./start.sh --metro  — backend + Metro bundler (use when running on physical device)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
APP_DIR="$SCRIPT_DIR/photosort-app"
START_METRO=false

for arg in "$@"; do
  [[ "$arg" == "--metro" ]] && START_METRO=true
done

# ── Colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}"
echo "  ██████╗ ██╗██╗  ██╗ ██████╗ ██████╗ ██╗   ██╗"
echo "  ██╔══██╗██║╚██╗██╔╝██╔═══██╗██╔══██╗╚██╗ ██╔╝"
echo "  ██████╔╝██║ ╚███╔╝ ██║   ██║██████╔╝ ╚████╔╝ "
echo "  ██╔═══╝ ██║ ██╔██╗ ██║   ██║██╔══██╗  ╚██╔╝  "
echo "  ██║     ██║██╔╝ ██╗╚██████╔╝██║  ██║   ██║   "
echo "  ╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝  "
echo -e "${NC}"

# ── Cleanup on exit ───────────────────────────────────────────────────────────
METRO_PID=""
NODE_PID=""
PYTHON_PID=""

cleanup() {
  echo ""
  echo -e "${YELLOW}Shutting down...${NC}"
  [[ -n "$METRO_PID" ]]  && kill "$METRO_PID"  2>/dev/null
  [[ -n "$NODE_PID" ]]   && kill "$NODE_PID"   2>/dev/null
  [[ -n "$PYTHON_PID" ]] && kill "$PYTHON_PID" 2>/dev/null
  wait 2>/dev/null
  echo "Bye!"
}
trap cleanup EXIT INT TERM

# ── Python sidecar (port 8001) ────────────────────────────────────────────────
echo -e "${GREEN}▶ Starting Instagram publish sidecar (Python / instagrapi)...${NC}"
cd "$BACKEND_DIR"
python3 publish_sidecar.py &
PYTHON_PID=$!

# Wait for sidecar to be ready
for i in {1..10}; do
  if curl -s http://127.0.0.1:8001/health > /dev/null 2>&1; then
    echo -e "${GREEN}  ✓ Sidecar ready on http://127.0.0.1:8001${NC}"
    break
  fi
  sleep 1
done

# ── Node.js backend (port 8000) ───────────────────────────────────────────────
echo -e "${GREEN}▶ Starting Node.js backend (curation + proxy)...${NC}"
npm run dev &
NODE_PID=$!

# Wait for backend to be ready
for i in {1..15}; do
  if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo ""
    echo -e "${GREEN}✓ All services running${NC}"
    echo -e "  ${BLUE}Backend:  http://localhost:8000${NC}"
    echo -e "  ${BLUE}Sidecar:  http://127.0.0.1:8001${NC}"
    echo ""
    echo -e "  ${YELLOW}iPhone URL: http://$(ipconfig getifaddr en0):8000${NC}"
    echo ""
    echo "Press Ctrl+C to stop everything."
    break
  fi
  sleep 1
done

# ── Metro bundler (optional, for physical device dev) ────────────────────────
if $START_METRO; then
  LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || echo "localhost")
  echo -e "${GREEN}▶ Starting Metro bundler (--lan for physical device)...${NC}"
  cd "$APP_DIR"
  npx expo start --lan --port 8081 &
  METRO_PID=$!
  echo -e "${GREEN}  ✓ Metro starting on http://${LOCAL_IP}:8081${NC}"
  echo -e "${YELLOW}  → Open the Pixory app on your iPhone — it will auto-connect${NC}"
  echo -e "${YELLOW}  → If it shows 'No script URL', shake phone → Configure Bundler → ${LOCAL_IP}:8081${NC}"
  echo ""
fi

# ── Cloudflare tunnel for backend (phone access) ─────────────────────────────
echo -e "${GREEN}▶ Starting Cloudflare tunnel for backend...${NC}"
cloudflared tunnel --url http://localhost:8000 > /tmp/cf-tunnel.log 2>&1 &
CF_PID=$!
for i in {1..15}; do
  CF_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/cf-tunnel.log 2>/dev/null | head -1)
  if [[ -n "$CF_URL" ]]; then
    echo -e "${GREEN}  ✓ Tunnel ready${NC}"
    echo ""
    echo -e "  ${YELLOW}╔══════════════════════════════════════════════════════╗${NC}"
    echo -e "  ${YELLOW}║  Backend URL for iPhone:                             ║${NC}"
    echo -e "  ${YELLOW}║  $CF_URL  ║${NC}"
    echo -e "  ${YELLOW}╚══════════════════════════════════════════════════════╝${NC}"
    echo ""
    break
  fi
  sleep 1
done

# ── Keep running ──────────────────────────────────────────────────────────────
wait
