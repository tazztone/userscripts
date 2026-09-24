import os
from pathlib import Path


# Keep the large, machine-specific Playwright browser download local to this
# repository while leaving it ignored by git when present locally.
local_browsers = Path(__file__).resolve().parents[2] / '.playwright-browsers'
if local_browsers.is_dir():
    os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', str(local_browsers))

