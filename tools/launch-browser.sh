#!/usr/bin/env bash
# Helper script to launch an isolated developer browser instance with remote debugging enabled
# Preserves active daily sessions without profile locking or restart requirements.

set -euo pipefail

TARGET="${1:-chrome}"
shift || true

case "$TARGET" in
  chrome|chromium|brave)
    PROFILE_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/userscript-dev-chrome"
    PORT="9222"
    mkdir -p "$PROFILE_DIR"

    BIN=""
    for candidate in google-chrome google-chrome-stable chromium chromium-browser brave-browser; do
      if command -v "$candidate" >/dev/null 2>&1; then
        BIN="$candidate"
        break
      fi
    done

    if [ -z "$BIN" ]; then
      echo "❌ No Chromium-based browser found on PATH." >&2
      exit 1
    fi

    echo "🚀 Launching $BIN on debug port $PORT with profile $PROFILE_DIR..."
    echo "🔗 MCP Connection Target: http://127.0.0.1:$PORT"
    exec "$BIN" \
      --remote-debugging-port="$PORT" \
      --user-data-dir="$PROFILE_DIR" \
      --no-first-run \
      --no-default-browser-check \
      "$@"
    ;;

  firefox)
    PROFILE_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/userscript-dev-firefox"
    PORT="2828"
    mkdir -p "$PROFILE_DIR"

    # Write user prefs for automated Marionette/BiDi support
    cat << 'EOF' > "$PROFILE_DIR/user.js"
user_pref("marionette.enabled", true);
user_pref("marionette.port", 2828);
user_pref("devtools.debugger.remote-enabled", true);
user_pref("devtools.chrome.enabled", true);
EOF

    BIN=""
    for candidate in firefox firefox-developer-edition firefox-nightly; do
      if command -v "$candidate" >/dev/null 2>&1; then
        BIN="$candidate"
        break
      fi
    done

    if [ -z "$BIN" ]; then
      echo "❌ No Firefox executable found on PATH." >&2
      exit 1
    fi

    echo "🚀 Launching $BIN on Marionette/BiDi port $PORT with profile $PROFILE_DIR..."
    echo "🔗 MCP Connection Target: 127.0.0.1:$PORT"
    exec "$BIN" \
      --marionette \
      --remote-debugging-port "$PORT" \
      -profile "$PROFILE_DIR" \
      "$@"
    ;;

  *)
    echo "Usage: $0 [chrome|firefox] [extra browser flags...]"
    exit 1
    ;;
esac
