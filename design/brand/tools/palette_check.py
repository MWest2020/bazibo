#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Measure the three round-2 palettes against the delivery gates.

Prints every pair design-check measures (WCAG 2.2 1.4.3/1.4.11): text 4.5:1 on
its background, group accents 3:1 on the base, group text 4.5:1 on its tint.
Run from the repository root: python3 design/brand/tools/palette_check.py
"""
import sys

sys.path.insert(0, "/opt/habitat/design")
import gates  # noqa: E402

PAL = {
    "A-knipsel (Kraft)": {
        "base": "#f7f1e6", "ink": "#2c3a2e", "ink-soft": "#55604f",
        "brand": "#b4532f", "on-brand": "#fffaf2",
        "groups": {
            "puzzles": ("#2f8268", "#dfeee7", "#1f6350"),
            "board": ("#b4532f", "#f8e5da", "#8e3f22"),
            "creative": ("#a2457e", "#f7e3ee", "#86355f"),
            "learning": ("#8a6a10", "#f4ebd3", "#6b520a"),
            "action": ("#3f6fb0", "#e3ebf7", "#2f558b"),
        },
    },
    "B-kralen (Papier)": {
        "base": "#fbf7f0", "ink": "#28245c", "ink-soft": "#5a5585",
        "brand": "#4f43c4", "on-brand": "#ffffff",
        "groups": {
            "puzzles": ("#2a8f88", "#e2f1ef", "#1d6b66"),
            "board": ("#d9663f", "#fbe8de", "#9d4524"),
            "creative": ("#c8508a", "#fae4ef", "#993963"),
            "learning": ("#b97f0a", "#f7edd4", "#7d5606"),
            "action": ("#3f86d0", "#e4eefa", "#2a5f94"),
        },
    },
    "C-mees (Polder)": {
        "base": "#f2f5f4", "ink": "#1f2e3d", "ink-soft": "#4c5d6b",
        "brand": "#2f6b5e", "on-brand": "#ffffff",
        "groups": {
            "puzzles": ("#2f7d6d", "#dcebe7", "#1f5e51"),
            "board": ("#c4573a", "#f7e4de", "#95401f"),
            "creative": ("#a8457e", "#f6e2ec", "#8b3566"),
            "learning": ("#a8790e", "#f4ecd6", "#775408"),
            "action": ("#2f6fc0", "#e1eaf8", "#27588f"),
        },
    },
}


def main():
    bad = 0
    for name, p in PAL.items():
        print("==", name)
        for fg, bg, need in (("ink", "base", 4.5), ("ink-soft", "base", 4.5),
                             ("on-brand", "brand", 4.5)):
            r = gates.contrast(p[fg], p[bg])
            bad += r < need
            print(f"  {'ok ' if r >= need else 'BAD'} {fg}/{bg} {r:.2f} (need {need})")
        for g, (acc, tint, text) in p["groups"].items():
            r1, r2 = gates.contrast(acc, p["base"]), gates.contrast(text, tint)
            bad += (r1 < 3) + (r2 < 4.5)
            print(f"  {'ok ' if r1 >= 3 else 'BAD'} {g:9s} accent/base {r1:.2f}   "
                  f"{'ok ' if r2 >= 4.5 else 'BAD'} text/tint {r2:.2f}")
    print("findings:", bad)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
