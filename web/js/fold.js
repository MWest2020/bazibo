// The "Volledige versie" fold (Bazibo 2.0, docs/design/v2-proposal.md, question 4): the locked
// choices of a menu are gathered in one quiet fold at its end, instead of padlocks between the free
// ones. The free part stays exactly where it was. The locked buttons are moved, not copied, so their
// own click handlers (the offer, or OK on the web) keep working; each keeps the heading of the
// section it came from. With the full version there is nothing locked and so no fold.
import { t } from './i18n.js';

const LOCK = '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>';
const CHEVRON = '<path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>';
const HEADING = 'h2, h3, h4, p, .vier-label';
const TITLE = 'h2, h3, h4';

const opened = new WeakMap(); // a menu that re-renders keeps its fold open or closed

/**
 * The headings a group of buttons belongs to, inside `box`: the line right before it (a size, an
 * age) and, when that is only a line, the section title above it (Slangetje: "Tellen", then
 * "vanaf 5 jaar"). Nothing when another group of buttons comes first.
 */
function headingsOf(parent, box) {
  for (let el = parent; el && el !== box; el = el.parentElement) {
    const prev = el.previousElementSibling;
    if (!prev) continue;
    if (!prev.matches(HEADING)) return [];
    if (prev.matches(TITLE)) return [prev];
    for (let p = prev.previousElementSibling; p; p = p.previousElementSibling) {
      if (p.matches(TITLE)) return [p, prev];
      if (!p.matches(HEADING)) break;
    }
    return [prev];
  }
  return [];
}

/** A title stays in the menu while any free button is left under it (up to the next title). */
function emptyTitle(title) {
  for (let el = title.nextElementSibling; el && !el.matches(title.tagName); el = el.nextElementSibling) {
    if (!el.hidden && el.querySelector('button, a, input')) return false;
  }
  return true;
}

function cloneQuiet(el) {
  const c = el.cloneNode(true);
  c.removeAttribute('id');
  c.hidden = false;
  for (const x of c.querySelectorAll('[id]')) x.removeAttribute('id');
  return c;
}

/**
 * Move every locked choice inside `box` (matching `selector`) into one fold at the end of `box`
 * (or into `into`, when given). Call it at the end of every render of the menu. Returns the fold,
 * or null when nothing is locked.
 */
export function foldLocked(box, { selector = '.locked', into = box } = {}) {
  for (const old of into.querySelectorAll(':scope > .full-fold')) old.remove();
  const items = [...box.querySelectorAll(selector)].filter((el) => !el.closest('.full-fold'));
  if (!items.length) return null;

  const fold = document.createElement('details');
  fold.className = 'full-fold';
  fold.open = opened.get(box) || false;
  fold.addEventListener('toggle', () => opened.set(box, fold.open));
  const summary = document.createElement('summary');
  summary.className = 'full-fold-head';
  summary.innerHTML = `<svg class="full-fold-lock" viewBox="0 0 24 24" aria-hidden="true">${LOCK}</svg><span class="full-fold-title"></span><svg class="full-fold-chevron" viewBox="0 0 24 24" aria-hidden="true">${CHEVRON}</svg>`;
  summary.querySelector('.full-fold-title').textContent = t('fold.title');
  const body = document.createElement('div');
  body.className = 'full-fold-body';
  fold.append(summary, body);

  const groups = new Map();
  for (const el of items) {
    if (!groups.has(el.parentElement)) groups.set(el.parentElement, []);
    groups.get(el.parentElement).push(el);
  }
  const cloned = new Set();
  for (const [parent, els] of groups) {
    const tagged = parent.closest('[data-fold-head]');
    const heads = tagged && box.contains(tagged) ? [] : headingsOf(parent, box);
    if (tagged && box.contains(tagged)) {
      // a group inside a card (the computer's levels, the players): the game names it
      if (!cloned.has(tagged)) {
        cloned.add(tagged);
        const h = document.createElement('h3');
        h.className = 'full-fold-sub';
        h.textContent = tagged.dataset.foldHead;
        body.appendChild(h);
      }
    }
    for (const h of heads) {
      if (cloned.has(h)) continue;
      cloned.add(h);
      body.appendChild(cloneQuiet(h));
    }
    const group = document.createElement(parent.tagName === 'UL' || parent.tagName === 'OL' ? parent.tagName : 'div');
    group.className = parent.className;
    group.classList.add('full-fold-group');
    group.style.cssText = parent.style.cssText; // grid sizes set by the game (never a style attribute: the CSP)
    group.append(...els);
    body.appendChild(group);
    if (!parent.querySelector('button, a, input')) {
      parent.hidden = true;
      for (const h of heads) if (!h.matches(TITLE) || emptyTitle(h)) h.hidden = true;
    }
  }
  into.appendChild(fold);
  return fold;
}
