"""Vier op een rij on two phones (spike, ?test&coop): two real Chromium browsers, each one phone,
connect with WebRTC over QR codes and play, with no server, no internet and no STUN or TURN.

What it does, end to end:
- puts itself in a fresh network namespace (Linux user namespaces) with one private LAN
  (10.77.0.0/24) and a default route to a gateway that does not exist, so nothing can reach the
  internet; a packet sniffer on the LAN reports anything addressed outside it;
- phone 1 shows the offer as a QR code; its pixels become phone 2's camera (Chromium's fake camera
  reads a Y4M file), phone 2 scans it with the app's own reader and shows its answer as a QR code,
  which becomes phone 1's camera; phone 1 scans it and the data channel opens;
- both boards play a game to a win with taps, whose turn it is shown on both, a tap out of turn
  does nothing, "again" starts the next game on both with the other phone first;
- phone 1 sends what a cheating or garbled phone could send (moves out of turn, unknown columns,
  garbage, a long text): phone 2's board does not change and the game goes on;
- phone 2 goes to the background: both get the "connection is gone" card;
- they connect again, and phone 1 floods the channel: phone 2 closes it, both get the card;
- they connect a third time and phone 1 leaves with its back arrow: phone 2 gets the card;
- under the real CSP (no bypass): no violation, no page error, no request outside the origin.

Run (on the dev host): uv run --with playwright python tests/coop.py
COOP_ISOLATE=0 skips the network namespace (CI runners may not allow user namespaces).
Screenshots in shots/coop-*.png, the numbers in shots/coop.json.
"""
import base64
import functools
import http.server
import json
import os
import socket
import struct
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
SHOTS = ROOT / "shots"
CHROME = os.environ.get(
    "CHROME",
    "/home/agent/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell",
)
if not os.path.exists(CHROME):
    CHROME = None
PHONE = {"width": 390, "height": 844}
LAN = "10.77.0"


# ---------- no internet: a namespace with one private LAN ----------

def isolate():
    """A new user + network namespace: loopback and a veth pair on 10.77.0.0/24, a default route to
    10.77.0.254 (which does not exist), no other interface. Must run before any thread starts."""
    uid, gid = os.getuid(), os.getgid()
    os.unshare(os.CLONE_NEWUSER | os.CLONE_NEWNET)
    Path("/proc/self/setgroups").write_text("deny")
    Path("/proc/self/uid_map").write_text(f"0 {uid} 1")
    Path("/proc/self/gid_map").write_text(f"0 {gid} 1")
    for cmd in (
        "ip link set lo up",
        "ip link add lan0 type veth peer name lan1",
        f"ip addr add {LAN}.1/24 dev lan0",
        "ip link set lan0 up",
        "ip link set lan1 up",
        "ip route add 224.0.0.0/4 dev lan0",
        # Chromium gathers no host candidate at all without a default route (measured); a phone on
        # Wi-Fi always has one, to its router, even when the router has no internet
        f"ip route add default via {LAN}.254 dev lan0",
    ):
        subprocess.run(cmd.split(), check=True)
    # let IPv6 duplicate address detection finish first: Chromium aborts page loads with
    # ERR_NETWORK_CHANGED when an address appears while it loads
    end = time.time() + 8
    while time.time() < end and "tentative" in subprocess.run(["ip", "addr"], capture_output=True, text=True).stdout:
        time.sleep(0.2)
    time.sleep(1)
    return subprocess.run(["ip", "-br", "addr"], capture_output=True, text=True).stdout.strip()


class Sniffer(threading.Thread):
    """Every frame that leaves lan0 arrives on lan1. Counts mDNS and anything meant for outside."""

    def __init__(self):
        super().__init__(daemon=True)
        self.sock = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.ntohs(0x0003))
        self.sock.bind(("lan1", 0))
        self.counts = {"frames": 0, "mdns": 0, "outside": 0}
        self.outside = []

    def run(self):
        while True:
            try:
                f = self.sock.recv(65535)
            except OSError:
                return
            self.counts["frames"] += 1
            kind = classify(f)
            if kind == "mdns":
                self.counts["mdns"] += 1
            elif kind.startswith("outside"):
                self.counts["outside"] += 1
                self.outside.append(kind)


def classify(f):
    eth = struct.unpack("!H", f[12:14])[0]
    if eth == 0x0806:  # ARP: asking for the gateway means something wanted to go outside
        target = socket.inet_ntoa(f[38:42])
        return "local-arp" if target.startswith(LAN + ".") and target != LAN + ".254" else f"outside arp {target}"
    if eth == 0x0800:
        ihl = (f[14] & 0x0F) * 4
        proto = f[23]
        dst = socket.inet_ntoa(f[30:34])
        first = int(dst.split(".")[0])
        if 224 <= first <= 239:
            if proto == 17 and struct.unpack("!H", f[14 + ihl + 2:14 + ihl + 4])[0] == 5353:
                return "mdns"
            return "multicast"
        if dst.startswith(LAN + ".") and dst != LAN + ".254":
            return "local"
        return f"outside ipv4 {dst} proto {proto}"
    if eth == 0x86DD:
        nxt = f[20]
        dst = f[38:54]
        if dst[0] == 0xFF:
            if nxt == 17 and struct.unpack("!H", f[56:58])[0] == 5353:
                return "mdns"
            return "multicast"
        if dst[0] == 0xFE and (dst[1] & 0xC0) == 0x80:
            return "local"
        return "outside ipv6 " + socket.inet_ntop(socket.AF_INET6, dst)
    return "other"


# ---------- the camera: a QR code on screen -> a Y4M file for Chromium's fake camera ----------

QR_PIXELS_JS = """() => {
  const c = document.querySelector('#coop-qr');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let bin = '';
  for (let i = 0; i < c.width * c.height; i++) bin += String.fromCharCode(Math.round(0.299 * d[4 * i] + 0.587 * d[4 * i + 1] + 0.114 * d[4 * i + 2]));
  return { w: c.width, h: c.height, y: btoa(bin) };
}"""


def write_y4m(path, shot, W=640, H=480):
    """The QR code's pixels in the middle of a white 640x480 frame (4:2:0, grey)."""
    w, h, y = shot["w"], shot["h"], base64.b64decode(shot["y"])
    assert w <= W and h <= H, (w, h)
    frame = bytearray(b"\xff" * (W * H))
    ox, oy = (W - w) // 2, (H - h) // 2
    for r in range(h):
        frame[(oy + r) * W + ox:(oy + r) * W + ox + w] = y[r * w:(r + 1) * w]
    uv = b"\x80" * (W * H // 4)
    tmp = str(path) + ".tmp"
    with open(tmp, "wb") as fh:
        fh.write(f"YUV4MPEG2 W{W} H{H} F10:1 Ip A1:1 C420jpeg\n".encode())
        fh.write(b"FRAME\n" + bytes(frame) + uv + uv)
    os.replace(tmp, path)


# ---------- helpers ----------

def poll(page, js, timeout=15, arg=None, what=""):
    """page.evaluate until it is truthy (wait_for_function needs eval, which the real CSP blocks)."""
    end = time.time() + timeout
    last = None
    while time.time() < end:
        last = page.evaluate(js, arg) if arg is not None else page.evaluate(js)
        if last:
            return last
        time.sleep(0.1)
    raise AssertionError(f"timed out: {what or js} (last: {last!r})")


def state(page):
    return page.evaluate("window.__bubbels.vier.state()")


def coop_state(page):
    return page.evaluate("(() => { const c = window.__bubbels.vier.coop(); return c && c.state(); })()")


class Run:
    def __init__(self, base, problems):
        self.base = base
        self.problems = problems
        self.errors = []
        self.foreign = []

    def check(self, ok, msg):
        if not ok:
            self.problems.append(msg)
            print("FAIL:", msg)
        return ok

    def phone(self, p, name, cam):
        args = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", f"--use-file-for-fake-video-capture={cam}"]
        browser = p.chromium.launch(executable_path=CHROME, args=args)
        ctx = browser.new_context(viewport=PHONE, device_scale_factor=2, locale="nl-NL", has_touch=True)  # no bypass_csp: the real CSP
        ctx.add_init_script("document.addEventListener('securitypolicyviolation', (e) => (window.__csp = window.__csp || []).push(`${e.violatedDirective} ${e.blockedURI}`))")
        page = ctx.new_page()
        page.on("pageerror", lambda e: self.errors.append(f"{name}: {e}"))
        page.on("console", lambda m: m.type == "error" and self.errors.append(f"{name}: {m.text}"))
        page.on("request", lambda r: not r.url.startswith(self.base) and not r.url.startswith("data:") and self.foreign.append(r.url))
        page.goto(self.base + "/?test&coop")
        try:
            page.wait_for_selector("html[data-ready='1']", state="attached", timeout=30000)
        except Exception:
            page.screenshot(path=str(SHOTS / f"coop-{name}-boot.png"))
            print("boot failed:", name, self.errors, self.foreign)
            raise
        page.name = name
        return browser, page


def to_coop_screen(page, board):
    try:
        if not page.locator("#screen-vier-menu.active").count():
            page.click("#tile-vier", timeout=8000)
    except Exception:
        page.screenshot(path=str(SHOTS / f"coop-{page.name}-tile-fail.png"))
        print(page.evaluate("[...document.querySelectorAll('.screen.active')].map(s=>s.id)"), page.evaluate("document.querySelector('#overlay').hidden"), page.evaluate("document.querySelector('#ov-title')?.textContent"))
        raise
    page.wait_for_selector("#screen-vier-menu.active")
    page.click(f"#vier-menu .board-{board}")
    page.click("#vier-menu .mode-net")
    page.locator("#vier-menu .mode-net").scroll_into_view_if_needed()
    page.screenshot(path=str(SHOTS / f"coop-menu-{page.name}.png"))
    page.click("#vier-play")
    page.wait_for_selector("#screen-vier-coop.active")


def connect(run, a, b, cam_a, cam_b, board, tag):
    """Phone a shows the offer, b scans it and shows the answer, a scans that. Returns timings."""
    to_coop_screen(a, board)
    to_coop_screen(b, "big")  # phone 2's own menu choice does not matter: the offer brings the board
    a.click("#coop-host")
    a.wait_for_selector("#coop-qr:not([hidden])", timeout=10000)
    offer = coop_state(a)
    a.screenshot(path=str(SHOTS / f"coop-{tag}-1-offer.png"))
    write_y4m(cam_b, a.evaluate(QR_PIXELS_JS))
    b.click("#coop-guest")
    t0 = time.time()
    b.wait_for_selector("#coop-qr:not([hidden])", timeout=20000)
    scan_offer = time.time() - t0
    answer = coop_state(b)
    b.screenshot(path=str(SHOTS / f"coop-{tag}-2-answer.png"))
    write_y4m(cam_a, b.evaluate(QR_PIXELS_JS))
    a.click("#coop-next")
    t1 = time.time()
    poll(a, "() => window.__bubbels.vier.coop().state().state === 'open'", 25, what="phone 1 open")
    connect_s = time.time() - t1
    poll(b, "() => window.__bubbels.vier.coop().state().state === 'open'", 10, what="phone 2 open")
    a.screenshot(path=str(SHOTS / f"coop-{tag}-3-connected.png"))
    for ph in (a, b):
        ph.wait_for_selector("#screen-vier.active", timeout=5000)
        run.check(not coop_state(ph)["camera"], f"{tag}: {ph.name}'s camera is still on after connecting")
    run.check(offer["session"] == answer["session"], f"{tag}: the answer is for another session")
    return {
        "offer_chars": len(offer["code"]),
        "offer_qr_modules": offer["qr"],
        "offer_candidates": offer["kinds"],
        "answer_chars": len(answer["code"]),
        "answer_qr_modules": answer["qr"],
        "answer_candidates": answer["kinds"],
        "scan_offer_to_answer_s": round(scan_offer, 2),
        "scan_answer_to_open_s": round(connect_s, 2),
        "_codes": [offer["code"], answer["code"]],
    }


def board_of(page):
    return state(page)["board"]


def tap(run, page, col, other):
    """A real tap on a column on `page`, then wait until both boards have the token."""
    before = sum(1 for v in board_of(page) if v)
    page.tap(f"#vier-board .vcol[data-col='{col}']")
    for ph in (page, other):
        poll(ph, "(n) => { const s = window.__bubbels.vier.state(); return s.board.filter(Boolean).length === n && !s.busy; }", 10, arg=before + 1, what=f"{ph.name} sees move {before + 1}")
    run.check(board_of(page) == board_of(other), f"boards differ after a tap on {page.name}: {board_of(page)} vs {board_of(other)}")


def status(page):
    return page.inner_text("#vier-status").strip()


def lost_card(run, page, tag):
    poll(page, "() => !document.querySelector('#overlay').hidden && document.querySelector('#ov-title').textContent.includes('verbinding is weg')", 10, what=f"{tag}: {page.name} shows the lost card")
    page.screenshot(path=str(SHOTS / f"coop-{tag}-{page.name}-lost.png"))
    s = coop_state(page)
    run.check(s["pc"] is None and s["ch"] is None, f"{tag}: {page.name} still holds a connection: {s}")


def main():
    problems = []
    report = {}
    if os.environ.get("COOP_ISOLATE", "1") != "0":
        try:
            report["network"] = isolate()
        except Exception as e:  # noqa: BLE001
            print("no network namespace (continuing without isolation):", e)
            report["network"] = f"not isolated: {e}"
    sniffer = None
    if "lan1" in report.get("network", ""):
        sniffer = Sniffer()
        sniffer.start()
    from playwright.sync_api import sync_playwright

    SHOTS.mkdir(exist_ok=True)
    handler = functools.partial(type("Quiet", (http.server.SimpleHTTPRequestHandler,), {"log_message": lambda *a: None}), directory=str(WEB))
    srv = type("QuietServer", (http.server.ThreadingHTTPServer,), {"handle_error": lambda *a: None})(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    run = Run(base, problems)
    tmp = Path(tempfile.mkdtemp(prefix="coop-cam-"))
    cam_a, cam_b = tmp / "a.y4m", tmp / "b.y4m"
    blank = {"w": 2, "h": 2, "y": base64.b64encode(b"\xff" * 4).decode()}
    write_y4m(cam_a, blank)
    write_y4m(cam_b, blank)

    with sync_playwright() as p:
        ba, a = run.phone(p, "phone1", cam_a)
        bb, b = run.phone(p, "phone2", cam_b)

        # without ?coop the option is not there (nothing changes for children)
        plain = ba.new_context(viewport=PHONE).new_page()
        plain.goto(base + "/?test")
        plain.wait_for_selector("html[data-ready='1']", state="attached")
        try:
            plain.click("#tile-vier", timeout=8000)
        except Exception:
            plain.screenshot(path=str(SHOTS / "coop-plain-fail.png"))
            print(plain.evaluate("document.querySelector('#tile-vier')?.outerHTML.slice(0,300)"), plain.evaluate("[...document.querySelectorAll('.screen.active')].map(s=>s.id)"), plain.evaluate("document.querySelector('#overlay').hidden"))
            raise
        run.check(plain.locator("#vier-menu .mode-net").count() == 0, "the two-phone option shows without ?coop")
        plain.close()

        # ---- 1: connect on the kleuterbord and play to a win ----
        report["connect1"] = connect(run, a, b, cam_a, cam_b, "small", "c1")
        report["connect1"].pop("_codes")
        sa, sb = state(a), state(b)
        run.check(sa["setup"]["board"] == "small" and sb["setup"]["board"] == "small", f"the board did not travel: {sa['setup']} {sb['setup']}")
        run.check(sa["tokens"] == sb["tokens"], f"the tokens differ: {sa['tokens']} {sb['tokens']}")
        run.check(status(a) == "Jij bent aan de beurt", f"phone 1 status: {status(a)!r}")
        run.check(status(b) == "Je vriendje is aan de beurt…", f"phone 2 status: {status(b)!r}")
        run.check(a.locator("#vier-turn .vier-chip.on .name").inner_text() == "Jij", "phone 1's own chip is not lit")
        run.check(b.locator("#vier-turn .vier-chip.on .name").inner_text() == "Vriendje", "phone 2 does not show the friend's turn")
        a.screenshot(path=str(SHOTS / "coop-c1-4-phone1-board.png"))
        b.screenshot(path=str(SHOTS / "coop-c1-4-phone2-board.png"))
        # a tap out of turn does nothing anywhere
        b.tap("#vier-board .vcol[data-col='2']")
        time.sleep(0.6)
        run.check(not any(board_of(a)) and not any(board_of(b)), "a tap out of turn changed a board")
        for col, ph, oth in ((0, a, b), (1, b, a), (0, a, b), (1, b, a)):
            tap(run, ph, col, oth)
            run.check(status(oth) == "Jij bent aan de beurt", f"after {ph.name}'s move {oth.name} says {status(oth)!r}")
        tap(run, a, 0, b)  # three in a column: phone 1 wins
        for ph, title in ((a, "Jij wint!"), (b, "Je vriendje wint!")):
            poll(ph, "(t) => !document.querySelector('#overlay').hidden && document.querySelector('#ov-title').textContent === t", 6, arg=title, what=f"{ph.name} end card")
            ph.screenshot(path=str(SHOTS / f"coop-c1-5-{ph.name}-end.png"))
        run.check(state(a)["over"]["winner"] == 1 and state(b)["over"]["winner"] == 1, "the winner differs")

        # ---- again: game 2, phone 2 starts; a cheating phone 1 changes nothing ----
        b.click("#ov-buttons button:has-text('Nog een keer')")
        for ph in (a, b):
            poll(ph, "() => { const n = window.__bubbels.vier.net(); return n && n.gameNo === 2 && document.querySelector('#overlay').hidden; }", 6, what=f"{ph.name} in game 2")
        run.check(state(a)["turn"] == 2 and state(b)["turn"] == 2, "game 2 does not start with phone 2")
        run.check(status(b) == "Jij bent aan de beurt", f"game 2, phone 2 status: {status(b)!r}")
        cheats = [
            '{"t":"m","n":0,"c":2}',  # phone 1 out of turn
            '{"t":"m","n":0,"c":99}',
            '{"t":"m","n":5,"c":1}',
            '{"t":"again","g":7}',
            '{"t":"win","p":1}',
            '{"t":"board","b":[1,1,1,1,1]}',
            "garbage",
            "x" * 500,
        ]
        for c in cheats:
            a.evaluate("(t) => window.__bubbels.vier.coop().sendRaw(t)", c)
        time.sleep(0.8)
        run.check(not any(board_of(b)), f"a cheat changed phone 2's board: {board_of(b)}")
        run.check(coop_state(b)["state"] == "open", "phone 2 closed after a few bad messages (should only after BAD_LIMIT)")
        run.check(state(b)["turn"] == 2 and state(b)["history"] == 0, f"a cheat changed phone 2's game: {state(b)}")
        tap(run, b, 2, a)
        tap(run, a, 3, b)
        report["cheats_ignored"] = len(cheats)

        # ---- phone 2 goes to the background: both get the card ----
        b.evaluate("""() => {
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
          Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
          document.dispatchEvent(new Event('visibilitychange'));
        }""")
        lost_card(run, a, "c1-bg")
        b.evaluate("""() => {
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
          Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
          document.dispatchEvent(new Event('visibilitychange'));
        }""")
        lost_card(run, b, "c1-bg")
        run.check(a.locator("#vier-board .vcol:not([disabled])").count() == 0, "phone 1's columns still work after the connection is gone")
        for ph in (a, b):
            ph.click("#ov-buttons button:has-text('Menu')")
            ph.wait_for_selector("#screen-vier-menu.active")

        # ---- 2: connect again (big board); phone 1 floods the channel ----
        report["connect2"] = connect(run, a, b, cam_a, cam_b, "big", "c2")
        report["connect2"].pop("_codes")
        run.check(state(b)["setup"]["board"] == "big", "the big board did not travel")
        tap(run, a, 3, b)
        a.evaluate("() => { for (let i = 0; i < 40; i++) window.__bubbels.vier.coop().sendRaw('{\"t\":\"bye\",\"x\":' + i + '}'); }")
        lost_card(run, b, "c2-flood")
        lost_card(run, a, "c2-flood")
        for ph in (a, b):
            ph.click("#ov-buttons button:has-text('Menu')")

        # ---- 3: connect once more; phone 1 leaves with its back arrow ----
        report["connect3"] = connect(run, a, b, cam_a, cam_b, "small", "c3")
        a.click("#vier-back")
        a.wait_for_selector("#screen-vier-menu.active")
        run.check(coop_state(a)["pc"] is None, "phone 1 kept its connection after leaving")
        lost_card(run, b, "c3-left")

        # ---- a code that is not ours, or the wrong kind, never gets in ----
        b.click("#ov-buttons button:has-text('Menu')")
        to_coop_screen(b, "big")
        b.click("#coop-guest")
        b.wait_for_selector("#coop-scan:not([hidden])")
        offer3, answer3 = report["connect3"].pop("_codes")
        tampered = offer3[:20] + ("A" if offer3[20] != "A" else "B") + offer3[21:]
        for text, msg in (("hello", None), ("BZ1ABCD0101:ABC", None), (answer3, "Dit is de tweede code"), (tampered, "Deze code klopt niet")):
            b.evaluate("(t) => window.__bubbels.vier.coop().take(t)", text)
            run.check(coop_state(b)["state"] == "scanning", f"phone 2 left scanning on {text[:24]!r}: {coop_state(b)['state']}")
            if msg:
                run.check(b.inner_text("#coop-scan-msg").startswith(msg), f"phone 2 says {b.inner_text('#coop-scan-msg')!r} for {text[:24]!r}")
        b.screenshot(path=str(SHOTS / "coop-wrong-code.png"))
        b.click("#coop-back")
        b.wait_for_selector("#screen-vier-menu.active")
        run.check(not coop_state(b)["camera"], "the camera is still on after leaving the screen")

        for ph in (a, b):
            v = ph.evaluate("window.__csp || []")
            run.check(not v, f"{ph.name}: CSP violations {v}")
        ba.close()
        bb.close()

    run.check(not run.errors, f"page errors: {run.errors}")
    run.check(not run.foreign, f"requests outside the origin: {run.foreign}")
    if sniffer:
        report["lan"] = dict(sniffer.counts)
        run.check(sniffer.counts["outside"] == 0, f"packets meant for outside the LAN: {sniffer.outside[:10]}")
        run.check(sniffer.counts["mdns"] > 0, "no mDNS seen: the candidates were not resolved over the LAN")
    report["requests_outside_origin"] = len(run.foreign)
    report["problems"] = problems
    (SHOTS / "coop.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    if problems:
        print(f"{len(problems)} problem(s)")
        sys.exit(1)
    print("coop: all good")


if __name__ == "__main__":
    main()
