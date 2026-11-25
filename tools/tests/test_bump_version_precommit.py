import os
import sys
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import bump_version_precommit as bvp


def test_process_script_ignores_site_demo_posix_path(tmp_path):
    demo_dir = tmp_path / "toppreise" / "site" / "demo"
    demo_dir.mkdir(parents=True)
    demo_script = demo_dir / "toppreise.user.js"
    original = "// @version 1.0.0\n"
    demo_script.write_text(original, encoding="utf-8")

    with patch.object(bvp, "REPO_ROOT", str(tmp_path)):
        bvp.process_script("toppreise/site/demo/toppreise.user.js")

    assert demo_script.read_text(encoding="utf-8") == original


def test_process_script_updates_readme_once_only(tmp_path):
    script_dir = tmp_path / "myscript"
    script_dir.mkdir()
    script_file = script_dir / "myscript.user.js"
    script_file.write_text("// @version 1.2.3\n", encoding="utf-8")
    readme_file = script_dir / "README.md"
    readme_file.write_text(
        "# My Script (v1.2.3)\n\nChangelog:\n- Initial release (v1.0.0)\n",
        encoding="utf-8",
    )

    with patch.object(bvp, "REPO_ROOT", str(tmp_path)), \
         patch("bump_version_precommit.subprocess.run") as mock_run:
        bvp.process_script("myscript/myscript.user.js")

    assert "// @version 1.2.4" in script_file.read_text(encoding="utf-8")
    readme_text = readme_file.read_text(encoding="utf-8")
    assert "# My Script (v1.2.4)" in readme_text
    assert "(v1.0.0)" in readme_text
    assert mock_run.called


def test_process_script_updates_readme_de_alongside_en(tmp_path):
    script_dir = tmp_path / "myscript"
    script_dir.mkdir()
    script_file = script_dir / "myscript.user.js"
    script_file.write_text("// @version 1.2.3\n", encoding="utf-8")
    readme_en = script_dir / "README.md"
    readme_en.write_text(
        "# My Script (v1.2.3)\n\nChangelog:\n- Initial release (v1.0.0)\n",
        encoding="utf-8",
    )
    readme_de = script_dir / "README.de.md"
    readme_de.write_text(
        "# Mein Skript (v1.2.3)\n\nVerlauf:\n- Erstrelease (v1.0.0)\n",
        encoding="utf-8",
    )

    with patch.object(bvp, "REPO_ROOT", str(tmp_path)), \
         patch("bump_version_precommit.subprocess.run") as mock_run:
        bvp.process_script("myscript/myscript.user.js")

    assert "// @version 1.2.4" in script_file.read_text(encoding="utf-8")
    for p in (readme_en, readme_de):
        text = p.read_text(encoding="utf-8")
        assert "(v1.2.4)" in text
        assert "(v1.0.0)" in text
        mock_run.assert_any_call(["git", "add", str(p)], check=True)


def test_process_script_deleted_file_is_noop(tmp_path):
    with patch.object(bvp, "REPO_ROOT", str(tmp_path)):
        bvp.process_script("missing/script.user.js")
