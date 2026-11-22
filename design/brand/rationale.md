# Bazibo: drie richtingen en een aanbeveling

Bij de merkbrief in `docs/design/brand-brief.md`. Alles hier is als SVG-code getekend; er is
niets nagetekend, geen stockbeeld, geen beeldmodel. Letters alleen OFL, omgezet naar paden.

**Wat het merk moet zeggen.** Bazibo is één rustige plek waar 23 spelletjes onder één dak staan:
geen reclame, geen account, geen trackers, één keer € 1. Het kind speelt, de ouder kiest. De naam
rijmt op *gazebo*: een prieel, een veilige plek in de tuin. Het merk moet dus **rust en
vertrouwen** zeggen tegen een ouder of leerkracht, en **welkom** tegen een kind, zonder de
reclamegame-grammatica (regenboog, glans, munten, sterren-en-slotjes) en zonder tulpen,
molens of paars-blauwe verlopen.

**Schetsen (eenregelig, voor het bouwen).** 1 Het prieel vlak en met één lijndikte · 2 Een dak
met vijf vakken in de groepskleuren · 3 De b van Bazibo die haar eigen prieel bouwt ·
4 Het dak van bovenaf als zeshoekige rozet · 5 Een zegel met het prieel uitgespaard ·
6 Een zegel met alleen een doorgang · 7 Een luifel, een kind en de grond · 8 Een tuinpoort met
twee spijlen · 9 Een arcade van drie bogen · 10 De plattegrond van het prieel met een drempel ·
11 Een parasol met geschulpte rand · 12 Een lantaarn als los teken.

Van die twaalf zijn er drie gebouwd, getest op 24, 48 en 192 px, op licht en op donker.
Afgevallen na het kijken: 2 en 4 (als rozet een gekleurd windmolentje, precies de regenbooglook),
3 (de b las niet als een b), 5 (lijkt op het eject-teken), 7 (een boog met een stip eronder las
als een wenkbrauw met een oog), 11 (een parasol ligt te dicht bij bestaande verzekeringsmerken).

## Direction A Prieel

*Het prieel zelf, vlak getekend: een dak van 45 graden met een vlakke nok op twee staanders, een
vloerlijn, en een lantaarn die aan het dak hangt.*

- **Idee.** Je kijkt het prieel in. Het dak beschermt, de open zijkanten nodigen uit, de lantaarn
  is het rustpunt in het midden: één warm licht in plaats van scores, munten en sterren. Het is
  de verfijning van het logo dat er al is (`web/js/logo.js`), maar vlak, zonder verlopen, zonder
  de bubbel die het merk aan één spel vastklonk, en met één lijndikte (26 van 256) die tot 24 px
  overeind blijft.
- **Palet.** A Papier: warm papier `#fbf7f0`, inkt `#28245c` (13,1:1), zachte inkt `#5a5585`
  (6,4:1), merkviolet `#4f43c4` (wit erop 7,2:1). Het violet dat Bazibo al heeft, maar rustiger
  en op papier in plaats van op lilablauw. De lantaarn in `#b97f0a` is ook het leren-accent.
- **Letter.** Fredoka voor het woordmerk en koppen, Nunito voor tekst, Andika voor de
  lettertegels. In het woordmerk is de punt op de i vervangen door een klein dak: het beeldmerk
  keert terug in de letter, en dat maakt het woordmerk van Bazibo in plaats van van het font.
- **Hoe het de brief haalt.** Rustig en herkenbaar Nederlands door toon, niet door symbolen; de
  vijf groepsaccenten staan los van het logo, dus het merk wordt nooit een regenboog; drie
  kleuren in het merk, één lijndikte, geen glans; op 24 px blijft dak + staanders + lantaarn
  leesbaar; het werkt in één kleur (de monochrome laag) en omgekeerd op donker.
- **Risico's.** Een dak op staanders ligt dicht bij het generieke huisje-pictogram: het verschil
  zit in de open zijkanten, de brede eaves en de lantaarn — op 16 px valt dat verschil weg.
  De lantaarn kan als slinger of schietlood gelezen worden; in de grotere maten verdwijnt die
  lezing. Het is de drukste van de drie op 24 px.

## Direction B Zegel

*Een ronde terracotta zegel met een lage boog uitgespaard: de open kant van het prieel.*

- **Idee.** Het prieel teruggebracht tot één ding: de weg naar binnen. Een zegel is de vorm van
  vertrouwen (een keurmerk), en dat is precies wat een ouder in de winkel zoekt. Eén pad met
  `fill-rule="evenodd"`: de doorgang is een echt gat, dus het merk werkt in één kleur, op elke
  achtergrond en als sjabloon in de app.
- **Palet.** C Avondtuin: `#f6f1e7` papier, inkt `#2c3a2e` (10,6:1), zachte inkt `#5b6658`
  (5,4:1), terracotta merk `#b4532f` (wit erop 5,0:1) — het dak van het prieel als merkkleur.
- **Letter.** Dezelfde set als A; het woordmerk doet hier meer werk, want het zegel alleen zegt
  niet "spelen en leren".
- **Hoe het de brief haalt.** Veruit het sterkst klein: op 24 px nog altijd een duidelijke schijf
  met een boog. Eén kleur, geen glans, geen verloop. Warm en aards, ver van de reclamegame-look.
- **Risico's.** Het zegt "ingang" en "betrouwbaar", maar niets over kinderen of spelen; het kan
  als tunnel of als algemene deur-icoon gelezen worden; een volle schijf is zwaarder en
  zakelijker dan een prentenboek.

## Direction C Plattegrond

*Het prieel van bovenaf: een zeshoekige ring met aan de voorkant een drempel in warm goud.*

- **Idee.** De plattegrond in plaats van het aanzicht. De zeshoek is meteen het bouwblok van het
  systeem: de vijf groepen kunnen dezelfde tegel krijgen, elk met eigen accent én eigen
  pictogram. De gouden drempel is de stap naar binnen en het enige warme punt.
- **Palet.** B Polder: `#f2f5f4` basis, inkt `#1f2e3d` (12,6:1), zachte inkt `#4c5d6b` (6,2:1),
  groen merk `#2f6b5e` (wit erop 6,2:1), drempel `#a8790e`.
- **Letter.** Dezelfde set als A.
- **Hoe het de brief haalt.** Koel, open en opgeruimd, als een schoolbord of een klaslokaal; het
  meest systematisch van de drie; één lijndikte, twee kleuren, scherp op elke maat.
- **Risico's.** Het meest abstract: zonder het woordmerk zegt een zeshoek niets, en hij kan als
  badge, moer of scheikundeteken gelezen worden. Het minst warm van de drie, en de drempel is op
  24 px bijna een losse veeg.

## Recommendation

**A Prieel.** Het is de enige van de drie die de naam uitlegt zonder woorden: Bazibo is het
prieel, en je kijkt er zo in. Het houdt de herkenning vast die in de winkel al is opgebouwd
(een prieel op violet), maar haalt er alles uit wat de stijlaudit als "druk" aanwees: het
verloop, de bubbel die naar één spel verwees, de dubbele glansschaduw, de vijf lijndiktes.
Wat overblijft is warm, vlak en rustig, met één rustpunt in het midden — en dat is precies het
verschil dat Bazibo wil verkopen tegenover de reclamegames.

B is de sterkste als alleen het pictogram telt; als Mark het merk vooral klein ziet staan
(storelijsten, favicon, tabbladen), is B de veilige keuze. C is de mooiste basis voor een
tegelsysteem, maar vraagt het woordmerk om iets te betekenen.

**Wat nog aandacht vraagt bij A.** Op 16 px zou ik een vereenvoudigde snede maken (lantaarn
iets groter, vloer iets korter). Het Play-pictogram staat nu op het merkviolet; op een papieren
achtergrond wordt het zachter maar valt het in de winkel minder op — dat is een keuze voor Mark.
En: een merkenrechtelijke controle (merkenregister, reverse image search) kan ik niet doen en
moet voor de lancering nog gebeuren.
