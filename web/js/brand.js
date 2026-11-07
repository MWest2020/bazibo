// The brand: one app, several games, one purchase. The name and tagline live only here (the
// store texts, web/manifest.webmanifest and capacitor.config.json repeat the name by hand).
// Bazibo (issue #2, Mark 2026-11-07): from "bāzi", the Persian word for play; it rhymes with
// gazebo, which is the logo (web/js/logo.js). `lore` is the one quiet line about the name.
export const BRAND = Object.freeze({
  name: 'Bazibo',
  tagline: Object.freeze({ nl: 'Spelen en leren, zonder reclame', en: 'Play and learn, no ads' }),
  lore: Object.freeze({ nl: 'Bazibo: “bāzi” betekent spelen', en: 'Bazibo: “bāzi” means play' }),
});
