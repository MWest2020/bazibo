// Every visible string, in Dutch and English. The shell's strings are below; each game adds its
// own with addStrings() (web/games/<id>/strings.js). `npm test` checks that every key exists in
// both languages with the same {placeholders}. {brand} is always the brand name.
import { BRAND } from './brand.js';

export const LANGS = ['nl', 'en'];
export const FALLBACK = 'nl';

const TABLES = { nl: {}, en: {} };
let current = FALLBACK;
const listeners = new Set();

export function addStrings(table) {
  for (const l of LANGS) Object.assign(TABLES[l], table[l]);
}

/** Both tables, for the tests. */
export function allStrings() {
  return TABLES;
}

/** The saved choice if there is one, else the first device language we speak, else Dutch. */
export function pickLang(saved, preferred = []) {
  if (LANGS.includes(saved)) return saved;
  for (const p of preferred) {
    const base = String(p || '').toLowerCase().split('-')[0];
    if (LANGS.includes(base)) return base;
  }
  return FALLBACK;
}

export function getLang() {
  return current;
}

export function setLang(lang) {
  if (!LANGS.includes(lang) || lang === current) return;
  current = lang;
  for (const fn of listeners) fn(lang);
}

export function onLangChange(fn) {
  listeners.add(fn);
}

export function t(key, vars = {}) {
  const s = TABLES[current][key] ?? TABLES[FALLBACK][key] ?? key;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : k === 'brand' ? BRAND.name : m));
}

/** Fill [data-i18n] (text) and [data-i18n-aria] (aria-label) inside `root`. */
export function translateDom(root) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
}

addStrings({
  nl: {
    'common.ok': 'Oké',
    'common.back': 'Terug',
    'common.later': 'Later',
    'common.cancel': 'Annuleren',
    'home.games': 'Spellen',
    'home.settings': 'Instellingen',
    'home.soon': 'binnenkort',
    'home.promise': 'Geen reclame. Nooit.',
    'soon.title': 'Komt eraan!',
    'soon.text': 'Aan dit spel wordt nog gewerkt. Tot die tijd: veel plezier met de andere spellen!',
    'games.sudoku': 'Plaatjes\u00ADsudoku',
    'settings.title': 'Instellingen',
    'settings.language': 'Taal',
    'settings.sound': 'Geluid',
    'settings.on': 'Aan',
    'settings.off': 'Uit',
    'settings.full': 'Volledige versie',
    'settings.fullOwned': 'Gekocht: alle levels van alle spellen zijn open.',
    'settings.fullApp': 'Eén keer betalen, dan gaat alles open, in alle spellen.',
    'settings.fullWeb': 'De volledige versie zit in de {brand}-app voor Android en iPhone.',
    'settings.more': 'Meer over de volledige versie',
    'settings.privacy': 'Privacy',
    'offer.title': 'Volledige versie',
    'offer.app': 'In de volledige versie gaan alle levels van alle spellen open. Eén keer betalen{price}, geen reclame, geen abonnement. Vraag het aan je papa of mama!',
    'offer.web': 'De volledige versie, met alles van alle spellen, zit in de {brand}-app voor Android en iPhone. Op deze website speel je het gratis deel zo vaak als je wilt!',
    'offer.owned': 'Je hebt de volledige versie al: alles is open.',
    'offer.buy': 'Voor ouders: kopen',
    'offer.restore': 'Aankoop herstellen',
    'busy.title': 'Even geduld…',
    'busy.text': 'De winkel van je telefoon is bezig.',
    'unlocked.bought': 'Gelukt!',
    'unlocked.restored': 'Hersteld!',
    'unlocked.text': 'Alles is open. Veel plezier!',
    'unlocked.go': 'Verder',
    'pending.title': 'Bijna klaar',
    'pending.text': 'De betaling wordt nog verwerkt. Daarna gaat alles vanzelf open.',
    'problem.title': 'Dat lukte niet',
    'problem.noAnswer': 'De winkel gaf geen antwoord. Probeer het later nog eens.',
    'problem.noPurchase': 'Er is geen aankoop gevonden bij dit account.',
    'gate.title': 'Vraag voor ouders',
    'gate.lead': 'Typ het antwoord in cijfers.',
    'gate.wrong': 'Dat klopt niet. Nieuwe vraag:',
    'gate.label': 'Antwoord (in cijfers)',
    'gate.ok': 'OK',
    'error.title': 'Oeps',
    'error.retry': 'Opnieuw',
  },
  en: {
    'common.ok': 'OK',
    'common.back': 'Back',
    'common.later': 'Later',
    'common.cancel': 'Cancel',
    'home.games': 'Games',
    'home.settings': 'Settings',
    'home.soon': 'coming soon',
    'home.promise': 'No ads. Ever.',
    'soon.title': 'Coming soon!',
    'soon.text': 'This game is still being made. Until then, have fun with the other games!',
    'games.sudoku': 'Picture Sudoku',
    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.sound': 'Sound',
    'settings.on': 'On',
    'settings.off': 'Off',
    'settings.full': 'Full version',
    'settings.fullOwned': 'Bought: every level of every game is open.',
    'settings.fullApp': 'Pay once and everything opens, in every game.',
    'settings.fullWeb': 'The full version is in the {brand} app for Android and iPhone.',
    'settings.more': 'More about the full version',
    'settings.privacy': 'Privacy',
    'offer.title': 'Full version',
    'offer.app': 'The full version opens every level of every game. Pay once{price}, no ads, no subscription. Ask your mum or dad!',
    'offer.web': 'The full version, with everything in every game, is in the {brand} app for Android and iPhone. On this website you can play the free part as often as you like!',
    'offer.owned': 'You already have the full version: everything is open.',
    'offer.buy': 'For parents: buy',
    'offer.restore': 'Restore purchase',
    'busy.title': 'One moment…',
    'busy.text': "Your phone's store is busy.",
    'unlocked.bought': 'Done!',
    'unlocked.restored': 'Restored!',
    'unlocked.text': 'Everything is open. Have fun!',
    'unlocked.go': 'Continue',
    'pending.title': 'Almost done',
    'pending.text': 'The payment is still being processed. Everything opens by itself after that.',
    'problem.title': 'That did not work',
    'problem.noAnswer': 'The store did not answer. Please try again later.',
    'problem.noPurchase': 'No purchase was found for this account.',
    'gate.title': 'Question for parents',
    'gate.lead': 'Type the answer in digits.',
    'gate.wrong': 'That is not right. New question:',
    'gate.label': 'Answer (in digits)',
    'gate.ok': 'OK',
    'error.title': 'Oops',
    'error.retry': 'Try again',
  },
});
