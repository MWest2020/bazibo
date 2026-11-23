# Bazibo, merk ronde 3: de keuze afgemaakt

Mark koos uit ronde 2: **"Knipsel met verschillende kleuren, lettertype van Kralen."** Deze
levering is precies die combinatie, afgemaakt: het geknipte beeldmerk van Knipsel, nu in de vijf
kleuren van de spelgroepen, met de getekende letters en het palet van Kralen. Eén richting, geen
nieuwe ideeën. Alles hieronder is door mij getekend als SVG-padgegevens; tekst in de winkelset is
omgezet naar paden met OFL-letters (zie `LICENSES.md`).

De drie richtingen van ronde 2 (`directions/knipsel/`, `directions/kralen/`, `directions/mees/`)
blijven staan als geschiedenis, met hun oorspronkelijke paletten; de ronde-2-sets in `logo/`,
`icon/`, `adaptive/` en `store/` zijn vervangen.

## Wat het merk moet zeggen

Eén app, vijf soorten spel, gemaakt in plaats van gegenereerd; rustig in gebruik, vrolijk in
vorm; geen reclamegame-look, geen AI-clichés, geen bubbels, geen prieel-als-geometrie. Op 24 en
48 px moet het staan, want daar leeft het: favicon, tabblad, lijstje met apps.

## Hoe de twee gekozen stukken samen één merk worden

**Het beeldmerk.** Een kleine **b**, met een schaar uit crème papier geknipt, op een snipper. De
contramal van de b is geen rondje maar een **dakje**: het prieel, verstopt in de letter. Geen
enkele rand is recht of evenwijdig; de b-bak is nergens een echte cirkel. Nieuw in ronde 3: de b
ligt niet meer op één terracotta snipper, maar op een **stapeltje van vijf snippers** — één per
spelgroep. De grote snipper is de bordspelkleur (`#d9663f`); okergeel (leren), teal (puzzels),
roze (creatief) en blauw (actie) piepen er aan vier kanten onderuit, elk met vijf schaarknippen
gesneden. Zo zit het hele systeem in het merk: één b, vijf soorten spel.

**De variant per spelgroep** (`logo/mark-learning.svg` enzovoort) draait die stapel: de b ligt op
de snipper van die groep, de andere vier schuiven eronder door, in de vaste ring bordspellen →
actie → puzzels → leren → creatief. Voor koppen, tegels en gedeelde schermen in de app.

**Het woordmerk.** De getekende letters van Kralen, ongewijzigd: ronde bakken met ongelijke dikte
— zwaarder aan de voet dan aan de schouder — op een dansende lijn, elke letter een paar graden
gedraaid. Geen font: de naam is getekend. Het puntje op de i is de kraal uit Kralen, en die kraal
heeft nu de kleur van de grote snipper (`#d9663f`), zodat woordmerk en beeldmerk elkaar vasthouden.
De letters zelf blijven inkt (`#28245c`), crème op het donkere veld.

**Het palet.** Dat van Kralen, ongewijzigd: basis `#fbf7f0`, inkt `#28245c` (13,1:1), zacht
`#5a5585` (6,4:1), merkviolet `#4f43c4` voor knoppen en links (wit erop 7,2:1), en de vijf
groepsaccenten `#b97f0a` `#2a8f88` `#d9663f` `#c8508a` `#3f86d0` met hun tint en tekstkleur.
Gemeten: elk accent haalt 3,2:1 of meer op de basis en 3,3:1 of meer op de inkt, elke tekstkleur
4,5:1 of meer op de basis en op zijn eigen tint. De crème letter op een snipper meet 3,2:1 (oker)
tot 4,0:1 (roze): vormcontrast, boven de 3:1 die de brief vraagt. Kleur is nooit het enige teken —
elke groep houdt zijn eigen icoon en zijn naam.

**De letter.** Fredoka voor koppen, Nunito voor tekst, Andika voor de lettertegels in de
leerspellen; vanaf 16 px.

## De twee opstellingen die ik tegen elkaar heb gezet

Geen nieuwe ideeën, wel één eerlijke keuze binnen het gekozen idee: hoe liggen die vijf snippers?
Beide zijn gebouwd, gerenderd en op 192, 48 en 24 px bekeken, op papier en op inkt.

## Direction knipsel-kleur — "Knipsel in kleur" (aanbevolen, dit is de levering)

**Idee.** De grote snipper blijft de held en vult het vlak; de vier andere piepen er als smalle,
scheve stukjes onderuit — linksboven blauw, rechtsboven teal, links oker, rechtsonder roze.

**Palet en letter.** Zie hierboven; dit zijn de paletwaarden van `tokens.json`.

**Hoe het de brief haalt.** Het is kleurrijk van zichzelf (vijf kleuren in het beeldmerk), het is
onmiskenbaar geknipt in plaats van uitgerekend, en de b blijft groot: op 48 px lees je de letter
én het dakje, op 24 px een gekleurde stapel met een crème b. Het draagt een systeem (snipper per
groep) en het past in een vierkant icoon zonder trucjes.

**Risico's.** Een gekleurd vlak met een letter erin is ook de vorm van elk ander app-icoon; de
snippers eromheen moeten het onderscheid maken, en op 16 px worden die randjes stof. Een lettermerk
zegt bovendien niets over spelen — het dakje in de b is de enige knipoog, en die is klein.

## Direction knipsel-waaier — "Knipsel waaier" (afgevallen)

**Idee.** Dezelfde b op dezelfde snipper, maar de vier andere snippers liggen als een waaier
achter de held, elk met een flinke hoek naar buiten.

**Palet en letter.** Gelijk aan de aanbevolen richting.

**Waarom afgevallen.** Kleurrijker op het eerste gezicht, maar de held moet 26 % kleiner om de
waaier binnen het vlak te houden, en daarmee krimpt de letter. Op 24 px is het resultaat een
bloemetje van vlakken waarin de b verdwijnt; op het donkere veld wordt het rommelig. Mark vroeg om
"goed doen op 24 en 48 px", en daar verliest de waaier van de stapel.

## Wat ik onderweg heb weggegooid

1. *De grote snipper in violet* (het merkviolet van Kralen) — mooiste contrast met crème (7,2:1),
   maar dan is het merk niet meer de terracotta die Mark koos, en violet is de UI-kleur.
2. *De b uit vijf gekleurde stukjes* — de letter zelf in vijf kleuren geknipt: valt op 24 px uit
   elkaar en de groepskleuren worden onleesbaar klein.
3. *Een diepere terracotta voor de held* (`#b4532f`, 4,7:1 met crème) — beter contrast, maar dan
   staat de snipper los van de accentkleur van de bordspellen; één palet is belangrijker.
4. *Snippers als nette rechthoekjes* — de eerste versie; die lazen als gedraaide vierkanten, niet
   als knipsels. Nu heeft elke snipper vijf knippen en geen twee evenwijdige randen.
5. *Confetti rondom in de feature graphic* — vrolijk, maar het is precies de drukte die de brief
   uitsluit.

## Recommendation

**knipsel-kleur.** Het is de combinatie die Mark koos, nu echt kleurrijk, en het is de enige van
de twee die op 24 px nog een letter is. De volledige set in deze levering (`logo/`, `icon/`,
`adaptive/`, `store/`, `tokens.json`, `tokens.css`) is voor deze opstelling gebouwd.

**Wat ik zou doen vóór productie.** (1) Een merkenonderzoek laten doen — ik kan geen merkvrijheid
garanderen. (2) Het icoon één keer op een echt toestel tussen andere iconen zetten; Play rondt af
en dat haalt de hoekpunten van de snippers weg. (3) Op 16 px (favicon) de snippers wegsnoeien als
ze dichtslaan: een kleine-maat-versie met alleen de held en de b ligt klaar in de monochrome laag.

### Wat er in de map staat

- `logo/` — `mark`, `wordmark`, `wordmark-dark` (crème letters voor het inktveld), `full-light`,
  `full-dark` als SVG en PNG, `mark-24.png` en `mark-96.png` met transparantie, en
  `mark-learning|puzzles|board|creative|action` (SVG + PNG op 96 px) voor gebruik in de app.
- `icon/` — `icon.svg` als bron, `play-512.png` (32-bit, dekkend, sleutelvorm binnen Play's
  keyline) en `appstore-1024.png` (zonder alfakanaal).
- `adaptive/` — voor-, achter- en monochrome laag, 108 dp op 4x (432 px), beeld binnen de veilige
  cirkel van 66 dp; de monochrome laag is één kleur met de b en het dakje uit de snipper gesneden,
  de achtergrond is dekkend inkt.
- `store/` — feature graphic 1024 x 500 en screenshotkaders 1080 x 1920 in NL en EN, met kop, vlak
  voor de echte schermafbeelding en de vertrouwensrij. Alle tekst is omgezet naar paden. In het
  Engelse kader ontbrak "· no ads" in de vertrouwensrij (een fout uit ronde 2, de ruimte stond er
  wel); die staat er nu, in dezelfde Nunito-omtrek als de rest van de regel.
- `directions/` — `knipsel-kleur/` en `knipsel-waaier/` zijn de twee opstellingen van ronde 3, elk
  met `mark.svg`, `tokens.json` en `preview.png` (het merk op 192, 48 en 24 px, op papier en op
  inkt, met de stalen eronder). `knipsel/`, `kralen/` en `mees/` zijn ronde 2, als geschiedenis.
- `tokens.json` / `tokens.css` — kleuren en letters, met de gemeten verhoudingen in de CSS.
