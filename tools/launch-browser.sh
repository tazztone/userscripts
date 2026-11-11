#!/usr/bin/env bash
# Helper script to launch an isolated developer browser instance with remote debugging enabled
# Preserves active daily sessions without profile locking or restart requirements.

set -euo pipefail

TARGET="${1:-chrome}"
SCRIPT_OR_ARG="${2:-toppreise}"
shift 2 2>/dev/null || shift 1 2>/dev/null || true

# Extract --install flag if present
INSTALL_REQUESTED=0
FILTERED_ARGS=()
for arg in "$@"; do
  if [ "$arg" = "--install" ]; then
    INSTALL_REQUESTED=1
  else
    FILTERED_ARGS+=("$arg")
  fi
done
if [ ${#FILTERED_ARGS[@]} -gt 0 ]; then
  set -- "${FILTERED_ARGS[@]}"
else
  set --
fi

# Resolve target destination and dev-loader URLs
SITE_URL="https://www.toppreise.ch/"
DEV_STUB_URL="http://127.0.0.1:8765/toppreise/toppreise.dev.user.js"

case "$SCRIPT_OR_ARG" in
  toppreise|tp)
    SITE_URL="https://www.toppreise.ch/"
    DEV_STUB_URL="http://127.0.0.1:8765/toppreise/toppreise.dev.user.js"
    ;;
  huggingface|hf)
    SITE_URL="https://huggingface.co/models"
    DEV_STUB_URL="http://127.0.0.1:8765/huggingface/huggingface.dev.user.js"
    ;;
  perplexity|px)
    SITE_URL="https://www.perplexity.ai/"
    DEV_STUB_URL="http://127.0.0.1:8765/perplexity/perplexity.dev.user.js"
    ;;
  http://*|https://*)
    SITE_URL="$SCRIPT_OR_ARG"
    DEV_STUB_URL=""
    ;;
  *)
    if [ -n "$SCRIPT_OR_ARG" ]; then
      SITE_URL="$SCRIPT_OR_ARG"
    fi
    ;;
esac

case "$TARGET" in
  chrome|chromium|brave)
    PROFILE_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/userscript-dev-chrome"
    PORT="9222"
    mkdir -p "$PROFILE_DIR"

    # Assemble tabs: clean profiles or --install get the stub; standard runs open only the target site
    EXT_DIR="$PROFILE_DIR/Default/Extensions"
    if [ ! -d "$EXT_DIR" ] || [ -z "$(ls -A "$EXT_DIR" 2>/dev/null)" ]; then
      echo "ℹ️ Clean profile detected. Prepending Violentmonkey Web Store install tab..."
      VM_STORE="https://chromewebstore.google.com/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag"
      URLS=("$VM_STORE")
      [ -n "$DEV_STUB_URL" ] && URLS+=("$DEV_STUB_URL")
      URLS+=("$SITE_URL")
    elif [ "$INSTALL_REQUESTED" = "1" ] && [ -n "$DEV_STUB_URL" ]; then
      URLS=("$DEV_STUB_URL" "$SITE_URL")
    else
      URLS=("$SITE_URL")
    fi

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
    # Ubuntu Snap confinement blocks access to ~/.config/userscript-dev-firefox.
    # Snap Firefox has full AppArmor permissions inside ~/snap/firefox/common/.
    if grep -q "snap/bin/firefox" /usr/bin/firefox 2>/dev/null || [ -d "$HOME/snap/firefox" ]; then
      PROFILE_DIR="$HOME/snap/firefox/common/userscript-dev-firefox"
    elif [ -d "$HOME/.mozilla/firefox" ]; then
      PROFILE_DIR="$HOME/.mozilla/firefox/userscript-dev-firefox"
    else
      PROFILE_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/userscript-dev-firefox"
    fi
    PORT="2828"
    mkdir -p "$PROFILE_DIR"

    # Write user prefs for automated Marionette/BiDi support and quiet dev logs
    cat << 'EOF' > "$PROFILE_DIR/user.js"
user_pref("marionette.enabled", true);
user_pref("marionette.port", 2828);
user_pref("devtools.debugger.remote-enabled", true);
user_pref("devtools.chrome.enabled", true);
user_pref("signon.autofillForms", false);
user_pref("browser.formfill.enable", false);
user_pref("extensions.formautofill.addresses.enabled", false);
user_pref("extensions.formautofill.creditCards.enabled", false);
user_pref("identity.fxaccounts.enabled", false);
EOF

    # Assemble tabs: clean profiles or --install get the stub; standard runs open only the target site
    EXT_DIR="$PROFILE_DIR/extensions"
    if [ ! -d "$EXT_DIR" ] || [ -z "$(ls -A "$EXT_DIR" 2>/dev/null)" ]; then
      echo "ℹ️ Clean profile detected. Prepending Violentmonkey add-on install tab..."
      VM_STORE="https://addons.mozilla.org/firefox/addon/violentmonkey/"
      URLS=("$VM_STORE")
      [ -n "$DEV_STUB_URL" ] && URLS+=("$DEV_STUB_URL")
      URLS+=("$SITE_URL")
    elif [ "$INSTALL_REQUESTED" = "1" ] && [ -n "$DEV_STUB_URL" ]; then
      URLS=("$DEV_STUB_URL" "$SITE_URL")
    else
      URLS=("$SITE_URL")
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

    echo "🚀 Launching $BIN on Marionette (port 2828) & BiDi (port 9222) with profile $PROFILE_DIR..."
    echo "🔗 MCP Connection Target: Marionette 127.0.0.1:2828 | BiDi 127.0.0.1:9222"
    for u in "${URLS[@]}"; do
      echo "   • Tab: $u"
    done

    exec "$BIN" \
      -new-instance \
      -no-remote \
      --marionette \
      --remote-debugging-port 9222 \
      -profile "$PROFILE_DIR" \
      "${URLS[@]}" \
      "$@"
    ;;

  *)
    echo "Usage: $0 [chrome|firefox] [toppreise|huggingface|perplexity] [extra browser flags...]"
    exit 1
    ;;
esac
