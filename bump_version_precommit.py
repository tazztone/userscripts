#!/usr/bin/env python3
"""Universal pre-commit hook: Auto-bumps patch versions for any staged userscripts (*.user.js) and syncs their adjacent README.md files."""

import os
import re
import subprocess
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def bump_version_string(match):
    prefix = match.group(1)
    major = match.group(2)
    minor = match.group(3)
    patch = int(match.group(4)) + 1
    new_ver = f"{major}.{minor}.{patch}"
    return f"{prefix}{new_ver}", new_ver


def process_script(script_relpath):
    script_abspath = os.path.join(REPO_ROOT, script_relpath)
    if not os.path.exists(script_abspath):
        return

    # Skip reference or template example scripts
    if 'references' in script_relpath.split(os.sep) or 'example' in os.path.basename(script_relpath):
        return

    with open(script_abspath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Match standard userscript @version (e.g. // @version 1.2.3)
    pattern = r'(//\s*@version\s+)(\d+)\.(\d+)\.(\d+)'
    match = re.search(pattern, content)
    if not match:
        return

    new_content, new_version = re.subn(
        pattern,
        lambda m: f"{m.group(1)}{m.group(2)}.{m.group(3)}.{int(m.group(4)) + 1}",
        content,
        count=1
    )
    extracted_version = f"{match.group(2)}.{match.group(3)}.{int(match.group(4)) + 1}"

    with open(script_abspath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    subprocess.run(['git', 'add', script_abspath], check=True)

    # Sync adjacent README.md in the same directory if it exists
    script_dir = os.path.dirname(script_abspath)
    readme_path = os.path.join(script_dir, 'README.md')
    if os.path.exists(readme_path):
        with open(readme_path, 'r', encoding='utf-8') as f:
            readme_content = f.read()

        new_readme = re.sub(
            r'\(v\d+\.\d+\.\d+\)',
            f'(v{extracted_version})',
            readme_content
        )
        if new_readme != readme_content:
            with open(readme_path, 'w', encoding='utf-8') as f:
                f.write(new_readme)
            subprocess.run(['git', 'add', readme_path], check=True)

    # Sync src/app.js if modular structure exists
    app_path = os.path.join(script_dir, 'src', 'app.js')
    if os.path.exists(app_path):
        with open(app_path, 'r', encoding='utf-8') as f:
            app_content = f.read()
        new_app_content = re.sub(pattern, lambda m: f"{m.group(1)}{extracted_version}", app_content, count=1)
        if new_app_content != app_content:
            with open(app_path, 'w', encoding='utf-8') as f:
                f.write(new_app_content)
            subprocess.run(['git', 'add', app_path], check=True)

    # Sync package.json if it exists
    pkg_path = os.path.join(script_dir, 'package.json')
    if os.path.exists(pkg_path):
        with open(pkg_path, 'r', encoding='utf-8') as f:
            pkg_content = f.read()
        new_pkg_content = re.sub(r'("version"\s*:\s*")\d+\.\d+\.\d+(")', f"\\g<1>{extracted_version}\\g<2>", pkg_content, count=1)
        if new_pkg_content != pkg_content:
            with open(pkg_path, 'w', encoding='utf-8') as f:
                f.write(new_pkg_content)
            subprocess.run(['git', 'add', pkg_path], check=True)

    script_name = os.path.basename(script_relpath)
    print(f"🚀 [pre-commit] Auto-bumped {script_name} to v{extracted_version}")


def check_toppreise_quality_gates(toppreise_dir):
    print("🔍 [pre-commit] Running Toppreise quality gates...")
    try:
        # 1. Build bundle to ensure compiled output matches src/
        subprocess.run(['node', 'tools/build.js'], cwd=toppreise_dir, check=True)
        bundle_path = os.path.join(toppreise_dir, 'toppreise.user.js')
        subprocess.run(['git', 'add', bundle_path], check=True)

        # 2. Check drift gate
        subprocess.run(['node', 'tools/build.js', '--check'], cwd=toppreise_dir, check=True)

        # 3. Fast unit tests (<100ms)
        unit_test_files = [
            'tests/unit/price.test.js',
            'tests/unit/deal-score.test.js',
            'tests/unit/cache.test.js',
            'tests/unit/selectors.test.js',
            'tests/unit/store.test.js',
            'tests/unit/adapter.test.js',
            'tests/unit/sparkline.test.js'
        ]
        subprocess.run(['node', '--test'] + unit_test_files, cwd=toppreise_dir, check=True)

        # 4. Fast category taxonomy gate (~30ms)
        subprocess.run(['python3', 'tools/verify_category_map.py'], cwd=toppreise_dir, check=True)

        print("✅ [pre-commit] All Toppreise quality gates passed successfully!")
    except subprocess.CalledProcessError as e:
        print(f"❌ [pre-commit] Quality gate failed (exit code {e.returncode})")
        return False
    return True


def main():
    try:
        staged_files = subprocess.check_output(
            ['git', 'diff', '--cached', '--name-only'],
            text=True
        ).splitlines()
    except subprocess.CalledProcessError:
        return 0

    staged_userscripts = [
        path for path in staged_files
        if path.endswith('.user.js') and path.startswith('userscripts/')
    ]

    # If any file in userscripts/toppreise/ is staged, run quality gates
    toppreise_staged = any(path.startswith('userscripts/toppreise/') for path in staged_files)
    if toppreise_staged:
        toppreise_dir = os.path.join(REPO_ROOT, 'userscripts', 'toppreise')
        if not check_toppreise_quality_gates(toppreise_dir):
            return 1

    for script_path in staged_userscripts:
        process_script(script_path)

    return 0


if __name__ == '__main__':
    sys.exit(main())

