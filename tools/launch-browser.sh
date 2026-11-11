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

    # 2. Auto-seed extensions from default Chrome profile if available
    SRC_CHROME_EXT="${XDG_CONFIG_HOME:-$HOME/.config}/google-chrome/Default/Extensions"
    if [ -d "$SRC_CHROME_EXT" ] && [ ! -d "$PROFILE_DIR/Default/Extensions" ]; then
      echo "🔄 Syncing Chrome extensions from default profile..."
      mkdir -p "$PROFILE_DIR/Default"
      cp -rn "$SRC_CHROME_EXT" "$PROFILE_DIR/Default/" 2>/dev/null || true
    fi

    # 3. Check if clean profile (no extensions installed yet)
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

    # Write user prefs for automated Marionette/BiDi support
    cat << 'EOF' > "$PROFILE_DIR/user.js"
user_pref("marionette.enabled", true);
user_pref("marionette.port", 2828);
user_pref("devtools.debugger.remote-enabled", true);
user_pref("devtools.chrome.enabled", true);
EOF

    # Auto-seed extensions from user's default Firefox profile if available
    PROFILES_INI=""
    FIREFOX_BASE=""
    if [ -f "$HOME/snap/firefox/common/.mozilla/firefox/profiles.ini" ]; then
      PROFILES_INI="$HOME/snap/firefox/common/.mozilla/firefox/profiles.ini"
      FIREFOX_BASE="$HOME/snap/firefox/common/.mozilla/firefox"
    elif [ -f "$HOME/.mozilla/firefox/profiles.ini" ]; then
      PROFILES_INI="$HOME/.mozilla/firefox/profiles.ini"
      FIREFOX_BASE="$HOME/.mozilla/firefox"
    fi

    if [ -n "$PROFILES_INI" ]; then
      DEF_PATH=$(awk -F= '
        /^\[Profile/ { in_p=1; p=""; d=0 }
        in_p && /^Path=/ { p=$2 }
        in_p && /^Default=1/ { d=1 }
        in_p && /^$/ { if (d && p != "") { print p; exit } in_p=0 }
        END { if (d && p != "") print p }
      ' "$PROFILES_INI" | head -n1)

      if [ -z "$DEF_PATH" ]; then
        DEF_PATH=$(grep -m1 '^Path=' "$PROFILES_INI" | cut -d= -f2)
      fi

      SRC_PROFILE="$FIREFOX_BASE/$DEF_PATH"
      if [ -d "$SRC_PROFILE" ] && [ "$SRC_PROFILE" != "$PROFILE_DIR" ]; then
        if [ -d "$SRC_PROFILE/extensions" ]; then
          mkdir -p "$PROFILE_DIR/extensions"
          for xpi in "$SRC_PROFILE/extensions/"*.xpi; do
            if [ -f "$xpi" ]; then
              dest_xpi="$PROFILE_DIR/extensions/$(basename "$xpi")"
              if [ ! -f "$dest_xpi" ]; then
                cp "$xpi" "$dest_xpi" 2>/dev/null || true
                echo "   📦 Synced addon: $(basename "$xpi")"
              fi
            fi
          done

          if [ -f "$SRC_PROFILE/extensions.json" ] && [ ! -f "$PROFILE_DIR/extensions.json" ]; then
            sed "s|${SRC_PROFILE}|${PROFILE_DIR}|g" "$SRC_PROFILE/extensions.json" > "$PROFILE_DIR/extensions.json" 2>/dev/null || true
          fi

          for cfg in extension-preferences.json extension-settings.json; do
            if [ -f "$SRC_PROFILE/$cfg" ] && [ ! -f "$PROFILE_DIR/$cfg" ]; then
              cp "$SRC_PROFILE/$cfg" "$PROFILE_DIR/$cfg" 2>/dev/null || true
            fi
          done

          # Sync extension storage (Violentmonkey scripts, settings) if not present
          if [ -d "$SRC_PROFILE/storage/default" ] && [ ! -d "$PROFILE_DIR/storage/default" ]; then
            mkdir -p "$PROFILE_DIR/storage/default"
            cp -rn "$SRC_PROFILE/storage/default/moz-extension+++"* "$PROFILE_DIR/storage/default/" 2>/dev/null || true
          fi
        fi
      fi
    fi

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
