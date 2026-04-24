#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Must be run as root: sudo bash install.sh" >&2
  exit 1
fi

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REAL_USER="${SUDO_USER:-$USER}"
USER_HOME="$(getent passwd "$REAL_USER" | cut -d: -f6)"
DEST="$USER_HOME/homebrew/plugins/heroic"

# ── Build React frontend ───────────────────────────────────────────────────────
# Run the build as the real (non-root) user so nvm / node resolve correctly.
FRONTEND_DIR="$SRC/frontend"
DIST_DIR="$SRC/dist"

if [[ -d "$FRONTEND_DIR" ]]; then
  echo "Building frontend..."
  # Locate node – check nvm dir first, then PATH
  NODE_BIN=""
  NVM_DIR="$USER_HOME/.nvm"
  if [[ -d "$NVM_DIR" ]]; then
    # Find the highest-version node binary under nvm
    NODE_BIN="$(find "$NVM_DIR/versions/node" -maxdepth 3 -name "node" -type f 2>/dev/null | sort -V | tail -1)"
  fi
  if [[ -z "$NODE_BIN" ]]; then
    NODE_BIN="$(su - "$REAL_USER" -c 'command -v node 2>/dev/null' || true)"
  fi

  if [[ -z "$NODE_BIN" ]]; then
    echo "WARNING: node not found – skipping frontend build." >&2
    echo "  Run 'cd frontend && pnpm install && pnpm build' manually, then re-run install.sh." >&2
  else
    NODE_DIR="$(dirname "$NODE_BIN")"
    echo "  Using node: $NODE_BIN"

    # Install dependencies if node_modules is missing or package.json changed
    su "$REAL_USER" -s /bin/bash -c "
      export PATH=\"$NODE_DIR:\$PATH\"
      cd '$FRONTEND_DIR'
      if ! command -v pnpm &>/dev/null; then
        npm install -g pnpm --silent
      fi
      pnpm install --frozen-lockfile 2>/dev/null || pnpm install
      pnpm build
    "
    echo "  Frontend built → $DIST_DIR"
  fi
else
  echo "No frontend/ directory found – skipping build."
fi

# ── Verify dist exists ────────────────────────────────────────────────────────
if [[ ! -f "$DIST_DIR/index.js" ]]; then
  echo "ERROR: $DIST_DIR/index.js is missing." >&2
  echo "  Build the frontend first: cd frontend && pnpm install && pnpm build" >&2
  exit 1
fi

# ── Install plugin ────────────────────────────────────────────────────────────
echo "Installing heroic plugin to $DEST"
rm -rf "$DEST"
mkdir -p "$DEST"

cp -r "$SRC/plugin.json" "$SRC/main.py" "$DEST/"
cp -r "$FRONTEND_DIR/package.json" "$DEST/package.json"
cp -r "$DIST_DIR" "$DEST/dist"
[[ -d "$SRC/py_modules" ]] && cp -r "$SRC/py_modules" "$DEST/"

chown -R root:root "$DEST"

# ── Restart Decky ─────────────────────────────────────────────────────────────
echo "Restarting decky plugin loader..."
systemctl restart plugin_loader.service 2>/dev/null \
  || echo "(plugin_loader.service not found; restart Decky manually)"

echo "Done."
