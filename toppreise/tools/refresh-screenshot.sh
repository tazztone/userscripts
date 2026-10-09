#!/usr/bin/env bash
# Retry the hero screenshot capture. Fails nonzero with Screenshot.webp
# untouched when the site bot-walls this network.
set -e
cd "$(dirname "$0")/../.."
node toppreise/tools/build.js
PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/home/tazztone/_coding/userscripts/.playwright-browsers}" venv/bin/python toppreise/tools/refresh-screenshot.py
git status --short
