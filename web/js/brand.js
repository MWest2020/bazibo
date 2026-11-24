// The brand: one app, several games, one purchase. The name and tagline live only here (the
// store texts, web/manifest.webmanifest and capacitor.config.json repeat the name by hand, and so
// do the search-engine copies in the HTML heads; tests/seo.test.js checks those against this).
// Bazibo (issue #2, Mark 2026-11-07): from "bāzi", the Persian word for play (a game); it rhymes with
// gazebo: the little roof in the logo's b (web/js/logo.js). `lore` is the one quiet line about the name.
export const BRAND = Object.freeze({
  name: 'Bazibo',
  tagline: Object.freeze({ nl: 'Spelen en leren, zonder reclame', en: 'Play and learn, no ads' }),
  lore: Object.freeze({ nl: 'Bazibo: “bāzi” betekent spel', en: 'Bazibo: “bāzi” means play' }),
});
