---
status: current
last_reviewed: 2026-11-21
---

# Merkbrief Bazibo / Bazibo brand brief

Om te geven aan een externe ontwerper of ontwerptool. Alleen het merk (logo, kleuren, letter,
winkel, site, startscherm); de spellen houden hun eigen SVG-stijl. Achtergrond:
[style-audit.md](style-audit.md). *English version below.*

## Nederlands

**Wat Bazibo is.** Eén app met 23 speel-en-leerspelletjes voor kinderen van 3 tot 10 jaar
(puzzels, bordspellen, creatief, leren, actie), in het Nederlands en Engels. Eén keer € 1 opent
alles. Geen reclame, geen account, geen trackers, werkt zonder internet, open source (MIT),
PEGI 3. Live op Google Play; de App Store volgt. De naam komt van "bāzi" (Perzisch: spel) en rijmt
op *gazebo*: een prieel, een veilige plek in de tuin om te spelen.

**Voor wie.** 1) ouders die op privacy letten; 2) leerkrachten van kleuters en groep 1-4 in
Nederland en Vlaanderen; 3) mensen die open source belangrijk vinden. Het kind speelt, de ouder
kiest. "Geen reclame" alleen onderscheidt niet meer: veel kinderapps zeggen dat.

**Het gevoel.** Rustig, betrouwbaar, niet verslavend, herkenbaar Nederlands. Denk aan een
goed prentenboek of een opgeruimd klaslokaal: warm, helder, met ruimte. Nederlands door toon en
inhoud (ganzenbord, dammen, kwartet, de getallenlijn), niet door symbolen.

**Vermijden.** De drukke reclamegame-look (verzadigde regenboog, glimmende 3D-knoppen, munten,
scores, sterren-en-slotjes-kaarten, alles beweegt). Clichés: tulpen, molens, klompen, oranje,
Delfts blauw als decor. AI-ontwerpclichés: paars-blauwe verlopen, glas-effect, glimmende 3D-blobs,
sparkle-icoontjes, "Corporate Memphis"-figuurtjes, confetti, emoji als illustratie, alles in Inter.
Niets dat lijkt op een bestaand merk of personage.

**Uitgangspunt, vrij om te herzien.** Het prieel (gazebo). Het huidige logo (een prieel met een
bubbel, `web/js/logo.js`) mag helemaal opnieuw. Een eerdere schets: drie richtingen in
`docs/design/logo-*.svg`, alleen ter inspiratie.

**Kleur.** Een rustige basis plus één accent per spelgroep. Elke richting hieronder is
nagemeten: tekst AA (4,5:1 of meer), accenten 3:1 of meer op de basis voor vormen. Geen vijf
kleuren zijn voor iedereen met kleurenblindheid uit elkaar te houden, dus een groep heeft altijd
ook een eigen icoon en naam; kleur is nooit het enige teken.

| Richting | Basis | Inkt / zacht | Merk (wit erop) | Accenten: puzzels, bord, creatief, leren, actie |
|---|---|---|---|---|
| A Papier | `#fbf7f0` | `#28245c` (13,1) / `#5a5585` (6,4) | `#4f43c4` (7,2) | `#2a8f88` `#d9663f` `#c8508a` `#b97f0a` `#3f86d0` |
| B Polder | `#f2f5f4` | `#1f2e3d` (12,6) / `#4c5d6b` (6,2) | `#2f6b5e` (6,2) | `#2f7d6d` `#c4573a` `#a8457e` `#a8790e` `#2f6fc0` |
| C Avondtuin | `#f6f1e7` | `#2c3a2e` (10,6) / `#5b6658` (5,4) | `#b4532f` (5,0) | `#3a8a6e` `#b4532f` `#a64a86` `#9a7a12` `#3f6fb0` |

A houdt het Bazibo-violet, rustiger, op warm papier. B is koel en open, als lucht boven de polder,
met een groen merk. C is warm en aards, met een terracotta merk als het dak van het prieel.
Kleinste afstand tussen twee accenten bij deuteranopie (CIEDE2000): A 4,3, B 5,0, C 5,2; daarom
de regel hierboven. Een eigen palet mag ook, met dezelfde metingen.

**Letter.** Alleen SIL Open Font License, in de app meegeleverd (geen CDN, geen Google Fonts-link).
Kandidaten: Nunito alleen (rond, warm, variabel gewicht); Fredoka voor koppen met Nunito voor
tekst; Baloo 2 met Lexend. Voor lettertegels in de leerspellen Andika (SIL, gemaakt voor
beginnende lezers). Minimaal 16 px voor alles wat een kind moet lezen.

**Op te leveren.**
1. Logo: volledig (beeldmerk + woordmerk), beeldmerk los, woordmerk los; SVG en PNG; licht en
   donker; leesbaar op 24 px.
2. Play-icoon 512 x 512 PNG (32-bit) met de belangrijke vorm binnen het midden (Google rondt af);
   App Store-icoon 1024 x 1024 zonder transparantie.
3. Android adaptive icon: voor- en achtergrondlaag 108 x 108 dp, beeld binnen de veilige cirkel
   van 66 dp; plus een monochrome laag.
4. Feature graphic 1024 x 500 (PNG zonder alpha of JPG) met logo, regel en de vertrouwensrij
   "PEGI 3 · geen gegevens verzameld · geen reclame · open source".
5. Sjabloon voor winkelscreenshots, 1080 x 1920: kop boven, echte schermafbeelding, vertrouwensrij
   onder; NL en EN.
6. Tokens: kleuren (basis, inkt, merk, per groep accent, tint en tekstkleur) en letters (familie,
   schaal, gewichten) als tabel of CSS custom properties.

**Rechten.** Wij krijgen alle rechten (overdracht, of CC0 / MIT-compatibel) voor gebruik in app,
winkel, site en open-source repository. Geen stockbeeld met beperkingen, geen werk van anderen,
geen AI-uitvoer die op merken of stijlen van anderen lijkt. Letters alleen OFL. Licenties van
alles wat erin zit worden meegeleverd.

**Technische grenzen.** SVG zonder externe verwijzingen (geen `<image href>`, geen webfonts,
geen `url(#)`-id's die botsen; tekst in het logo omgezet naar paden). Geen CDN, geen bouwstap:
alles moet als losse bestanden in `web/` passen. Strakke CSP: geen inline styles.

## English

**What Bazibo is.** One app with 23 play-and-learn games for children of 3 to 10 (puzzles, board
games, creative, learning, action), in Dutch and English. One €1 purchase opens everything. No
ads, no account, no trackers, works offline, open source (MIT), PEGI 3. Live on Google Play; the
App Store follows. The name comes from "bāzi" (Persian: play) and rhymes with *gazebo*: a safe
place in the garden to play.

**For whom.** 1) privacy-aware parents; 2) teachers of kleuters and groep 1-4 in the Netherlands
and Flanders; 3) the open-source crowd. The child plays, the parent chooses. "No ads" alone no
longer stands out.

**The feeling.** Calm, trustworthy, non-addictive, recognisably Dutch: a good picture book or a
tidy classroom; warm, clear, room to breathe. Dutch through tone and content, not symbols.

**Avoid.** The busy ad-game look (saturated rainbow, glossy 3D buttons, coins, scores, star-and-
padlock maps, everything moving). Clichés: tulips, windmills, clogs, orange, Delft blue as
decoration. AI-design clichés: purple-blue gradients, glassmorphism, glossy 3D blobs, sparkle
icons, Corporate Memphis figures, confetti, emoji as illustration, Inter everywhere. Nothing that
resembles an existing brand or character.

**Starting point, free to redo.** The gazebo. The current logo (a gazebo with a bubble,
`web/js/logo.js`) may be replaced entirely; earlier sketches in `docs/design/logo-*.svg` are
inspiration only.

**Colour.** A calm base plus one accent per game group; the three directions in the table above
(A Paper: the Bazibo violet, calmer, on warm paper; B Polder: cool and open with a green brand;
C Evening garden: warm and earthy with a terracotta brand). All text pairs AA (ratios in the
table), accents 3:1 or more on the base. No five colours stay apart for every kind of colour
blindness (closest pair under deuteranopia, CIEDE2000: A 4.3, B 5.0, C 5.2), so a group always
has its own icon and name too; colour is never the only cue. Your own palette is welcome if it
meets the same checks.

**Type.** SIL Open Font License only, shipped inside the app (no CDN, no Google Fonts link).
Candidates: Nunito alone; Fredoka for headings with Nunito for text; Baloo 2 with Lexend; Andika
(SIL, made for beginning readers) for the letter tiles. 16 px minimum for anything a child reads.

**Deliverables.** As in the Dutch list: 1) logo (full, mark, wordmark; SVG and PNG; light and
dark; legible at 24 px); 2) Play icon 512 x 512 32-bit PNG with the key shape inside the centre
(Google rounds it), App Store icon 1024 x 1024 without alpha; 3) Android adaptive icon, foreground
and background layers at 108 dp with the art inside the 66 dp safe circle, plus a monochrome
layer; 4) feature graphic 1024 x 500 with logo, line and the trust row "PEGI 3 · no data
collected · no ads · open source"; 5) store screenshot template 1080 x 1920 (caption, real
screen, trust row), NL and EN; 6) colour and type tokens as a table or CSS custom properties.

**Rights.** Full rights to us (assignment, or CC0 / MIT-compatible) for the app, the stores, the
site and the public repository. No restricted stock, no third-party work, no AI output resembling
others' marks or styles; fonts OFL only; licences of everything included are delivered with it.

**Technical limits.** SVG without external references (no `<image href>`, no web fonts, text in
the logo converted to paths, no colliding `url(#)` ids). No CDN, no build step: everything ships
as plain files in `web/`. A strict CSP: no inline styles.
