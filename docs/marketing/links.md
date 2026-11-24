# Links plan: free places that can link to bazibo.nl

Status: a list, nothing done. No account was made and nobody was contacted. Mark (or a session he
asks) picks which ones to do. A link is worth most when the page is about children's apps or
privacy, in Dutch, and the link is followed (no `nofollow`/`ugc`/`sponsored`); a nofollow link
still brings parents, just no ranking.

## 1. Our own places (do first, no sign-up)

- **GitHub repo settings:** the website field says `https://mwest2020.github.io/bazibo/`; set it
  to `https://bazibo.nl/` (`gh repo edit MWest2020/bazibo --homepage https://bazibo.nl/`). Add
  topics: `kids-games`, `educational-games`, `no-ads`, `privacy`, `offline-first`, `pwa`,
  `capacitor`, `dutch`. GitHub marks links in READMEs and the website field nofollow; this is
  for people, and to stop pointing at the mirror.
- **README:** the first lines now link bazibo.nl and Google Play (this PR).
- **Play listing:** the website field is already `https://bazibo.nl/`.

## 2. Open-source credit (earnable, people check these)

Bazibo credits what it uses in `CREDITS.md` and on the privacy pages. Places where projects list
who uses them (check each page first; only ask where a page for that exists):

- **Natural Earth** (the maps in Kaartpuzzel): public domain, credited. They have no list of
  users that we know of; a short mail "your data in a children's map puzzle" is a maybe.
- **Capacitor** (Ionic): look for a "built with Capacitor" showcase; a kids' app with no
  trackers is an unusual example for them.
- **cordova-plugin-purchase** (Fovea): its README and site; a one-line "used by" is a maybe.
- **Nunito** (the font, OFL): no list; skip.

## 3. Directories and catalogues

- **AlternativeTo** (alternativeto.net): free entry; its outbound links are usually nofollow, so
  this is for parents who search "alternative to ...", not for ranking. Proposed entry:
  - Name: Bazibo
  - Short: "Kids' games with no ads and no tracking, ages 3 to 10. Open source."
  - Description: "Bazibo is one app of 24 play-and-learn games for children aged 3 to 10:
    puzzles, board games (checkers, chess, ludo, quartets), drawing and colouring, a toy piano
    and drums, and learning games for letters, maths, telling time and geography. No ads, no
    account, no trackers; it works offline and collects nothing. Every game has a free part; one
    €1 purchase opens everything. Dutch and English. The code is MIT on GitHub."
  - Platforms: Android, Web (online); licence: Open Source (MIT); price: Freemium
  - Tags: kids, educational, no-ads, privacy-focused, offline, open-source
  - Alternative to: Khan Academy Kids, Lingokids, Pok Pok, ABCmouse, Toca Boca World
  - Links: https://bazibo.nl/ and the Play page
- **Exodus Privacy** (reports.exodus-privacy.eu.org): an automatic scan of the Play app for
  trackers. Anyone can request a report for `work.westerweel.bazibo`; a public "0 trackers"
  report is evidence we can link to from the privacy page. No account needed.
- **European Alternatives** (european-alternatives.eu): lists European products by category;
  check whether there is a category for children or education before suggesting it.
- **PeerPush:** its product pages link out with `rel="noopener"` only (followed), both to the
  website and to the app store for mobile apps (checked 24 Nov 2026 on
  peerpush.com/p/bingo-caller, /p/archivemind, /p/accanto; the sponsored slots there are
  `rel="sponsored nofollow noopener"`). The free listing waits in a queue; paid is $45 and up.
  Google treats a paid link that is not marked sponsored as a link scheme, so the paid option is
  a small risk as well as a cost. Free listing: fine. Paying: not worth it for ranking.

## 4. Dutch parents and privacy

- **Mediasmarties** (mediasmarties.nl): an online guide that rates children's media and apps by
  age, kept up weekly; "Mis je iets? Laat het ons weten!" Suggest Bazibo through their contact
  page. The best fit there is: Dutch, about children's apps, read by parents and teachers.
- **Wikiwijs** (wikiwijs.nl): the open learning-material platform for Dutch teachers. Klok
  kijken, Kangoeroe op de getallenlijn, Letters and Kaartpuzzel fit groep 1-6; a short lesson
  page linking to bazibo.nl is a real, followed link from an education site.
- **Mediawijsheid.nl** (Netwerk Mediawijsheid): tips for parents on apps and screen time; pitch
  "an ad-free, tracker-free app for young children" as an example, not as an advert.
- **Ouders van Nu** (oudersvannu.nl) and **J/M Ouders** (jmouders.nl): parenting magazines with
  app tips; pitch a short "spelletjes zonder reclame" angle with the privacy story.
- **Bits of Freedom** (bitsoffreedom.nl): privacy, not app reviews; only as a "no-tracking kids'
  app" example if they write about children and apps.
- **Tweakers** (tweakers.net): the forum has a place to show your own project; a post about
  "a kids' app with no trackers, open source" reaches parents who are developers.
- **Mama blogs:** search for recent posts "apps voor peuters zonder reclame" and offer the app
  for a honest review, without payment.

## 5. Cross-posts (our own writing)

One article per language on why Bazibo has no ads and no trackers and how it is built (a static
web app, Capacitor, no SDKs). Places: a post on dev.to or Medium (nofollow, but read), Hacker
News "Show HN" (the open-source angle), r/opensource and r/androidapps (Reddit is nofollow), and
in Dutch on Tweakers. Each links to bazibo.nl and the repository.

## Pitch line (to adapt)

> Bazibo is een app met 24 kinderspelletjes voor 3 tot 10 jaar, zonder reclame, zonder account
> en zonder tracking; hij werkt offline en verzamelt niets. Elk spel heeft een gratis deel, één
> keer €1 opent alles. De code is open source. https://bazibo.nl/
