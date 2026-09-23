"""
Fast Pure Unit Test Runner for Toppreise Domain & Infrastructure Modules.
Executes the native Node.js unit tests in <100ms without Playwright browser launch overhead.
"""

import os
import subprocess
import pytest

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
TOPPREISE_DIR = os.path.dirname(TESTS_DIR)
UNIT_TESTS_DIR = os.path.join(TESTS_DIR, "unit")


@pytest.mark.parametrize("test_file", [
    "price.test.js",
    "deal-score.test.js",
    "cache.test.js",
    "selectors.test.js"
])
def test_node_unit_suite(test_file):
    test_path = os.path.join(UNIT_TESTS_DIR, test_file)
    assert os.path.exists(test_path), f"Unit test file not found: {test_path}"

    result = subprocess.run(
        ["node", "--test", test_path],
        cwd=TOPPREISE_DIR,
        capture_output=True,
        text=True
    )

    assert result.returncode == 0, f"Node unit test failure in {test_file}:\n{result.stdout}\n{result.stderr}"
