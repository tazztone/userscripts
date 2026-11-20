#!/usr/bin/env bash
# Helper script to launch an isolated developer browser instance with remote debugging enabled
# Preserves active daily sessions without profile locking or restart requirements.

set -euo pipefail

# Silence Linux GTK accessibility bridge warnings
export NO_ATK_BRIDGE=1

TARGET="${1:-chrome}"
SCRIPT_OR_ARG="${2:-toppreise}"
if [[ "$SCRIPT_OR_ARG" == --* ]]; then
  SCRIPT_OR_ARG="toppreise"
  shift 1 2>/dev/null || true
else
  shift 2 2>/dev/null || shift 1 2>/dev/null || true
fi

# Extract --install and --clean-profile flags if present
INSTALL_REQUESTED=0
CLEAN_PROFILE_REQUESTED=0
FILTERED_ARGS=()
for arg in "$@"; do
  if [ "$arg" = "--install" ]; then
    INSTALL_REQUESTED=1
  elif [ "$arg" = "--clean-profile" ]; then
    CLEAN_PROFILE_REQUESTED=1
  else
    FILTERED_ARGS+=("$arg")
  fi
done
if [ ${#FILTERED_ARGS[@]} -gt 0 ]; then
  set -- "${FILTERED_ARGS[@]}"
else
  set --
fi

# Environment and port overrides
DEV_PORT="${DEV_SERVER_PORT:-8765}"
DEV_BASE_URL="http://127.0.0.1:${DEV_PORT}"
BIDI_PORT="${FIREFOX_BIDI_PORT:-9222}"
MARIONETTE_PORT="${FIREFOX_MARIONETTE_PORT:-2828}"

# Resolve target destination and dev-loader URLs
SCRIPT_KEY="toppreise"
SITE_URL="https://www.toppreise.ch/"
DEV_STUB_URL="${DEV_BASE_URL}/toppreise/toppreise.dev.user.js"

case "$SCRIPT_OR_ARG" in
  toppreise|tp)
    SCRIPT_KEY="toppreise"
    SITE_URL="https://www.toppreise.ch/"
    DEV_STUB_URL="${DEV_BASE_URL}/toppreise/toppreise.dev.user.js"
    ;;
  huggingface|hf)
    SCRIPT_KEY="huggingface"
    SITE_URL="https://huggingface.co/models"
    DEV_STUB_URL="${DEV_BASE_URL}/huggingface/huggingface.dev.user.js"
    ;;
  perplexity|px)
    SCRIPT_KEY="perplexity"
    SITE_URL="https://www.perplexity.ai/"
    DEV_STUB_URL="${DEV_BASE_URL}/perplexity/perplexity.dev.user.js"
    ;;
  http://*|https://*)
    SCRIPT_KEY="toppreise"
    SITE_URL="$SCRIPT_OR_ARG"
    DEV_STUB_URL=""
    ;;
  *)
    if [ -n "$SCRIPT_OR_ARG" ]; then
      SITE_URL="$SCRIPT_OR_ARG"
    fi
    ;;
esac

SETUP_URL="${DEV_BASE_URL}/setup/${SCRIPT_KEY}"

case "$TARGET" in
  chrome|chromium|brave)
    PROFILE_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/userscript-dev-chrome"
    PORT="9222"

    if [ "$CLEAN_PROFILE_REQUESTED" = "1" ]; then
      if curl -s -f --max-time 1 "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
        echo "❌ Cannot clean profile while an active Chrome session is running. Please close Chrome first." >&2
        exit 1
      fi
      echo "🧹 Cleaning Chrome profile directory $PROFILE_DIR..."
      rm -rf "$PROFILE_DIR"
    fi
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
        ENC_U="$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$u" 2>/dev/null || printf '%s' "$u")"
        if curl -s -f -X PUT "http://127.0.0.1:${PORT}/json/new?${ENC_U}" >/dev/null 2>&1; then
          echo "   • Opened: $u"
        else
          echo "   ⚠️ Failed to open tab via CDP: $u" >&2
        fi
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
    # Detect available Firefox runtime (Native -> Flatpak -> Snap)
    FIREFOX_BIN=""
    FIREFOX_KIND=""

    for candidate in firefox firefox-developer-edition firefox-nightly; do
      if command -v "$candidate" >/dev/null 2>&1; then
        RESOLVED_CANDIDATE="$(command -v "$candidate")"
        # Check if candidate is uninstalled Ubuntu Snap wrapper
        if grep -q "snap/bin/firefox" "$RESOLVED_CANDIDATE" 2>/dev/null; then
          if [ -x "/snap/bin/firefox" ]; then
            FIREFOX_BIN="$RESOLVED_CANDIDATE"
            FIREFOX_KIND="snap"
            break
          else
            # Uninstalled snap stub, skip
            continue
          fi
        else
          FIREFOX_BIN="$RESOLVED_CANDIDATE"
          FIREFOX_KIND="native"
          break
        fi
      fi
    done

    if [ -z "$FIREFOX_BIN" ]; then
      if command -v flatpak >/dev/null 2>&1 && flatpak info org.mozilla.firefox >/dev/null 2>&1; then
        FIREFOX_BIN="flatpak"
        FIREFOX_KIND="flatpak"
      fi
    fi

    if [ -z "$FIREFOX_BIN" ]; then
      echo "❌ No Firefox executable found (native, Flatpak org.mozilla.firefox, or Snap)." >&2
      exit 1
    fi

    # Runtime-matched PROFILE_DIR & SANDBOX_PROFILE_DIR
    case "$FIREFOX_KIND" in
      flatpak)
        PROFILE_DIR="$HOME/.var/app/org.mozilla.firefox/config/mozilla/firefox/userscript-dev-firefox"
        SANDBOX_PROFILE_DIR="$PROFILE_DIR"
        ;;
      snap)
        PROFILE_DIR="$HOME/snap/firefox/common/userscript-dev-firefox"
        SANDBOX_PROFILE_DIR="$PROFILE_DIR"
        ;;
      native)
        if [ -d "$HOME/.mozilla/firefox" ]; then
          PROFILE_DIR="$HOME/.mozilla/firefox/userscript-dev-firefox"
        elif [ -d "${XDG_CONFIG_HOME:-$HOME/.config}/mozilla/firefox" ]; then
          PROFILE_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/mozilla/firefox/userscript-dev-firefox"
        else
          PROFILE_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/userscript-dev-firefox"
        fi
        SANDBOX_PROFILE_DIR="$PROFILE_DIR"
        ;;
    esac

    # Clean up stale Snap debris if using another runtime
    if [ "$FIREFOX_KIND" != "snap" ] && [ -d "$HOME/snap/firefox/common/userscript-dev-firefox" ]; then
      if [ ! -f "$HOME/snap/firefox/common/userscript-dev-firefox/prefs.js" ] && [ ! -d "$HOME/snap/firefox/common/userscript-dev-firefox/extensions" ]; then
        rm -rf "$HOME/snap/firefox/common/userscript-dev-firefox" 2>/dev/null || true
        rmdir "$HOME/snap/firefox/common" 2>/dev/null || true
        rmdir "$HOME/snap/firefox" 2>/dev/null || true
      fi
    fi

    # 1. Probe for Chromium CDP collision on BIDI_PORT
    if curl -s -f --max-time 1 "http://127.0.0.1:${BIDI_PORT}/json/version" >/dev/null 2>&1; then
      echo "❌ Port collision detected on debug port ${BIDI_PORT}: Chromium CDP responded to /json/version." >&2
      echo "   Please close Chrome or run Firefox with a custom BiDi port, e.g.: FIREFOX_BIDI_PORT=9223 npm run dev:firefox:tp" >&2
      exit 1
    fi

    # 2. Probe for running Firefox dev session on BIDI_PORT
    if curl -s -f --max-time 1 "http://127.0.0.1:${BIDI_PORT}/" >/dev/null 2>&1; then
      if [ "$CLEAN_PROFILE_REQUESTED" = "1" ]; then
        echo "❌ Cannot clean profile while an active Firefox session is running. Please close Firefox first." >&2
        exit 1
      fi
      echo "✅ Active Firefox dev session detected on BiDi port ${BIDI_PORT}."
      echo "🔗 Attaching tabs to existing session..."
      ATTACH_URLS=()
      if [ "$INSTALL_REQUESTED" = "1" ] && [ -n "$DEV_STUB_URL" ]; then
        ATTACH_URLS=("$DEV_STUB_URL" "$SITE_URL")
      else
        ATTACH_URLS=("$SITE_URL")
      fi
      if [ "$FIREFOX_KIND" = "flatpak" ]; then
        flatpak run org.mozilla.firefox -profile "$SANDBOX_PROFILE_DIR" "${ATTACH_URLS[@]}" >/dev/null 2>&1 || true
      else
        "$FIREFOX_BIN" -profile "$PROFILE_DIR" "${ATTACH_URLS[@]}" >/dev/null 2>&1 || true
      fi
      for u in "${ATTACH_URLS[@]}"; do
        echo "   • Opened: $u"
      done
      exit 0
    fi

    # Clean profile if requested and no instance is running
    if [ "$CLEAN_PROFILE_REQUESTED" = "1" ]; then
      echo "🧹 Cleaning Firefox profile directory $PROFILE_DIR..."
      rm -rf "$PROFILE_DIR"
    fi
    mkdir -p "$PROFILE_DIR"

    # Clean up stale lock and port files from abnormal exits
    rm -f "$PROFILE_DIR/parent.lock" "$PROFILE_DIR/lock" "$PROFILE_DIR/.parentlock" "$PROFILE_DIR/WebDriverBiDiServer.json" "$PROFILE_DIR/MarionetteActivePort"

    # Minimal user.js with automation and debug invariants only
    cat << EOF > "$PROFILE_DIR/user.js"
user_pref("marionette.enabled", true);
user_pref("marionette.port", ${MARIONETTE_PORT});
user_pref("devtools.debugger.remote-enabled", true);
user_pref("devtools.chrome.enabled", true);
user_pref("devtools.debugger.prompt-connection", false);
user_pref("extensions.autoDisableScopes", 0);
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.aboutConfig.showWarning", false);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("datareporting.policy.firstRunURL", "");
user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);
user_pref("devtools.console.stdout.content", false);
user_pref("dom.report_all_js_exceptions", false);
user_pref("javascript.options.strict", false);
EOF

    # Seed one-time user convenience preferences into prefs.js only if not yet initialized
    if [ ! -f "$PROFILE_DIR/prefs.js" ]; then
      cat << 'EOF' > "$PROFILE_DIR/prefs.js"
user_pref("network.cookie.cookieBehavior", 5);
user_pref("privacy.trackingprotection.enabled", true);
user_pref("privacy.trackingprotection.annotate_channels", false);
user_pref("identity.fxaccounts.enabled", false);
EOF
    fi

    # Zero-click Violentmonkey XPI bootstrap
    mkdir -p "$PROFILE_DIR/extensions"
    VM_ID="{aecec67f-0d10-4fa7-b7c7-609a2db280cf}"
    VM_XPI="$PROFILE_DIR/extensions/${VM_ID}.xpi"
    FRESH_XPI_DOWNLOADED=0

    if [ ! -f "$VM_XPI" ] && [ ! -d "$PROFILE_DIR/extensions/${VM_ID}" ]; then
      echo "ℹ️ Provisioning Violentmonkey XPI..."
      if curl -fsSL --max-time 15 "https://addons.mozilla.org/firefox/downloads/latest/violentmonkey/latest.xpi" -o "${VM_XPI}.tmp" 2>/dev/null; then
        mv "${VM_XPI}.tmp" "$VM_XPI"
        FRESH_XPI_DOWNLOADED=1
        echo "✅ Violentmonkey XPI provisioned."
      else
        rm -f "${VM_XPI}.tmp"
        echo "⚠️ Unable to download Violentmonkey XPI (offline or sandboxed). Falling back to AMO store tab."
      fi
    fi

    VM_STORE="https://addons.mozilla.org/firefox/addon/violentmonkey/"
    VM_PRESENT=0
    if [ -f "$VM_XPI" ] || [ -d "$PROFILE_DIR/extensions/${VM_ID}" ]; then
      VM_PRESENT=1
    fi

    if [ "$VM_PRESENT" = "1" ] && [ "$FRESH_XPI_DOWNLOADED" = "1" ]; then
      URLS=("$SETUP_URL" "$SITE_URL")
    elif [ "$VM_PRESENT" = "0" ]; then
      URLS=("$VM_STORE" "$SETUP_URL" "$SITE_URL")
    elif [ "$INSTALL_REQUESTED" = "1" ] && [ -n "$DEV_STUB_URL" ]; then
      URLS=("$DEV_STUB_URL" "$SITE_URL")
    else
      URLS=("$SITE_URL")
    fi

    echo "🚀 Launching $FIREFOX_KIND Firefox on Marionette (port $MARIONETTE_PORT) & BiDi (port $BIDI_PORT) with profile $PROFILE_DIR..."
    echo "🔗 MCP Connection Target: Marionette 127.0.0.1:$MARIONETTE_PORT | BiDi 127.0.0.1:$BIDI_PORT"
    for u in "${URLS[@]}"; do
      echo "   • Tab: $u"
    done

    FILTER_PATTERNS="googlesyndication\.com|FormHandlerChild\.sys\.mjs|NavigationManager\.sys\.mjs|Promised response from onMessage|atk-bridge"

    if [ "$FIREFOX_KIND" = "flatpak" ]; then
      exec flatpak run --die-with-parent org.mozilla.firefox \
        -new-instance \
        -no-remote \
        --marionette \
        --remote-debugging-port "$BIDI_PORT" \
        -profile "$SANDBOX_PROFILE_DIR" \
        "${URLS[@]}" \
        "$@" 2> >(grep --line-buffered -vE "$FILTER_PATTERNS" >&2)
    else
      exec "$FIREFOX_BIN" \
        -new-instance \
        -no-remote \
        --marionette \
        --remote-debugging-port "$BIDI_PORT" \
        -profile "$PROFILE_DIR" \
        "${URLS[@]}" \
        "$@" 2> >(grep --line-buffered -vE "$FILTER_PATTERNS" >&2)
    fi
    ;;

  *)
    echo "Usage: $0 [chrome|firefox] [toppreise|huggingface|perplexity] [extra browser flags...]"
    exit 1
    ;;
esac
