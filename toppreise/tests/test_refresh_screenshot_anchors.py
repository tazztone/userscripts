"""Tests for screenshot callout anchor resolution, collision relaxation, and geometry invariants."""

import importlib.util
import math
import os
import pytest
from PIL import Image
import io

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
TOOLS_DIR = os.path.join(os.path.dirname(TESTS_DIR), "tools")
RS_PATH = os.path.join(TOOLS_DIR, "refresh-screenshot.py")

spec = importlib.util.spec_from_file_location("refresh_screenshot", RS_PATH)
rs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rs)


def create_dummy_png_bytes(width=800, height=600):
    """Generate dummy PNG bytes with designated dimensions."""
    img = Image.new("RGB", (round(width * rs.DSF), round(height * rs.DSF)), color=(15, 23, 42))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_compute_callout_target_card_perimeter():
    origin = {"x": 0, "y": 0}
    box = {"x": 100, "y": 100, "width": 200, "height": 50}

    # Left approach
    tx, ty = rs.compute_callout_target(box, origin, bx=40, by=125)
    assert tx == 102.0
    assert ty == 125.0

    # Right approach
    tx, ty = rs.compute_callout_target(box, origin, bx=350, by=125)
    assert tx == 298.0
    assert ty == 125.0

    # Top approach
    tx, ty = rs.compute_callout_target(box, origin, bx=200, by=50)
    assert tx == 200.0
    assert ty == 102.0

    # Bottom approach
    tx, ty = rs.compute_callout_target(box, origin, bx=200, by=200)
    assert tx == 200.0
    assert ty == 148.0


def test_compute_callout_target_small_icon_centered():
    origin = {"x": 0, "y": 0}
    icon_box = {"x": 50, "y": 50, "width": 24, "height": 24}

    tx, ty = rs.compute_callout_target(icon_box, origin, bx=10, by=20)
    assert tx == 62.0
    assert ty == 62.0


def test_relax_badge_positions_separates_column():
    badges = [
        {"num": 1, "bx": 36.0, "by": 200.0},
        {"num": 2, "bx": 36.0, "by": 215.0},
        {"num": 3, "bx": 36.0, "by": 230.0},
    ]
    relaxed = rs.relax_badge_positions(badges, css_w=500, css_h=800, min_dist=28.0)
    for i in range(len(relaxed) - 1):
        dist = math.hypot(relaxed[i + 1]["bx"] - relaxed[i]["bx"], relaxed[i + 1]["by"] - relaxed[i]["by"])
        assert dist >= 27.5


def test_relax_badge_positions_clamps_boundaries():
    badges = [
        {"num": 1, "bx": 10.0, "by": 10.0},
        {"num": 2, "bx": 12.0, "by": 12.0},
    ]
    relaxed = rs.relax_badge_positions(badges, css_w=200, css_h=200, min_dist=28.0)
    for b in relaxed:
        assert b["bx"] >= 16.0
        assert b["by"] >= 16.0


def test_solve_callouts_asserts_on_uncorrectable_overlap():
    raw_bytes = create_dummy_png_bytes(width=200, height=200)
    origin = {"x": 0, "y": 0}
    # Place 15 badges in a tiny 30x30 region where min_dist=28 cannot be satisfied
    callouts = [
        (i + 1, {"x": 50, "y": 50, "width": 20, "height": 20}, f"Item {i}", {"bx": 50, "by": 50})
        for i in range(15)
    ]
    with pytest.raises(AssertionError, match="Badge overlap"):
        rs.solve_callouts(raw_bytes, origin, callouts, out_file="test_overflow.webp")


def test_solve_callouts_asserts_on_runaway_line():
    raw_bytes = create_dummy_png_bytes(width=1000, height=800)
    origin = {"x": 0, "y": 0}
    callouts = [
        (1, {"x": 50, "y": 50, "width": 20, "height": 20}, "Runaway", {"bx": 600, "by": 50})
    ]
    with pytest.raises(AssertionError, match="runaway length"):
        rs.solve_callouts(raw_bytes, origin, callouts, out_file="test_runaway.webp")


def test_solve_callouts_clean_success():
    raw_bytes = create_dummy_png_bytes(width=600, height=400)
    origin = {"x": 0, "y": 0}
    callouts = [
        (1, {"x": 100, "y": 80, "width": 120, "height": 30}, "Title", "outside-left"),
        (2, {"x": 300, "y": 80, "width": 120, "height": 30}, "Button", "outside-top"),
        (3, {"x": 100, "y": 200, "width": 120, "height": 30}, "Card", "outside-bottom"),
        (4, {"x": 300, "y": 200, "width": 120, "height": 30}, "Badge", "outside-right"),
    ]
    css_w, css_h, placements = rs.solve_callouts(raw_bytes, origin, callouts, out_file="test_clean.webp")
    assert len(placements) == 4
    for p in placements:
        assert 6.0 <= p["dist"] <= 260.0
