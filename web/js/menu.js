// The menu components every game builds its menu from (Bazibo 2.0 phase 2, docs/design/v2-proposal.md,
// section 1): a section heading, an option card, a card with segmented choices (the computer's
// levels) and a level cell. Their look is in css/style.css (".menu" and below); the selected state
// takes the colour of the game's group (data-group on the screen, set by main.js).
//
// Each helper returns a plain element: the game adds its own data attributes, aria label and click.
// A locked choice gets the class `locked` (and nothing else): foldLocked (fold.js) moves it into the
// "Volledige versie" fold at the end of the menu.

export const LOCK = '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>';
export const LOCK_SVG = `<svg class="lock" viewBox="0 0 24 24" aria-hidden="true">${LOCK}</svg>`;
const STAR = '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z"/>';

/**
 * Three small stars: earned ones filled, the rest outlines (the shape tells them apart, never
 * colour alone). Quiet: nothing at all before a level was played (`n` 0 and not `played`).
 */
export function starsHtml(n, { played = n > 0, max = 3, cls = '' } = {}) {
  if (!played) return '';
  let s = '';
  for (let i = 0; i < max; i++) s += `<svg class="star${i < n ? ' on' : ''}" viewBox="0 0 24 24">${STAR}</svg>`;
  return `<span class="stars${cls ? ` ${cls}` : ''}" aria-hidden="true">${s}</span>`;
}

/**
 * A section heading (h3), with an optional age chip after it ("vanaf 5 jaar"), or a picture and a
 * line under it (Slangetje's kinds of round).
 */
export function menuHead(text, { age = '', art = '', sub = '', cls = '' } = {}) {
  const h = document.createElement('h3');
  h.className = `menu-head${art ? ' with-art' : ''}${cls ? ` ${cls}` : ''}`;
  if (art) h.insertAdjacentHTML('beforeend', `<span class="menu-head-art" aria-hidden="true">${art}</span>`);
  const name = document.createElement('span');
  name.className = 'menu-head-name';
  name.textContent = text;
  if (sub) {
    const text = document.createElement('span');
    text.className = 'menu-head-text';
    const line = document.createElement('span');
    line.className = 'menu-head-sub';
    line.textContent = sub;
    text.append(name, line);
    h.appendChild(text);
  } else h.appendChild(name);
  if (age) {
    const chip = document.createElement('span');
    chip.className = 'menu-age';
    chip.textContent = age;
    h.appendChild(chip);
  }
  return h;
}

/** A small line above a grid of levels ("5-6 jaar · tot 10, vooruit"). */
export function menuLine(text, { cls = '' } = {}) {
  const p = document.createElement('p');
  p.className = `menu-line${cls ? ` ${cls}` : ''}`;
  p.textContent = text;
  return p;
}

/**
 * An option card: a picture, a title and one short line (and an age, for the cards that open a
 * part of the game). `pressed`: true or false makes it a toggle (aria-pressed, selected in the group
 * colour); leave it out for a card that opens something.
 */
export function optionCard({ art = '', title, sub = '', age = '', pressed, locked = false, cls = '', label = '' }) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `option-card${cls ? ` ${cls}` : ''}${locked ? ' locked' : ''}`;
  if (pressed !== undefined) b.setAttribute('aria-pressed', String(!!pressed));
  b.innerHTML = `<span class="option-art" aria-hidden="true">${art}</span><span class="option-text"><span class="option-title"></span></span>${locked ? LOCK_SVG : ''}`;
  b.querySelector('.option-title').textContent = title;
  const text = b.querySelector('.option-text');
  for (const [k, v] of [['sub', sub], ['age', age]]) {
    if (!v) continue;
    const s = document.createElement('span');
    s.className = `option-${k}`;
    s.textContent = v;
    text.appendChild(s);
  }
  if (label) b.setAttribute('aria-label', label);
  return b;
}

/**
 * A card that holds segmented choices (the computer with its levels): a picture and a title, then
 * the segments. `on`: this card is the one chosen. `foldHead` names the segments in the fold.
 */
export function optionBox({ art = '', title, on = false, foldHead = '', cls = '' }) {
  const box = document.createElement('div');
  box.className = `option-box${on ? ' on' : ''}${cls ? ` ${cls}` : ''}`;
  box.innerHTML = `<span class="option-art" aria-hidden="true">${art}</span><span class="option-title"></span><span class="seg-cards" role="group"></span>`;
  box.querySelector('.option-title').textContent = title;
  const segs = box.querySelector('.seg-cards');
  segs.setAttribute('aria-label', title);
  if (foldHead) segs.dataset.foldHead = foldHead;
  return box;
}

/** One segment: a level with its dots (1 to 3), a name and an optional extra (wins). */
export function segCard({ name, dots = 0, pressed = false, locked = false, extra = '', cls = '' }) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `seg-card${locked ? ' locked' : ''}${cls ? ` ${cls}` : ''}`;
  b.setAttribute('aria-pressed', String(!!pressed));
  const d = dots ? `<span class="dots" aria-hidden="true">${[1, 2, 3].map((k) => `<i class="${k <= dots ? 'on' : ''}"></i>`).join('')}</span>` : '';
  b.innerHTML = `${d}<span class="seg-name"></span>${locked ? LOCK_SVG : extra}`;
  b.querySelector('.seg-name').textContent = name;
  return b;
}

/**
 * A level cell: the number and, once played, its stars. `next`: the one to play now (in the group
 * colour). Locked: the number and a padlock (the fold hides the padlock).
 */
export function levelCell({ num, stars = 0, played, next = false, locked = false, cls = '' }) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `level-cell${locked ? ' locked' : ''}${next && !locked ? ' next' : ''}${cls ? ` ${cls}` : ''}`;
  b.innerHTML = `<span class="num">${num}</span>${locked ? LOCK_SVG : starsHtml(stars, { played: played ?? stars > 0 })}`;
  return b;
}

/** A waste bin (the trash button, and the "clear the page" tool in Tekenen). */
export const TRASH =
  '<path d="M6 7h12l-1 13a1.5 1.5 0 0 1-1.5 1.4h-7A1.5 1.5 0 0 1 7 20z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M4 7h16M9.5 7V4.5h5V7M10 11v6.5M14 11v6.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';

/** How long (ms) "Ja" on the throw-away card waits before it listens: a double tap never deletes. */
export const THROW_AWAY_WAIT = 400;

/**
 * A saved picture in a list (Tekenen's "my drawings", Kleurplaten's "my pictures") with its own
 * small trash button on its corner: a separate button of 48 px, so a tap on the picture opens it
 * and only the bin asks to throw it away. `label` names the bin for screen readers.
 */
export function withTrash(card, { label, onTrash }) {
  const box = document.createElement('div');
  box.className = 'keep-item';
  const bin = document.createElement('button');
  bin.type = 'button';
  bin.className = 'trash-btn';
  bin.setAttribute('aria-label', label);
  bin.innerHTML = `<span class="trash-disc" aria-hidden="true"><svg viewBox="0 0 24 24">${TRASH}</svg></span>`;
  bin.addEventListener('click', (e) => {
    e.stopPropagation();
    onTrash();
  });
  box.append(card, bin);
  return box;
}

/**
 * The short card before a picture is thrown away: its thumbnail (`art`), "Weggooien?" and big
 * Ja / Nee buttons. "Ja" does nothing in the first THROW_AWAY_WAIT ms, so one accidental tap or
 * a double tap on the bin never deletes. No parental gate: it is the child's own picture.
 */
export function askThrowAway(shell, { art = '', onYes }) {
  const { t } = shell;
  const shown = performance.now();
  shell.showOverlay({
    art,
    title: t('common.throwAway'),
    buttons: [
      [
        t('common.yes'),
        'big primary throw-yes',
        () => {
          if (performance.now() - shown < THROW_AWAY_WAIT) return;
          shell.hideOverlay();
          onYes();
        },
      ],
      [t('common.no'), 'big secondary throw-no', shell.hideOverlay],
    ],
  });
}
