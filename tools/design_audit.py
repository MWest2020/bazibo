"""Design audit: screenshots and measurements of the shell and every game's first screen, for
docs/design/style-audit.md. Read-only: it changes nothing in web/ and sends nothing anywhere.

Run: uv run --with playwright --with pillow python tools/design_audit.py

Writes the full-size screenshots and audit.json to shots/design/ (gitignored) and one small contact
sheet per size to docs/design/shots/. Measured from the real DOM: every visible touch target (its
size on screen), the contrast of every visible text against the pixels around it, font sizes,
button styles and how much of the screen is a canvas (which the DOM cannot see into).
"""
import functools
import http.server
import json
import math
import os
import socket
import sys
import threading
from collections import Counter
from pathlib import Path

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "shots" / "design"
SHEETS = ROOT / "docs" / "design" / "shots"
CHROME = os.environ.get(
    "CHROME",
    "/home/agent/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell",
)
SIZES = {"320": (320, 568), "360": (360, 740), "tablet": (800, 1280)}
THUMB = {"320": 0.5, "360": 0.5, "tablet": 0.25}

# a stand-in store plugin (nothing owned), so the in-app offer and its parental gate can be seen
STORE_APP = """
window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: {} };
window.CdvPurchase = { LogLevel: {WARNING: 1}, Platform: {GOOGLE_PLAY: 'gp', APPLE_APPSTORE: 'as'},
  ProductType: {NON_CONSUMABLE: 'nc'}, ErrorCode: {PAYMENT_CANCELLED: 1},
  store: { verbosity: 0, register() {}, when() { const o = { approved: () => o, finished: () => o, receiptUpdated: () => o }; return o; },
    initialize: async () => [], owned: () => false, get: () => ({ pricing: { price: '€ 1,00' }, getOffer: () => ({}) }),
    order: async () => null, restorePurchases: async () => null } };
"""

MEASURE = r"""
() => {
  const vw = innerWidth, vh = innerHeight;
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom <= 0 || r.right <= 0 || r.top >= vh || r.left >= vw) return null;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity === 0) return null;
    return r;
  };
  const on_top = (el, r) => {
    const x = Math.min(vw - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(vh - 1, Math.max(0, r.top + r.height / 2));
    const hit = document.elementFromPoint(x, y);
    return hit && (hit === el || el.contains(hit) || hit.contains(el));
  };
  const label = (el) => (el.getAttribute('aria-label') || el.textContent || el.id || el.className || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
  const targets = [];
  for (const el of document.querySelectorAll('button, a[href], input, select, textarea, [role=button], [tabindex]:not([tabindex="-1"])')) {
    const r = vis(el);
    if (!r || !on_top(el, r)) continue;
    const cs = getComputedStyle(el);
    targets.push({ label: label(el), cls: String(el.className).slice(0, 40), w: Math.round(r.width), h: Math.round(r.height),
      radius: cs.borderRadius, bg: cs.backgroundColor, color: cs.color, font: cs.fontSize, weight: cs.fontWeight,
      shadow: cs.boxShadow !== 'none' });
  }
  const texts = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest('svg, script, style, [hidden]')) continue;
    if (!vis(el)) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const r = range.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.top >= vh || r.bottom <= 0) continue;
    const x = Math.min(vw - 1, r.left + r.width / 2), y = Math.min(vh - 1, Math.max(0, r.top + r.height / 2));
    const hit = document.elementFromPoint(x, y);
    if (!hit || !(hit === el || el.contains(hit) || hit.contains(el))) continue;
    const cs = getComputedStyle(el);
    texts.push({ text: n.textContent.trim().replace(/\s+/g, ' ').slice(0, 40), x: r.left, y: r.top, w: r.width, h: r.height,
      color: cs.color, size: parseFloat(cs.fontSize), weight: +cs.fontWeight, family: cs.fontFamily.split(',')[0] });
  }
  let canvas = 0;
  for (const c of document.querySelectorAll('canvas')) {
    const r = vis(c);
    if (r && on_top(c, r)) canvas += Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
  }
  const bar = document.querySelector('.screen.active .bar h2, .screen.active header h2');
  const barCs = bar && getComputedStyle(bar);
  const sx = document.documentElement.scrollWidth > vw + 1;
  return { targets, texts, canvasShare: +(canvas / (vw * vh)).toFixed(2), sideways: sx,
    heading: bar ? { text: bar.textContent.trim().slice(0, 40), size: barCs.fontSize, weight: barCs.fontWeight, color: barCs.color } : null };
}
"""


def parse_rgba(s):
    nums = [float(v) for v in s[s.index("(") + 1 : s.index(")")].replace("/", ",").split(",") if v.strip()]
    return (nums + [1.0])[:4]


def lum(rgb):
    def ch(c):
        c = c / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = rgb[:3]
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def ratio(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def ring_colour(img, t):
    """The most common colour in a 3 px ring around a text box: the background the text sits on."""
    W, H = img.size
    x0, y0, x1, y1 = int(t["x"]) - 3, int(t["y"]) - 3, int(t["x"] + t["w"]) + 3, int(t["y"] + t["h"]) + 3
    pts = []
    for x in range(max(0, x0), min(W, x1)):
        for y in (y0, y1):
            if 0 <= y < H:
                pts.append(img.getpixel((x, y)))
    for y in range(max(0, y0), min(H, y1)):
        for x in (x0, x1):
            if 0 <= x < W:
                pts.append(img.getpixel((x, y)))
    if not pts:
        return None
    q = Counter((p[0] // 4 * 4, p[1] // 4 * 4, p[2] // 4 * 4) for p in pts)
    return q.most_common(1)[0][0]


def contrast(path, texts):
    img = Image.open(path).convert("RGB")
    out = []
    for t in texts:
        bg = ring_colour(img, t)
        if bg is None:
            continue
        r, g, b, a = parse_rgba(t["color"])
        fg = tuple(round(a * c + (1 - a) * k) for c, k in zip((r, g, b), bg))
        large = t["size"] >= 24 or (t["size"] >= 18.66 and t["weight"] >= 700)
        cr = ratio(fg, bg)
        out.append({**{k: t[k] for k in ("text", "size", "weight", "family")}, "fg": "#%02x%02x%02x" % fg,
                    "bg": "#%02x%02x%02x" % bg, "ratio": round(cr, 2), "large": large, "pass": cr >= (3 if large else 4.5)})
    return out


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def handle(self):
        try:
            super().handle()
        except (BrokenPipeError, ConnectionResetError):
            pass


def serve():
    port = socket.socket()
    port.bind(("127.0.0.1", 0))
    p = port.getsockname()[1]
    port.close()
    handler = functools.partial(Quiet, directory=str(ROOT / "web"))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", p), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{p}"


def games():
    src = (ROOT / "web" / "js" / "games.js").read_text()
    body = src[src.index("export const GAMES") :]
    return [line.split("...")[1].split(",")[0] for line in body.splitlines() if "..." in line]


def new_page(browser, base, size, app=False):
    w, h = SIZES[size]
    ctx = browser.new_context(bypass_csp=True, viewport={"width": w, "height": h}, device_scale_factor=1,
                              is_mobile=True, has_touch=True, locale="nl-NL")
    ctx.add_init_script("localStorage.setItem('bubbels.settings.v1', JSON.stringify({muted: true, lang: 'nl'}))")
    if app:
        ctx.add_init_script(STORE_APP)
    page = ctx.new_page()
    foreign = []
    page.on("request", lambda r: not r.url.startswith(base) and not r.url.startswith("data:") and foreign.append(r.url))
    page.goto(base + "/index.html")
    page.wait_for_selector("html[data-ready='1']")
    page.wait_for_timeout(500)
    return ctx, page, foreign


def capture(page, size, name, results):
    path = OUT / size / f"{name}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(path))
    m = page.evaluate(MEASURE)
    m["contrast"] = contrast(path, m.pop("texts"))
    results[size][name] = m
    return path


def fonts(page):
    """The font Chromium really drew the brand name and a tile name with (CDP), not the CSS wish list."""
    cdp = page.context.new_cdp_session(page)
    cdp.send("DOM.enable")
    cdp.send("CSS.enable")
    root = cdp.send("DOM.getDocument")["root"]["nodeId"]
    got = {}
    for sel in ("#brand-name", "#tile-bubbels .tile-name", ".group-name"):
        node = cdp.send("DOM.querySelector", {"nodeId": root, "selector": sel})["nodeId"]
        if node:
            got[sel] = [f["familyName"] for f in cdp.send("CSS.getPlatformFontsForNode", {"nodeId": node})["fonts"]]
    return got


def run():
    OUT.mkdir(parents=True, exist_ok=True)
    SHEETS.mkdir(parents=True, exist_ok=True)
    base = serve()
    ids = games()
    results = {s: {} for s in SIZES}
    foreign_all = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=CHROME if os.path.exists(CHROME) else None)
        played = []
        for size in SIZES:
            order = []
            ctx, page, foreign = new_page(browser, base, size)
            foreign_all += foreign
            if size == "360":
                results["fonts"] = fonts(page)
            order.append(("home", capture(page, size, "home", results)))
            page.evaluate("document.querySelector('#screen-home').scrollTop = 1e6")
            page.wait_for_timeout(300)
            order.append(("home-end", capture(page, size, "home-end", results)))
            page.click("#store-play")
            page.wait_for_timeout(500)
            order.append(("gate (web)", capture(page, size, "gate-web", results)))
            page.goto(base + "/index.html")
            page.wait_for_selector("html[data-ready='1']")
            page.click("#btn-settings")
            page.wait_for_timeout(400)
            order.append(("settings", capture(page, size, "settings", results)))
            page.click("#btn-full")
            page.wait_for_timeout(500)
            order.append(("offer (web)", capture(page, size, "offer-web", results)))
            ctx.close()

            ctx, page, foreign = new_page(browser, base, size, app=True)
            foreign_all += foreign
            page.click("#btn-settings")
            page.wait_for_timeout(400)
            page.click("#btn-full")
            page.wait_for_timeout(500)
            order.append(("offer (app)", capture(page, size, "offer-app", results)))
            page.click("#ov-buttons .btn >> nth=0")
            page.wait_for_timeout(500)
            order.append(("gate (app)", capture(page, size, "gate-app", results)))
            ctx.close()

            ctx, page, foreign = new_page(browser, base, size)
            foreign_all += foreign
            for gid in ids:
                page.goto(base + "/index.html")
                page.wait_for_selector("html[data-ready='1']")
                page.wait_for_timeout(250)
                page.locator(f"#tile-{gid}").scroll_into_view_if_needed()
                page.click(f"#tile-{gid}")
                page.wait_for_timeout(900)
                order.append((gid, capture(page, size, f"game-{gid}", results)))
                if size == "360" and start_round(page):
                    page.wait_for_timeout(1400)
                    close_card(page)
                    played.append((gid, capture(page, size, f"play-{gid}", results)))
            ctx.close()
            sheet(size, order)
            if played:
                sheet("360-play", played, SIZES["360"])
                played = []
            print(size, "done", file=sys.stderr)
        browser.close()
    results["foreignRequests"] = sorted(set(foreign_all))
    results["cvd"] = cvd()
    (OUT / "audit.json").write_text(json.dumps(results, indent=1, ensure_ascii=False))
    summary(results)


START = r"""
() => {
  const scr = document.querySelector('.screen.active');
  const ok = (b) => { const r = b.getBoundingClientRect(); return r.width > 0 && !b.disabled && !b.closest('[hidden]') && !/locked|lock/.test(b.className) && !b.querySelector('.lock'); };
  const all = [...scr.querySelectorAll('button')].filter(ok).filter((b) => !b.dataset.go && !/Willekeurig|Random/.test(b.textContent));
  const play = all.find((b) => /^\s*(Spelen|Play)\s*$/.test(b.textContent.replace(/[^\w\s]/g, '')));
  const first = all.find((b) => /^\s*1\b/.test(b.textContent));
  const pick = play || first || all.find((b) => b.getBoundingClientRect().top > 90);
  if (!pick) return false;
  pick.click();
  return true;
}
"""


def start_round(page):
    """Into a first round: the menu's Play, else level 1, else its first option (heuristic)."""
    try:
        return page.evaluate(START)
    except Exception:
        return False


def close_card(page):
    """A how-to card over the first round: take the first button on it."""
    if page.locator("#overlay:not([hidden])").count():
        page.locator("#ov-buttons .btn").first.click()
        page.wait_for_timeout(500)


def sheet(size, order, dims=None):
    k = THUMB.get(size, 0.5)
    w, h = dims or SIZES[size]
    tw, th = int(w * k), int(h * k)
    cols = 6
    rows = math.ceil(len(order) / cols)
    img = Image.new("RGB", (cols * (tw + 8) + 8, rows * (th + 26) + 8), "#ffffff")
    d = ImageDraw.Draw(img)
    for i, (name, path) in enumerate(order):
        x, y = 8 + (i % cols) * (tw + 8), 8 + (i // cols) * (th + 26)
        img.paste(Image.open(path).convert("RGB").resize((tw, th), Image.LANCZOS), (x, y))
        d.rectangle([x - 1, y - 1, x + tw, y + th], outline="#c8c8d0")
        d.text((x, y + th + 5), name, fill="#222222")
    img.quantize(colors=192, method=Image.Quantize.MEDIANCUT).save(SHEETS / f"sheet-{size}.png", optimize=True)


# --- colour-vision deficiency: the palettes that carry meaning, simulated (Machado et al. 2009,
# severity 1.0) and compared pairwise by CIEDE2000. Under about 10 two colours start to blur.
PALETTES = {
    "dogudoku regions": ["#cdebc6", "#ffd8a6", "#c4dcfb", "#ffc8d8", "#f8ec9c", "#dccfff", "#bdeee3", "#e9dfcc"],
    "picturedoku pictures": ["#e5484d", "#ffd23f", "#8e5bd6", "#ff8a3d", "#8bd448", "#b0723a", "#ff7eb6", "#4c95f5", "#3b2a22"],
    "bubbels bubbles": ["#1E80D6", "#F29A0E", "#12AE7E", "#F5DF2E", "#D877B3", "#5CC2F2"],
}
MACHADO = {
    "protan": [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    "deutan": [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
    "tritan": [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
}


def hex_rgb(h):
    return tuple(int(h[i : i + 2], 16) for i in (1, 3, 5))


def to_lin(c):
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def to_srgb(c):
    c = min(1, max(0, c))
    return 255 * (12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055)


def simulate(rgb, kind):
    if kind == "normal":
        return rgb
    lin = [to_lin(c) for c in rgb]
    m = MACHADO[kind]
    return tuple(to_srgb(sum(m[i][j] * lin[j] for j in range(3))) for i in range(3))


def lab(rgb):
    r, g, b = [to_lin(c) for c in rgb]
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    return 116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))


def de2000(l1, l2):
    L1, a1, b1 = l1
    L2, a2, b2 = l2
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2)
    Cb = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
    a1p, a2p = a1 * (1 + G), a2 * (1 + G)
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p, h2p = math.degrees(math.atan2(b1, a1p)) % 360, math.degrees(math.atan2(b2, a2p)) % 360
    dL, dC = L2 - L1, C2p - C1p
    dh = h2p - h1p
    if C1p * C2p == 0:
        dh = 0
    elif dh > 180:
        dh -= 360
    elif dh < -180:
        dh += 360
    dH = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dh / 2))
    Lb, Cbp = (L1 + L2) / 2, (C1p + C2p) / 2
    hb = (h1p + h2p) / 2 if abs(h1p - h2p) <= 180 else (h1p + h2p + 360) / 2
    if C1p * C2p == 0:
        hb = h1p + h2p
    T = 1 - 0.17 * math.cos(math.radians(hb - 30)) + 0.24 * math.cos(math.radians(2 * hb)) + 0.32 * math.cos(math.radians(3 * hb + 6)) - 0.2 * math.cos(math.radians(4 * hb - 63))
    SL = 1 + 0.015 * (Lb - 50) ** 2 / math.sqrt(20 + (Lb - 50) ** 2)
    SC, SH = 1 + 0.045 * Cbp, 1 + 0.015 * Cbp * T
    RT = -2 * math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)) * math.sin(math.radians(60 * math.exp(-(((hb - 275) / 25) ** 2))))
    return math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH))


def cvd():
    out = {}
    for name, cols in PALETTES.items():
        out[name] = {}
        for kind in ("normal", "protan", "deutan", "tritan"):
            labs = [lab(simulate(hex_rgb(c), kind)) for c in cols]
            pairs = [(de2000(labs[i], labs[j]), cols[i], cols[j]) for i in range(len(cols)) for j in range(i + 1, len(cols))]
            d, a, b = min(pairs)
            out[name][kind] = {"minDE": round(d, 1), "pair": [a, b], "under10": sum(1 for p in pairs if p[0] < 10)}
    return out


def summary(res):
    for size in SIZES:
        small = fails = 0
        for name, m in res[size].items():
            s = [t for t in m["targets"] if min(t["w"], t["h"]) < 48]
            f = [c for c in m["contrast"] if not c["pass"]]
            small += len(s)
            fails += len(f)
        print(f"{size}: {len(res[size])} screens, {small} targets under 48 px, {fails} texts under AA")
    print("fonts:", res.get("fonts"))
    print("foreign requests:", res["foreignRequests"] or "none")


if __name__ == "__main__":
    run()
