# Userscript Development Workflow

Vocabulary for the live MCP browser bridge and agentic userscript development loop.

## Language

**Live Session**:
An active, authenticated browser window operated by the developer whose state, tabs, and cookies remain live during development.
_Avoid_: Headless browser, test fixture browser

**Session Bridge**:
An MCP server attached to an existing browser process that exposes live page querying, console streams, and navigation controls to the coding agent.
_Avoid_: Browser automation script, scraper

**Sync Daemon**:
A local background process combining an incremental source bundler, file watcher, and HTTP server to serve fresh userscript artifacts without caching.
_Avoid_: Static web server, build runner

**External Edit Tracking**:
A userscript manager mechanism (e.g. in Violentmonkey) that polls or monitors an HTTP or file source and updates the installed script in the background upon file changes.
_Avoid_: Script reinstallation, manual import

**Dev Loader**:
A minimal userscript stub installed once in the manager that dynamically fetches and evaluates the latest local build via privileged background requests.
_Avoid_: Script wrapper, iframe injector

**Diagnostic Snapshot**:
A structured, read-only state summary published by a userscript into the DOM or window object for agent inspection without accessing the extension closure.
_Avoid_: Global debug dump, monkey-patch

**Provenance Tag**:
A consistent console log prefix identifying messages originating from the userscript rather than third-party host site scripts.
_Avoid_: Log category, script header
