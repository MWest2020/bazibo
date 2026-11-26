# Vier op een rij on two phones: WebRTC over QR codes (spike)

Status: spike, approved by Mark on 26 Nov 2026. Hidden behind `?test&coop`; nothing changes for
children. Code: `web/games/vier/coop.js` (screen, camera, connection), `coop-codec.js` (the QR
code), `coop-proto.js` (the messages). Tests: `tests/vier-coop.test.js` (unit),
`tests/coop.py` (two browsers), `tools/coop-sizes.mjs` (the size table below).

## The plan, as built

No server, no internet, no STUN or TURN, no new native code.

1. Phone 1 makes an `RTCPeerConnection({ iceServers: [] })` with one negotiated data channel
   (`id: 0`), waits for its host candidates, and shows the offer as a QR code.
2. Phone 2 scans it with the camera (the reader of Voortgang overzetten: `BarcodeDetector`, or the
   vendored jsQR), answers, and shows the answer as a QR code. Phone 1 scans that.
3. The data channel opens over the Wi-Fi (DTLS, as always in WebRTC). Only moves travel.

Not the SDP travels but the five things that cannot be guessed: ICE ufrag and password, the
DTLS fingerprint (sha-256), the role (fixed: offer `actpass`, answer `active`) and up to four
host candidates. The receiver rebuilds a complete SDP from those fields (`buildSdp`). Binary,
CRC-32, base45 (the QR alphanumeric alphabet, as in `transfer.js`), prefix `BZV`. The offer also
carries the board and both tokens (one byte) and a session id that the answer repeats.

## What was proven, and how

All in this sandbox: two separate Chromium processes (Playwright's chrome-headless-shell 1255,
Chrome for Testing 159.0.8154.6) on one Linux host, no phones.

| Claim | How | Result |
| --- | --- | --- |
| It connects with host candidates only, no STUN/TURN | `tests/coop.py`: real app, real CSP, two browsers | connected 3 times out of 3, about 0.2 s after the answer is scanned |
| It needs no internet | the test runs in its own network namespace: one private LAN (10.77.0.0/24), a default route to a gateway that does not exist; a packet sniffer on the LAN | 0 packets for outside the LAN; 16 mDNS packets (the names were resolved over the LAN) |
| mDNS names (`<uuid>.local`) resolve between two Chrome instances | default Chrome settings: both codes carried only an mDNS candidate | resolved, connected |
| The QR codes really scan | phone 1's QR pixels became phone 2's camera (Chromium's fake camera reads a Y4M file) and back; the app's own reader (jsQR in headless Chrome) decoded them | scanned every time, offer to answer in 0.1-0.3 s |
| A manual QR exchange is enough (no trickle) | the codes are made after gathering completes | yes |
| Nothing breaks under the CSP | the test runs without `bypass_csp`, with a `securitypolicyviolation` listener | no violation, no page error |
| No request leaves the origin | Playwright request listener on both pages | 0 requests outside the origin |
| A cheating or garbled phone cannot break the game | the test sends moves out of turn, unknown columns, wrong move numbers, unknown messages, garbage and a 500-character text; unit test: 200 seeded games with junk | the other board never changes; the game goes on |
| A flood closes the connection cleanly | 40 messages at once | the receiver closes; both get "De verbinding is weg" |
| Leaving, the background and the back arrow close the connection | background (visibilitychange), the back arrow, the lost card | both phones show the card; no RTCPeerConnection, channel or camera left open |

Extra measurements with a bare probe (same browsers, same namespace):

- **No default route, no candidates.** With no default route at all, Chromium gathered zero host
  candidates and nothing connected. With a default route to a gateway that does not exist it
  works. A phone on Wi-Fi always has a default route (its router), also when the router has no
  internet, so this should not matter on phones; it is why the test adds one.
- **One side's candidates are enough.** With the candidate taken out of the offer, or out of the
  answer, it still connected (ICE learns the other address from the first check, "peer
  reflexive"). So the two phones only need *one* of them to resolve the other's mDNS name (or to
  get a plain local address).
- **Phone 1 may take its time.** Phone 2's ICE checks already succeed before phone 1 has the
  answer; with phone 1 scanning 45 s late, the channel opened 0.1 s after the scan.
- **Unresolvable names fail slowly.** With both names unresolvable the connection stayed in
  "connecting" (never "failed" within 25 s). The app gives up after 20 s and says "Het lukt niet om
  te verbinden. Zitten jullie op hetzelfde wifi?".
- **A granted camera did not make Chrome show plain addresses** in headless Chrome with the fake
  camera; on a real phone it may (Chrome exposes local IPs to pages with camera permission). Phone
  2 keeps its camera on until its answer is gathered, to make that more likely. The grey line under
  each code shows which kind of address went into it.

## What is NOT proven (needs two real Android phones)

- mDNS between two **physical** devices over a real access point. In the sandbox both browsers
  were on one host, so multicast went over a local link. Some routers, mesh systems and every
  guest network with "client isolation" drop multicast or traffic between clients.
- Android specifics: whether Chrome on Android answers and resolves mDNS when the screen is on
  and the app in front (Wi-Fi chips filter multicast unless an app holds a multicast lock; Chrome
  may or may not hold one); whether the **Capacitor WebView** uses mDNS names at all (if it gives
  plain local addresses, no mDNS is needed).
- Scanning a QR code from a phone screen with a phone camera: the codes are version 5 (37x37
  modules), smaller than the version 13 codes Voortgang overzetten already scans, so this is
  low risk.
- The time it takes on real Wi-Fi, and what a real Wi-Fi drop looks like (the app waits 4 s on
  "disconnected" before it calls the connection gone).

## QR size

`node tools/coop-sizes.mjs`, real Chrome SDPs, error correction L:

| Code | Whole SDP | Whole SDP deflated, base45 | Only the needed lines | Those deflated | **Our codec** |
| --- | --- | --- | --- | --- | --- |
| Offer, 1 mDNS candidate | 587 chars, v17 (85x85) | 656, v14 | 313, v11 | 378, v10 | **141 chars, v5 (37x37)** |
| Answer, 1 mDNS candidate | 586, v16 | 648, v14 | 312, v11 | 369, v10 | **140, v5 (37x37)** |
| Offer, 2 mDNS candidates | 702, v18 | 705, v15 | 427, v14 | 432, v11 | **170, v6 (41x41)** |
| Offer, 4 candidates (2 mDNS, IPv4, IPv6) | 924, v21 | 798, v16 | 647, v18 | 525, v12 | **209, v7 (45x45)** |

Deflate barely helps: what is left after stripping is random (keys, ids). Rebuilding the SDP from
a few fields is what makes the code small. One QR code always suffices (at most 4 candidates, so
the biggest code `decodeSignal` accepts is still under version 10); the multi-part flow of
`transfer.js` is not needed.

## Security and privacy

- **The QR code is untrusted.** `decodeSignal` checks the length (at most `MAX_TEXT`), the
  alphabet, base45, the CRC-32, the version, the kind (an answer where an offer is expected is
  refused with its own message), every field's shape (ufrag and password: ice-chars and RFC
  lengths; the fingerprint: 32 bytes; 1 to 4 candidates of known kinds; port 1-65535; board and
  two different known tokens) and that nothing trails. The SDP is rebuilt from these fields only,
  so nothing else from the code reaches the browser. Unit tests: every changed character, every
  cut, 20 000 random and mutated codes (with a recomputed checksum, to reach the checks behind it).
- **Only local addresses.** A candidate is an mDNS name, a private or link-local IPv4 address or
  a link-local or unique-local IPv6 address; never a public address, a DNS name, loopback or the
  100.64/10 range (Tailscale, mobile CGNAT). So a code can never make a phone send a packet to the
  internet, and the code never carries a phone's public IPv6 address.
- **No STUN, no TURN, no server**; a unit test fails if `stun:`/`turn:` appears in `web/` or if
  any other `RTCPeerConnection` than the one with `{ iceServers: [] }` is added.
- **The CSP is unchanged.** WebRTC is not governed by `connect-src` in Chromium (there is no
  shipped `webrtc` directive), so nothing had to be loosened, and nothing could be tightened for it
  either. The proof that nothing leaves is the request listener plus the namespace sniffer.
- **DTLS stays on** (WebRTC cannot turn it off) and is pinned: the fingerprint comes in the QR
  code the child scanned, so the channel only opens to the phone whose code was on that screen.
- **Only moves travel.** Each phone plays every move through `rules.js` itself. A message is
  parsed with exact shapes (`parseMessage`: at most 64 characters, JSON, exactly the known keys),
  a move is judged against the turn, the move number, the column and the board (`judgeMove`),
  "again" only for the next game once this one is over (`judgeAgain`). Bad messages are ignored;
  10 bad ones or more than 20 in a second close the connection (`createGuard`). A phone can
  only ever make its own legal moves on the other board.
- **Closed when leaving.** The back arrow, the Android back button, leaving the screen any other
  way, the lost card and the app going to the background close the channel and the connection
  (and the camera); the other phone then shows "De verbinding is weg". A finished game is not kept
  ("keep playing" does not apply on two phones). The camera is on only while scanning.
- **Nothing is stored or counted**: two-phone games write nothing to the save (no setup, no wins).

### A parental gate?

No, I think. The parental gate is for buying, restoring and links that leave the app (store
rules for kids' apps). This leaves nothing: no account, no server, no internet, no link, nothing
to buy. The only "contact" is with a phone in the same room whose screen the child points the
camera at, and the only thing that can travel is a column number, checked against the rules. No
chat, names, pictures or free text, so there is nothing to moderate. The camera already sits behind
the system's permission dialog, as in Voortgang overzetten (which has no gate either). If the mode
ever gets a way to find other phones by itself (no QR code), this argument no longer holds.

## Failure modes and what the child sees

| What happens | What the app does |
| --- | --- |
| Not on Wi-Fi (no local candidate) | "Deze telefoon zit niet op wifi. Zet wifi aan en probeer het opnieuw." |
| No camera, or camera refused | "De camera werkt hier niet. Laat deze telefoon de code zien." |
| Another QR code in view | ignored, keeps scanning |
| The answer scanned where the offer was expected | "Dit is de tweede code. Scan eerst de code van de telefoon die begon." |
| A broken or tampered code | "Deze code klopt niet. Probeer het nog eens." |
| An answer from another pair of phones | "Deze code hoort bij een ander spel." |
| A newer code format | "De andere telefoon heeft een andere versie van de app." |
| No connection 20 s after the answer was scanned (guest network, multicast blocked, different Wi-Fi) | "Het lukt niet om te verbinden. Zitten jullie op hetzelfde wifi? Probeer het opnieuw." |
| The app goes to the background before connecting | everything closes; "De app was even weg. Begin opnieuw." |
| The other phone leaves, goes to the background, walks out of range, floods or misbehaves | "De verbinding is weg": back to the menu |

## Open risks

1. **Multicast between two Android phones** (mDNS) may be dropped by the router or filtered by
   the phones. Mitigation already in: one side's address is enough; the guest keeps the camera on
   while gathering. If it still fails, plain local addresses need either Chrome showing them
   (camera permission) or a WebView setting; the native route (a `MulticastLock`, which needs the
   `CHANGE_WIFI_MULTICAST_STATE` permission) is not on the list of allowed native additions and
   needs Mark.
2. **Guest networks and client isolation** block it completely; the message says to use the same
   Wi-Fi. Nothing to do in code.
3. **Android's coming local-network restrictions.** Google has announced a permission for apps
   that talk to devices on the local network for future Android versions. If it becomes required
   for the app's target SDK, the WebView's local traffic would need it: a manifest change for Mark.
4. **Chrome may change mDNS or local-network rules for WebRTC** (Local Network Access work). The
   test with real Chrome on two phones should be repeated before this becomes a feature.
5. **iPhone is not covered** (not a target now). Safari's WebRTC uses mDNS names too; untested.
6. The CI does not run `tests/coop.py` yet: GitHub's Ubuntu runners usually forbid the user
   namespaces it uses (it can run with `COOP_ISOLATE=0`, then without the no-internet proof).

## What Mark tests on two Android phones

Before step 1 the code must be on https://bazibo.nl, which GitHub Pages builds from `main`: merge
the draft PR (the mode is hidden behind the address, nothing changes for children), or say so and
the session merges it. Then:

1. Both phones on the same home Wi-Fi (not a guest network). Mobile data **off** on both.
2. On both: Chrome, open `https://bazibo.nl/?test&coop`. If the next step shows no "Samen op twee
   telefoons", close the tab and open the address again (the service worker updates once).
3. On both: Vier op een rij, Kleuterbord, "Samen op twee telefoons", Spelen.
4. Phone A: "Ik laat de code zien". Phone B: "Ik scan de code", allow the camera, point it at A's
   code. B now shows its own code.
5. Phone A: "Scan nu de code van de ander", allow the camera, point it at B's code. Both should say
   "Verbonden!" and show the board.
6. Play a game to the end: whose turn it is must show on both; a tap on the phone that waits does
   nothing. Then "Nog een keer" on one phone: both start a new game, phone B first.
7. Drops (connect again from the menu before each): (a) press Home on B: A must show "De
   verbinding is weg" within a few seconds, and B too when you come back; (b) turn Wi-Fi off on B:
   A shows the card within about 10 s; (c) the back arrow on A: B shows the card.
8. No internet: pull the internet cable out of the router (Wi-Fi stays on), or use the hotspot of
   a third phone with its mobile data off. Repeat steps 3-6.
9. Write down per attempt: worked or not; the grey line under each code ("Code: 141 tekens, QR
   37×37, adres: mDNS" or "IPv4"); how long until "Verbonden!"; the Android and Chrome versions of
   both phones; the router (brand, mesh or not).
10. The app's WebView (after Chrome works): the session builds a test APK with
    `"server": { "appStartPath": "/?test&coop" }` in `capacitor.config.json` and
    `applicationIdSuffix ".coop"` (so it installs beside the store app; neither change is
    committed), `npx cap sync android` and `./gradlew assembleDebug`. Install it on both phones and
    repeat steps 3-9 in the app. How the APK gets onto the phones (cable, file) is Mark's choice.
