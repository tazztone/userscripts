#!/usr/bin/env bash
# Helper script to launch an isolated developer browser instance with remote debugging enabled
# Preserves active daily sessions without profile locking or restart requirements.

set -euo pipefail

TARGET="${1:-chrome}"
SCRIPT_OR_ARG="${2:-toppreise}"
shift 2 2>/dev/null || shift 1 2>/dev/null || true

# Resolve target userscript and destination page URLs
URLS=()
case "$SCRIPT_OR_ARG" in
  toppreise|tp)
    URLS=(
      "http://127.0.0.1:8765/toppreise/toppreise.user.js"
      "https://www.toppreise.ch/"
    )
    ;;
  huggingface|hf)
    URLS=(
      "http://127.0.0.1:8765/huggingface/huggingface-heart.user.js"
      "https://huggingface.co/models"
    )
    ;;
  perplexity|px)
    URLS=(
      "http://127.0.0.1:8765/perplexity/perplexity-enhancements.user.js"
      "https://www.perplexity.ai/"
    )
    ;;
  http://*|https://*)
    URLS=("$SCRIPT_OR_ARG")
    ;;
  *)
    if [ -n "$SCRIPT_OR_ARG" ]; then
      set -- "$SCRIPT_OR_ARG" "$@"
    fi
    URLS=(
      "http://127.0.0.1:8765/toppreise/toppreise.user.js"
      "https://www.toppreise.ch/"
    )
    ;;
esac

case "$TARGET" in
  chrome|chromium|brave)
    PROFILE_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/userscript-dev-chrome"
    PORT="9222"
    mkdir -p "$PROFILE_DIR"

    # 1. Probe for already-running Chrome session on debug port
    if curl -s -f --max-time 1 "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
      echo "✅ Active Chrome session detected on debug port ${PORT}."
      echo "🔗 Attaching tabs via CDP HTTP API..."
      for u in "${URLS[@]}"; do
        curl -s -X PUT "http://127.0.0.1:${PORT}/json/new?${u}" >/dev/null 2>&1 || true
        echo "   • Opened: $u"
      done
      exit 0
    fi

    # 2. Check if clean profile (no extensions installed yet)
    EXT_DIR="$PROFILE_DIR/Default/Extensions"
    if [ ! -d "$EXT_DIR" ] || [ -z "$(ls -A "$EXT_DIR" 2>/dev/null)" ]; then
      echo "ℹ️ Clean profile detected. Prepending Violentmonkey Web Store install tab..."
      VM_STORE="https://chromewebstore.google.com/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag"
      URLS=("$VM_STORE" "http://127.0.0.1:8765/" "${URLS[@]}")
    fi

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
    for u in "${URLS[@]}"; do
      echo "   • Tab: $u"
    done

    exec "$BIN" \
      --remote-debugging-port="$PORT" \
      --user-data-dir="$PROFILE_DIR" \
      --no-first-run \
      --no-default-browser-check \
      "${URLS[@]}" \
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

    # Check if clean profile
    EXT_DIR="$PROFILE_DIR/extensions"
    if [ ! -d "$EXT_DIR" ] || [ -z "$(ls -A "$EXT_DIR" 2>/dev/null)" ]; then
      echo "ℹ️ Clean profile detected. Prepending Violentmonkey add-on install tab..."
      VM_STORE="https://addons.mozilla.org/firefox/addon/violentmonkey/"
      URLS=("$VM_STORE" "http://127.0.0.1:8765/" "${URLS[@]}")
    fi

    BIN=""
    for candidate in firefox firefox-developer-edition firefox-nightly; do
      if command -v "$candidate" >/dev/null 2>&1; then
        BIN="$candidate"
        break
      fi
    done

    # Clean up stale lock files from abnormal exits
    rm -f "$PROFILE_DIR/parent.lock" "$PROFILE_DIR/lock" "$PROFILE_DIR/.parentlock"

    if [ -z "$BIN" ]; then
      echo "❌ No Firefox executable found on PATH." >&2
      exit 1
    fi

    echo "🚀 Launching $BIN on Marionette/BiDi port $PORT with profile $PROFILE_DIR..."
    echo "🔗 MCP Connection Target: 127.0.0.1:$PORT"
    for u in "${URLS[@]}"; do
      echo "   • Tab: $u"
    done

    exec "$BIN" \
      -new-instance \
      -no-remote \
      --marionette \
      --remote-debugging-port "$PORT" \
      -profile "$PROFILE_DIR" \
      "${URLS[@]}" \
      "$@"
    ;;

  *)
    echo "Usage: $0 [chrome|firefox] [toppreise|huggingface|perplexity] [extra browser flags...]"
    exit 1
    ;;
esac
