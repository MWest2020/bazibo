// The docs stay in step with the games: every game in GAMES has its page docs/games/<id>.md and one
// row in the README's games table, docs/README.md lists every page, and every relative link in the
// markdown files leads to a file that exists. The README stays short (the details live in docs/).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAMES } from '../web/js/games.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

function markdownFiles(dir) {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(join(ROOT, p)).isDirectory()) return markdownFiles(p);
    return name.endsWith('.md') ? [p] : [];
  });
}

test('every game has its page in docs/games/ and one row in the README games table', () => {
  const readme = read('README.md');
  const index = read('docs/README.md');
  for (const { id } of GAMES) {
    const page = `docs/games/${id}.md`;
    assert.ok(existsSync(join(ROOT, page)), `${page} is missing`);
    assert.match(read(page), /^# \S/, `${page} starts with a title`);
    const rows = readme.split('\n').filter((l) => l.startsWith('|') && l.includes(`](${page})`));
    assert.equal(rows.length, 1, `README.md has one games-table row linking ${page}`);
    assert.ok(index.includes(`](games/${id}.md)`), `docs/README.md lists games/${id}.md`);
  }
  const ids = new Set(GAMES.map((g) => g.id));
  for (const f of readdirSync(join(ROOT, 'docs/games'))) {
    assert.ok(ids.has(f.replace(/\.md$/, '')), `docs/games/${f} belongs to no game in GAMES`);
  }
});

test('the README stays short', () => {
  const lines = read('README.md').split('\n').length;
  assert.ok(lines <= 120, `README.md has ${lines} lines; move details into docs/`);
});

test('every relative link in README.md, AGENTS.md and docs/ leads to a file that exists', () => {
  const files = ['README.md', 'AGENTS.md', ...markdownFiles('docs')];
  const broken = [];
  for (const f of files) {
    const text = read(f).replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
    for (const [, target] of text.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      const path = decodeURIComponent(target.split('#')[0]);
      if (!existsSync(join(ROOT, dirname(f), path))) broken.push(`${f}: ${target}`);
    }
  }
  assert.deepEqual(broken, [], `broken links:\n${broken.join('\n')}`);
});

test('docs/README.md lists every markdown page in docs/', () => {
  const index = read('docs/README.md');
  for (const f of markdownFiles('docs')) {
    const rel = relative('docs', f);
    if (rel === 'README.md') continue;
    assert.ok(index.includes(`](${rel})`), `docs/README.md does not link ${rel}`);
  }
});
