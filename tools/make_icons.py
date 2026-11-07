"""Generate web/icons/*.png by rendering tools/icons.html in headless Chromium.
With --native it also writes the Android launcher icons and splash screens, the iOS app icon
and launch images, and the 512 px Play Store icon. Store and iOS icons may not have an alpha
channel, so those are flattened to RGB with Pillow.

Run: uv run --with playwright --with pillow python tools/make_icons.py [--native]
"""
import base64
import functools
import http.server
import os
import socket
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
CHROME = os.environ.get(
    "CHROME",
    "/home/agent/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell",
)


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def flatten(path):
    from PIL import Image

    img = Image.open(path)
    if img.mode != "RGB":
        img.convert("RGB").save(path, optimize=True)


def main():
    port = free_port()
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=CHROME)
            page = browser.new_page()
            native = "--native" in sys.argv
            page.goto(f"http://127.0.0.1:{port}/tools/icons.html" + ("?native" if native else ""))
            page.wait_for_function("window.icons")
            icons = {f"web/icons/{k}": v for k, v in page.evaluate("window.icons").items()}
            if native:
                icons.update(page.evaluate("window.nativeIcons"))
            for name, url in icons.items():
                path = ROOT / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(base64.b64decode(url.split(",", 1)[1]))
                if name.startswith(("ios/", "store/")):
                    flatten(path)
                print("wrote", name)
            browser.close()
    finally:
        httpd.shutdown()


if __name__ == "__main__":
    main()
