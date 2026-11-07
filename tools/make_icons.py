"""Generate web/icons/*.png by rendering tools/icons.html in headless Chromium.

Run: uv run --with playwright python tools/make_icons.py
"""
import base64
import functools
import http.server
import os
import socket
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


def main():
    port = free_port()
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=CHROME)
            page = browser.new_page()
            page.goto(f"http://127.0.0.1:{port}/tools/icons.html")
            page.wait_for_function("window.icons")
            icons = page.evaluate("window.icons")
            out = ROOT / "web" / "icons"
            out.mkdir(parents=True, exist_ok=True)
            for name, url in icons.items():
                (out / name).write_bytes(base64.b64decode(url.split(",", 1)[1]))
                print("wrote", out / name)
            browser.close()
    finally:
        httpd.shutdown()


if __name__ == "__main__":
    main()
