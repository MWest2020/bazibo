# Licenties / Licences

## Het werk zelf / the artwork

Alles in `design/brand/` (logo, pictogrammen, adaptieve lagen, winkelbeelden, tokens) is voor
deze opdracht getekend als SVG-code. Er is geen stockbeeld, geen werk van derden en geen
uitvoer van een beeldmodel in gebruikt; er is niets nagetekend.

- Licentie: **CC0-1.0** (publiek domein). Daarmee past het ook in de MIT-licentie van de
  repository en is het vrij te gebruiken in de app, de winkels, de site en de openbare
  repository, zonder naamsvermelding.
- Overdracht: alle rechten zijn voor Bazibo / Mark West.

*Everything under `design/brand/` was drawn as SVG code for this brief. No stock, no
third-party work, no image-model output, nothing traced. Licence: **CC0-1.0**, which is
compatible with the repository's MIT licence. All rights are assigned to Bazibo.*

## Letters / fonts

Alle gebruikte letters staan onder de **SIL Open Font License 1.1 (OFL-1.1)**. De letters in het
logo, de pictogrammen en de winkelbeelden zijn omgezet naar paden; er wordt geen font geladen,
geen CDN en geen Google Fonts-link gebruikt.

| Familie | Gebruik | Licentie | Licentiebestand in het image |
|---|---|---|---|
| **Fredoka** | woordmerk, koppen (`--bz-font-display`) | SIL Open Font License 1.1 | `/opt/habitat/fonts/fredoka/OFL.txt` |
| **Nunito** | tekst, de vertrouwensrij (`--bz-font-text`) | SIL Open Font License 1.1 | `/opt/habitat/fonts/nunito/OFL.txt` |
| **Andika** | lettertegels in de leerspellen (`--bz-font-letters`) | SIL Open Font License 1.1 | `/opt/habitat/fonts/andika/OFL.txt` |

Bij het meeleveren in de app hoort per familie het `OFL.txt`-bestand mee in `web/fonts/<familie>/`.
De OFL staat gebruik in een logo toe, ook na omzetting naar paden; de naam van een afgeleide
mag alleen niet de gereserveerde fontnaam dragen. Het woordmerk heet "Bazibo", niet "Fredoka",
dus daar wordt aan voldaan.

*All fonts used are under the SIL Open Font License 1.1; the text in the logo, icons and store
art is converted to paths, so no font file is loaded at runtime. Ship each family's `OFL.txt`
alongside the font files.*
