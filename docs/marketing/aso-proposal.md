# ASO proposal: the Google Play listing (NL and EN)

Status: **proposal, not applied.** A listing change is a store submission and Mark decides those.
Nothing in `store/` changed. To apply: edit `store/listing-nl.md` and `store/listing-en.md` as below,
`npm test` (it checks Play's limits), then `fastlane android metadata` (docs/release.md, section 6).

The words parents type, in order of how much they matter here: *kinderspelletjes*, *spelletjes
voor kinderen*, *peuter* / *kleuter*, *leerspelletjes* / *educatieve spelletjes*, *zonder
reclame*, *offline* / *zonder internet*, and the subjects (*puzzels*, *letters*, *rekenen*, *klok
kijken*). In English: *kids games*, *learning games*, *toddler* / *preschool*, *no ads*,
*offline*. Play reads the title most, then the short description, then the long description
(the first lines count most, and repeating a word many times counts against you).

Every number below was checked with `check()` from `tools/store-to-fastlane.mjs` on the current
texts with these changes applied.

## Title (max 30)

| | Now | Proposed | Length |
|---|---|---|---|
| NL | Bazibo: spelen en leren | **Bazibo: kinderspelletjes 3-10** | 29 |
| EN | Bazibo: play and learn | **Bazibo: kids learning games** | 27 |

"Spelen en leren" is our tagline, but nobody searches for it; *kinderspelletjes* is what Dutch
parents type. Play does not allow "gratis", "geen reclame", "best" or "#1" in a title, so the
promise stays in the short description. The App Store name can follow the same change later.

## Short description (max 80)

| | Now | Proposed | Length |
|---|---|---|---|
| NL | 24 spellen voor kinderen van 3-10. Geen reclame, geen account, geen trackers. | **Kinderspelletjes zonder reclame: puzzels, letters, rekenen, klok kijken. Offline** | 80 |
| EN | 24 games for children aged 3 to 10. No ads, no account, no trackers. | **Kids' games with no ads: puzzles, letters, maths, telling time. Works offline.** | 78 |

A quieter alternative that keeps the trackers promise (NL 77, EN 76):
"Spelletjes voor peuters tot 10 jaar. Geen reclame, geen tracking, werkt offline." /
"Games for toddlers to 10-year-olds. No ads, no tracking, works offline."

## Long description (max 4000; now 3991 NL, 3997 EN)

Both are almost full, so every word added replaces one. Four changes per language:

**1. The first paragraph** (the part Play shows before "more", and the part search reads most):

NL, replace
> Bazibo: vierentwintig spelletjes voor kinderen van 3 tot 10 jaar, zonder reclame. De naam komt van "bāzi", Perzisch voor spel.

with
> Kinderspelletjes zonder reclame en zonder tracking: 24 spelletjes voor peuters, kleuters en kinderen tot 10 jaar. Puzzels, bordspellen, tekenen, muziek en leerspelletjes voor letters, rekenen en klok kijken. Werkt offline.

EN, replace
> Bazibo: twenty-four games for children aged 3 to 10, with no ads, and more will follow. The name comes from "bāzi", Persian for play.

with
> Kids games with no ads and no tracking: 24 games for toddlers, preschoolers and children up to 10. Puzzles, board games, drawing, music and learning games for letters, maths and telling time. Works offline.

(The line about the name moves to the website; it helps nobody find the app.)

**2. Section headings:** `LEREN` → `LEERSPELLETJES`; `LEARNING` → `LEARNING GAMES`.
`GEEN RECLAME, NOOIT` → `GEEN RECLAME, GEEN TRACKING`; `NO ADS, EVER` → `NO ADS, NO TRACKING`.

**3. No double "offline":** under GEMAAKT VOOR KINDEREN drop "Werkt zonder internet." (EN: "Works
without internet."), now in the first paragraph.

**4. The links at the end:** the four lines (privacy, terms, plans, source) become two; the privacy
policy has its own field in Play anyway.
> Privacy en plannen: https://bazibo.nl
> Open source (MIT): https://github.com/MWest2020/bazibo

EN: "Privacy and roadmap: https://bazibo.nl" and "Open source (MIT): https://github.com/MWest2020/bazibo".

Result: **NL 3987, EN 3978** characters.

The game count (24) is in the first line because numbers draw the eye; it must change with every
new game. The feature graphics carry no count, so they never go stale.

## Reviews

- Honest reviews only: Play forbids paying or rewarding anyone for a review.
- No in-app review prompt: Play's In-App Review API is a native library outside the four we allow
  (AGENTS.md, hard rules). Ask parents you know who really use it, and mention it in the mail
  answer to anyone who writes to hallo@bazibo.nl with praise.
- Answer every review in Play Console, short and kind, also the bad ones; answers are public and
  parents read them.

## Not in this proposal

- The App Store texts (subtitle, keywords): wait until the app is live there.
- Screenshots and the feature graphic: the new brand's set is in `design/brand/store/`; swapping
  them is a separate store submission.
