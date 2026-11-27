# Full version

Every game has a free part (Bubbels: levels 1-10, declared in `web/games/bubbels/meta.js`). One
purchase opens everything in every game:

- **in the Android and iOS apps**: the non-consumable in-app product `unlock_all` (€ 1), through
  Google Play or the App Store;
- **on the website** (bazibo.nl and the GitHub Pages copy): a signed code bought through Buy Me a
  Coffee (€1), Mark's decision of 27 Nov 2026 ("ik heb een gebruiker die vraagt of ik in de browser
  kan unlocken. dat via een code doen en buy me a coffee? … ook 1 euro"; "ja, bouw maar"). Never a
  code, a code field or an external payment link inside the app: Google Play's payments policy
  forbids steering to another way to pay for digital goods in the app.

`web/js/unlock.js` keeps the state for both (`createUnlock`, one `owned` flag that every game
listens to). It becomes "owned" only when the store says so (`web/js/billing-native.js`, the
open-source `cordova-plugin-purchase`, no receipt server; the last answer is cached so a bought
game keeps working offline) or when a code's signature checks out (`web/js/unlock-code.js`). The
offer appears at the end of a free part and in Settings. Buying, restoring and entering a code sit
behind the parental gate (`web/js/parental-gate.js`): a multiplication written in words (Dutch or
English), with a typed answer.

## The web code (website only)

Which adapter `main.js` builds decides everything: `createNativeBilling()` in the app
(`isNativeApp()`), `createCodeBilling()` only when `webCodeAllowed(window)` (not the app: no
Capacitor bridge, not `https://localhost`, not `capacitor://`, the same test as the store links),
otherwise nothing (`noBilling`). Every piece of the code's UI hangs on `unlock.kind === 'code'`,
so in the app none of it exists. `tests/unlock-code.test.js` and the smoke part `unlock`
(`web_unlock_native`: a stand-in app) check that.

**The flow.** The child's offer card on the website still says only OK; under it a small
"Voor ouders: volledige versie (€1)" opens the parental gate, then a card with "Koop de volledige
versie (€1)" (Buy Me a Coffee's Extra, `BMC_URL` in `unlock-code.js`, opened in a new tab with
`opener` cut, never fetched), "Ik heb een code" (paste the code, or "Scan de QR-code", which opens
the transfer screen's scanner; it hands a code to the unlock instead of reading it as progress) and
"Later". After buying, the issuer (internetnl-cli, its own repo) mails the code and a link
`https://bazibo.nl/#unlock=<code>`. The link needs no gate (the parent opened it from their mail):
on load (or on `hashchange`, when the tab already showed Bazibo) the code is taken from the address
and the address cleaned with `history.replaceState` before anything else reads it; `?unlock=` works
too, but the fragment is preferred because it never reaches a web server's access log. The code is
never logged.

> TODO (Mark): the exact Buy Me a Coffee Extra address. `BMC_URL` is
> `https://buymeacoffee.com/mark.westerweel/extras` until then; change that one constant.

**The code** (format v1, shared with the issuer):

```
code    = "BZB1." + b64url(payload) + "." + b64url(sig)      base64url, no padding, 114 characters
payload = 16 bytes: [0] version 1, [1] product 1 (full version),
          [2..5] issued day (uint32 big-endian, days since 1970-01-01 UTC), [6..15] code id (random)
sig     = Ed25519 over "bazibo-unlock-v1" || payload        64 bytes
```

`parseCode` is strict, in the style of `sanitizePayload`: at most 400 characters looked at (spaces
and line breaks from a wrapped mail line dropped; a bare code or a link with `#unlock=`/`?unlock=`),
the prefix, exactly 22 + 86 base64url characters, no padding, unused bits zero (one spelling per
code), version 1, product 1. `verifyCode` checks the signature offline with WebCrypto
(`crypto.subtle.importKey('raw', key, {name: 'Ed25519'})`, `verify`) against `UNLOCK_PUBLIC_KEY`,
then the revocation list. The public key is a parameter, so the tests sign with keys of their own;
the private key lives only with the issuer (a Kubernetes secret) and never in this repo.

**No crypto fallback.** Ed25519 in WebCrypto is in Chrome and Edge 137+, Firefox 129+ and Safari
17+. A browser without it gets "Deze browser is te oud voor codes; probeer Chrome, Firefox of
Safari (bijgewerkt)." and keeps a stored code for when it is updated. A vendored pure-JS Ed25519
(e.g. noble-ed25519, MIT, audited) would be allowed by the vendoring rules, but it is not worth
it: the browsers without Ed25519 are a few years old, the free part works there anyway, and a
hand-vendored signature check is more code to audit than a one-line message.

**Activation, once (Mark, 27 Nov 2026: "geen moeite met 10x gedeeld of op 10 devices, maar 100x een
streep").** After a code passes offline, the website sends one `POST
https://api.westerweel.work/bazibo/activate` with `{"code", "device"}` (`activate`): `device` is a
random 128-bit id made once and kept in localStorage under `bubbels.device`, next to the save (never
in it, never transferred, never derived from the device). The server counts devices per code:

| Answer | Then |
| --- | --- |
| 200 `{"status":"ok"}` | open, the save records `activated: true` |
| 409 `{"error":"limit"}` | not open: "Deze code is al op 10 apparaten gebruikt. Klopt dat niet? Mail mark@westerweel.work." |
| 403 `{"error":"revoked"}` | not open: the revoked message |
| 400 `{"error":"invalid"}` | not open: "De code werd nu niet geaccepteerd. Probeer het later nog eens." (cannot happen for a code that passed offline) |
| 429 `rate`, 403 `origin`, 503 `off`, any 5xx, no network, 5 s without an answer | open anyway (never block a child over our server), `activated: false` |

A code opened with `activated: false` is activated once more, quietly and in the background, on the
first later start while `navigator.onLine`; whatever that answers, it is not tried again
(`retried: true`), unless the answer is 409 or 403 "revoked", which closes it again with the
message. After a successful activation there are no more calls: every start checks the kept code
offline only. The CSP of `web/index.html` allows exactly `connect-src 'self'
https://api.westerweel.work`; in the apps `web/js/app-csp.js`, the first script of the page, adds a
second policy `connect-src 'self'` (both policies are enforced), so the app can never reach it.

**Storage.** The code itself is kept in the save (`webUnlock: {code, activated, retried}`,
`storage.loadWebUnlock`/`saveWebUnlock`), never a bare "owned" flag: the website's `createUnlock`
gets a cache that always says no, and every start verifies the kept code again before the games
draw their menus. A tampered, forged or revoked kept code is cleared and opens nothing (a revoked
one says so). Voortgang overzetten carries the code (`unlockCode` in the payload, only the exact
shape passes `sanitizePayload`; the activation state stays behind): on the other device it is kept
as not yet activated, checked offline at the next start and activated there once, as one more
device. A device that has its own code keeps it. The store purchase never travels.

**Revoking a code.** Add its id (the 10 random bytes of the payload as 20 lowercase hex characters,
as the issuer reports it) to `REVOKED` in `web/js/revoked.js`, with the date and why in a comment;
run `npm run stamp`, open a PR and merge. GitHub Pages deploys on merge; bazibo.nl takes `web/` as
usual. From the next visit that code is refused when entered ("Deze code is ingetrokken. Klopt dat
niet? Mail mark@westerweel.work.") and closes at the next start. The issuer's server refuses it too
(403 `revoked`) for devices that have not activated yet. Offline, the list ships with the site;
nothing is fetched.

**Honest limits.** On the website everything runs in the visitor's own browser, so someone who
edits the page can open it without paying; the code, the device count and the revocation list keep
honest people honest and make a code shared on a large scale useless, not more. The app's store
purchase is unaffected.

## Random play (full version)

With the full version, every game except Vier op een rij (which is endless already) gets a
"Willekeurig" / "Random" card per difficulty in its level list: Bubbels easy, medium and hard;
Dogudoku 4×4 to 8×8; Picturedoku 4×4, 6×6 and 9×9; Slangetje per kind of round and age. Each tap
makes a new board or puzzle on the device from a fresh seed (`crypto.getRandomValues`), with the
same generators that make the fixed levels (`web/games/<id>/generate.js`, also used by `tools/`),
so a random one passes the same checks: Dogudoku and Picturedoku have exactly one solution
(Picturedoku solvable without guessing), Bubbels boards have no loose bubbles and every colour at
least twice, Slangetje walls come from the tested wall layouts. Big puzzles are made in a worker
(`web/js/gen-worker.js`, falling back to the page) so the screen never freezes, and Dogudoku makes
the next one ahead. Random boards keep no stars; the save counts how many were solved per tier
(`games.<id>.random`, only ever going up). After a loss in Bubbels or Slangetje, "Zelfde nog eens"
replays the same board. `tests/random.test.js` checks 200 seeds per tier and prints the timing.
