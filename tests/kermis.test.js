import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allStrings, LANGS, setLang, t as tr } from '../web/js/i18n.js';
import '../web/games/kermis/strings.js';
import { INKS, INK_IDS, WORD_COLOURS, STROOP_COLOURS, SHAPES, THINGS, THING_IDS } from '../web/games/kermis/colours.js';
import { TIERS, TIER_IDS, MODES, PLAYER_IDS, SLOTS, ROUND_LEN, ROUNDS_PER_TIER, CONGRUENT, STROOP_OPTIONS, MAX_TRIES, PAUSE_MS, NEXT_MS, TURTLE, makeRound, starsFor, hashSeed, rng, startState, tapAnswer, raceStart, raceNext, raceTap, isPaused, isOut, allOut, triesFor, places, turtlePlan, hostLine, lineText, LINE_KEYS } from '../web/games/kermis/rules.js';
import { thingSvg, ART_IDS, hostSvg, HOST, turtleSvg, playerSvg, PLAYER_ART_IDS, swatchSvg, SHAPE_IDS, YES_SVG, NO_SVG, flagSvg, playersSvg, stallSvg, tileSvg } from '../web/games/kermis/art.js';
import { meta } from '../web/games/kermis/meta.js';
import { sanitizePayload, mergeTransfer, replaceTransfer } from '../web/js/transfer.js';

const S = allStrings();
const has = (key) => LANGS.every((l) => typeof S[l][key] === 'string' && S[l][key].trim());
const SEEDS = 200;

// ---------- colour maths: CIE76 ΔE in Lab, with colour-blind vision simulated (Machado et al. 2009, severity 1) ----------
const CVD = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toLin = (hex) => [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
function lab([r, g, b]) {
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
const seen = (hex, m) => {
  const l = toLin(hex);
  return lab(m ? CVD[m].map((row) => Math.min(1, Math.max(0, row[0] * l[0] + row[1] * l[1] + row[2] * l[2]))) : l);
};
const dE = (a, b, m = null) => Math.hypot(...seen(a, m).map((x, i) => x - seen(b, m)[i]));
/** The smallest distance of a pair over normal vision and the three kinds of colour blindness. */
const MIN = { normal: 18, protan: 18, deutan: 18, tritan: 15 };
function farApart(a, b, what) {
  for (const [m, min] of Object.entries(MIN)) {
    const d = dE(INKS[a], INKS[b], m === 'normal' ? null : m);
    assert.ok(d >= min, `${what}: ${a} and ${b} only ΔE ${d.toFixed(1)} apart for ${m} vision (want ${min})`);
  }
}

// ---------- the data ----------

test('the colours: every ink has a name in both languages; tiers 2 and 3 and every colour button its own shape', () => {
  for (const c of INK_IDS) {
    assert.match(INKS[c], /^#[0-9a-f]{6}$/);
    assert.ok(has(`kermis.col.${c}`), `${c}: no name`);
  }
  assert.deepEqual(WORD_COLOURS, ['rood', 'blauw', 'geel', 'groen'], 'tier 2: the short words a 6-year-old reads');
  for (const c of [...WORD_COLOURS, ...STROOP_COLOURS]) assert.ok(INKS[c], `${c} is no ink`);
  const shapes = STROOP_COLOURS.map((c) => SHAPES[c]);
  assert.equal(new Set(shapes).size, STROOP_COLOURS.length, 'two colour buttons with the same shape');
  for (const s of shapes) assert.ok(SHAPE_IDS.includes(s), `no drawing for shape ${s}`);
});

test('colour-blind safe: every pair a question can show side by side is far apart, also with protanopia, deuteranopia and tritanopia', () => {
  for (const set of [WORD_COLOURS, STROOP_COLOURS]) {
    for (let i = 0; i < set.length; i++) for (let j = i + 1; j < set.length; j++) farApart(set[i], set[j], set === WORD_COLOURS ? 'tier 2' : 'tier 3');
  }
  for (const id of THING_IDS) for (const n of THINGS[id].not) farApart(THINGS[id].ink, n, `tier 1 ${id}`);
  // red and green are not told apart by hue alone: a dark red, a light green
  const L = (c) => seen(INKS[c])[0];
  assert.ok(L('groen') - L('rood') >= 20, `red and green differ in lightness by only ${(L('groen') - L('rood')).toFixed(1)}`);
});

test('things whose colour a child of 3-5 knows: each with its own colour, plainly wrong colours to show it in, a drawing and names', () => {
  assert.ok(THING_IDS.length >= ROUND_LEN * 2, 'enough things for varied rounds');
  assert.deepEqual([...ART_IDS].sort(), [...THING_IDS].sort());
  for (const id of THING_IDS) {
    const { ink, not } = THINGS[id];
    assert.ok(INKS[ink], `${id}: ${ink}`);
    assert.ok(not.length >= 1, `${id}: no wrong colour`);
    for (const c of not) assert.ok(INKS[c] && c !== ink, `${id}: wrong colour ${c}`);
    assert.equal(new Set(not).size, not.length, `${id}: a wrong colour twice`);
    assert.ok(has(`kermis.thing.${id}`) && has(`kermis.an.${id}`), `${id}: no name in both languages`);
  }
  // the colours things really come in are never "wrong" (Mark checks these lists)
  for (const gone of ['tomaat', 'aubergine', 'druppel']) assert.ok(!THINGS[gone], `${gone} has many real colours (or none): not in the game`);
  const never = { banaan: ['groen', 'bruin', 'rood', 'paars'], wortel: ['paars', 'geel'], lieveheersbeestje: ['geel', 'oranje'], bosbes: ['rood', 'groen', 'paars'], blad: ['geel', 'oranje', 'rood', 'bruin', 'paars', 'roze'], aardbei: ['groen', 'geel'], kikker: ['blauw', 'geel', 'bruin', 'rood', 'oranje'] };
  for (const [id, cs] of Object.entries(never)) for (const c of cs) assert.ok(!THINGS[id].not.includes(c), `${id} really can be ${c}`);
});

// ---------- the rounds, 200 seeds per tier ----------

function eachRound(tier, fn) {
  for (let seed = 1; seed <= SEEDS; seed++) fn(makeRound({ tier, seed }), seed);
  for (let r = 1; r <= ROUNDS_PER_TIER; r++) fn(makeRound({ tier, seed: hashSeed(`kermis:${tier}-${r}`) }), `menu ${r}`);
}

test('every round of every tier: ROUND_LEN questions, the answer among the options, no option twice, never the same question twice in a row', () => {
  for (const tier of TIER_IDS) {
    eachRound(tier, (qs, seed) => {
      assert.equal(qs.length, ROUND_LEN, `${tier} ${seed}`);
      qs.forEach((q, i) => {
        assert.equal(q.kind, TIERS[tier].kind);
        assert.ok(q.options.includes(q.answer), `${tier} ${seed} q${i}: answer ${q.answer} not among ${q.options}`);
        assert.equal(new Set(q.options).size, q.options.length, `${tier} ${seed} q${i}: an option twice`);
        const prev = qs[i - 1];
        if (prev) assert.ok(!(prev.word === q.word && prev.ink === q.ink && prev.thing === q.thing), `${tier} ${seed}: the same question twice in a row`);
      });
    });
  }
});

test('tiers 1 and 2: as many Ja as Nee in every round, never four of one in a row; Ja exactly when the colour matches', () => {
  for (const tier of ['t1', 't2']) {
    eachRound(tier, (qs, seed) => {
      const yes = qs.filter((q) => q.answer === 'yes').length;
      assert.equal(yes, ROUND_LEN / 2, `${tier} ${seed}: ${yes} Ja of ${ROUND_LEN}`);
      for (let i = 3; i < qs.length; i++) assert.ok(!(qs[i].answer === qs[i - 1].answer && qs[i].answer === qs[i - 2].answer && qs[i].answer === qs[i - 3].answer), `${tier} ${seed}: four of one in a row`);
      for (const q of qs) {
        assert.deepEqual(q.options, ['yes', 'no']);
        if (tier === 't1') {
          assert.equal(q.own, THINGS[q.thing].ink);
          assert.equal(q.answer === 'yes', q.ink === q.own, `${seed} ${q.thing} in ${q.ink}`);
          if (q.answer === 'no') assert.ok(THINGS[q.thing].not.includes(q.ink), `${seed}: ${q.thing} shown in ${q.ink}, not in its list`);
        } else {
          assert.ok(WORD_COLOURS.includes(q.word) && WORD_COLOURS.includes(q.ink));
          assert.equal(q.answer === 'yes', q.word === q.ink);
        }
      }
      if (tier === 't1') assert.equal(new Set(qs.map((q) => q.thing)).size, ROUND_LEN, `${seed}: a thing twice in a round`);
      if (tier === 't2') for (let i = 1; i < qs.length; i++) assert.notEqual(qs[i].word, qs[i - 1].word, `${seed}: the same word twice in a row`);
    });
  }
});

test('tier 3, the real Stroop task: the word is its own ink in at most a third of the questions; four colours that always hold the ink and the word', () => {
  let total = 0;
  let congruent = 0;
  eachRound('t3', (qs, seed) => {
    const same = qs.filter((q) => q.word === q.ink).length;
    assert.ok(same <= ROUND_LEN / 3, `${seed}: the word is its own ink in ${same} of ${ROUND_LEN}`);
    assert.equal(same, CONGRUENT, `${seed}: ${same} congruent`);
    total += qs.length;
    congruent += same;
    for (const [i, q] of qs.entries()) {
      assert.equal(q.answer, q.ink);
      assert.equal(q.options.length, STROOP_OPTIONS);
      assert.ok(q.options.includes(q.word), `${seed} q${i}: the word's colour is not a button`);
      for (const o of q.options) assert.ok(STROOP_COLOURS.includes(o));
      assert.deepEqual(q.options, STROOP_COLOURS.filter((c) => q.options.includes(c)), 'the buttons keep one order');
      if (i) assert.ok(q.word !== qs[i - 1].word && q.ink !== qs[i - 1].ink, `${seed} q${i}: the same word or ink twice in a row`);
    }
  });
  assert.ok(congruent / total <= 1 / 3);
});

test('the menu rounds are fixed and differ from each other', () => {
  for (const tier of TIER_IDS) {
    const rounds = [1, 2, 3].map((r) => JSON.stringify(makeRound({ tier, seed: hashSeed(`kermis:${tier}-${r}`) })));
    assert.equal(new Set(rounds).size, 3);
    assert.equal(JSON.stringify(makeRound({ tier, seed: hashSeed(`kermis:${tier}-1`) })), rounds[0]);
  }
});

// ---------- Rustig: a tap ----------

test('a tap: right, a gentle "look again" counted once per answer, the word\'s colour named in tier 3; stars by mistakes only', () => {
  const [q] = makeRound({ tier: 't3', seed: 5 }).filter((x) => x.word !== x.ink);
  let st = startState();
  const w = tapAnswer(q, st, q.word);
  assert.equal(w.ok, false);
  assert.equal(w.why, 'word');
  st = w.st;
  assert.equal(tapAnswer(q, st, q.word).ok, null, 'the same answer again counts nothing');
  const other = q.options.find((o) => o !== q.word && o !== q.ink);
  assert.equal(tapAnswer(q, st, other).why, 'look');
  assert.equal(tapAnswer(q, st, 'paars').ok, null, 'not a button here');
  assert.equal(tapAnswer(q, st, q.ink).ok, true);
  assert.equal(MAX_TRIES, 2);
  assert.deepEqual([0, 1, 2, 3, 8].map(starsFor), [3, 2, 2, 1, 1]);
  assert.equal(starsFor.length, 1, 'stars take the mistakes only, never time');
});

// ---------- the race, with time passed in ----------

const raceQ = { kind: 'stroop', word: 'rood', ink: 'blauw', answer: 'blauw', options: ['rood', 'blauw', 'geel', 'groen'] };

test('race: the first right tap wins the point and closes the question; a wrong tap pauses only that child, never minus points', () => {
  let st = raceStart(3);
  let r = raceTap(st, 1, 'rood', raceQ, 1000); // the word's colour
  assert.equal(r.res, 'wrong');
  st = r.st;
  assert.deepEqual(st.scores, [0, 0, 0], 'a wrong tap costs no points');
  assert.ok(isPaused(st, 1, 1000 + PAUSE_MS - 1) && !isPaused(st, 1, 1000 + PAUSE_MS));
  assert.ok(!isPaused(st, 0, 1001) && !isPaused(st, 2, 1001), 'only that child waits');
  assert.equal(raceTap(st, 1, 'blauw', raceQ, 1200).res, 'paused', 'in the pause even the right answer does nothing');
  assert.equal(raceTap(st, 1, 'blauw', raceQ, 1200).st, st);
  r = raceTap(st, 2, 'blauw', raceQ, 1300);
  assert.equal(r.res, 'right');
  st = r.st;
  assert.deepEqual(st.scores, [0, 0, 1]);
  assert.equal(st.winner, 2);
  assert.equal(raceTap(st, 0, 'blauw', raceQ, 1301).res, 'closed', 'a second right tap is too late');
  assert.equal(raceTap(st, 1, 'blauw', raceQ, 1000 + PAUSE_MS + 1).res, 'closed');
  // the next question: the points stay, the pauses and what was tried go
  st = raceNext(st);
  assert.deepEqual(st.scores, [0, 0, 1]);
  assert.equal(st.winner, null);
  assert.ok(!isPaused(st, 1, 1400));
  assert.deepEqual(st.tried, [[], [], []]);
});

test('race: no tap-spam: a pause after a wrong tap, and out of the question after one wrong Ja/Nee or two wrong colours', () => {
  let st = raceStart(2);
  let wrongs = 0;
  // child 0 hammers every wrong button every 40 ms; child 1 taps the right one once at 4 s
  for (let now = 0; now <= 5000; now += 40) {
    const a = raceQ.options[[0, 2, 3][(now / 40) % 3]];
    const r = raceTap(st, 0, a, raceQ, now);
    if (r.res === 'wrong') wrongs++;
    st = r.st;
    if (now === 4000) st = raceTap(st, 1, 'blauw', raceQ, now).st;
  }
  assert.equal(triesFor(raceQ), 2);
  assert.equal(wrongs, 2, 'two wrong colours, then out');
  assert.ok(isOut(st, 0, raceQ));
  assert.equal(raceTap(st, 0, 'blauw', raceQ, 4000).res, 'closed');
  assert.deepEqual(st.scores, [0, 1]);
  // out means out: after two wrong colours the right one does nothing (no winning by elimination)
  let s3 = raceStart(2);
  s3 = raceTap(s3, 0, 'rood', raceQ, 0).st;
  s3 = raceTap(s3, 0, 'geel', raceQ, PAUSE_MS).st;
  assert.equal(raceTap(s3, 0, 'blauw', raceQ, 2 * PAUSE_MS).res, 'out');
  assert.ok(!allOut(s3, raceQ));
  s3 = raceTap(s3, 1, 'groen', raceQ, 10).st;
  s3 = raceTap(s3, 1, 'rood', raceQ, 10 + PAUSE_MS).st;
  assert.ok(allOut(s3, raceQ), 'everyone out: nobody gets the point');
  assert.deepEqual(s3.scores, [0, 0]);
  // two children at the same moment: the one handled first wins, the other is closed
  let s2 = raceStart(2);
  s2 = raceTap(s2, 1, 'blauw', raceQ, 500).st;
  assert.equal(raceTap(s2, 0, 'blauw', raceQ, 500).res, 'closed');
  assert.deepEqual(s2.scores, [0, 1]);
});

test('race: guessing does not beat reading: a child who taps at once against one who answers right after 2 s', () => {
  for (const tier of TIER_IDS) {
    let masher = 0;
    let reader = 0;
    let n = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const rand = rng(seed * 7 + 1);
      for (const q of makeRound({ tier, seed })) {
        n++;
        let st = raceStart(2);
        // the masher taps a random answer it has not tried, as soon as its pause allows
        for (let now = 0; now < 2000 && st.winner === null; now += 50) {
          const left = q.options.filter((o) => !st.tried[0].includes(o));
          st = raceTap(st, 0, left[Math.floor(rand() * left.length)], q, now).st;
        }
        if (st.winner === null) st = raceTap(st, 1, q.answer, q, 2000).st;
        if (st.winner === 0) masher++;
        else if (st.winner === 1) reader++;
      }
    }
    // Ja/Nee: a guess is a coin flip that puts the masher out half the time; four colours: two guesses
    assert.ok(masher / n < 0.56, `${tier}: the masher won ${masher} of ${n}`);
    assert.ok(reader >= masher * 0.85, `${tier}: the reader won ${reader}, the masher ${masher}`);
  }
});

test('race: everyone is placed, the same points share a place', () => {
  assert.deepEqual(places([5, 3, 5, 0]), [1, 3, 1, 4]);
  assert.deepEqual(places([2, 2]), [1, 1]);
  assert.deepEqual(places([0, 8]), [2, 1]);
  assert.ok(NEXT_MS >= 1000, 'a calm beat between questions');
});

test('race: the turtle taps late and mostly right, a wrong tap waits out its pause, and it always ends on the right answer (seeded)', () => {
  for (const tier of TIER_IDS) {
    let wrong = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const [q] = makeRound({ tier, seed });
      const plan = turtlePlan(q, tier, seed);
      assert.deepEqual(plan, turtlePlan(q, tier, seed), 'seeded');
      assert.ok(plan[0].at >= TURTLE[tier].from && plan[0].at <= TURTLE[tier].from + TURTLE[tier].spread);
      if (plan[0].a !== q.answer) wrong++;
      if (triesFor(q) === 1) assert.equal(plan.length, 1, 'on Ja/Nee one tap, like a child');
      else assert.equal(plan[plan.length - 1].a, q.answer);
      if (plan.length === 2) {
        assert.notEqual(plan[0].a, q.answer);
        assert.ok(plan[1].at >= plan[0].at + PAUSE_MS, 'the turtle waits out its pause too');
        let st = raceStart(2);
        st = raceTap(st, 1, plan[0].a, q, plan[0].at).st;
        assert.equal(raceTap(st, 1, plan[1].a, q, plan[1].at).res, 'right');
      }
    }
    assert.ok(wrong > 10 && wrong < 90, `${tier}: the turtle missed ${wrong} of ${SEEDS}`);
  }
});

// ---------- what the chameleon says ----------

const say = (lang, line) => {
  setLang(lang);
  const s = lineText(line, tr);
  setLang('nl');
  return s;
};

test('the chameleon\'s lines, in both languages', () => {
  const pic = { kind: 'pic', thing: 'banaan', ink: 'blauw', own: 'geel', answer: 'no', options: ['yes', 'no'] };
  assert.equal(say('nl', hostLine(pic, { say: 'hello', i: 0 })), 'Hoi! Klopt deze kleur?');
  assert.equal(say('nl', hostLine(pic, { say: 'hello', i: 3 })), 'Klopt deze kleur?');
  assert.equal(say('en', hostLine(pic, { say: 'hello', i: 0 })), 'Hi! Is this the right colour?');
  assert.equal(say('nl', hostLine(pic, { say: 'hello', i: 2, who: 'maan' })), 'Maan, jouw beurt! Klopt deze kleur?');
  assert.equal(say('nl', hostLine(pic, { say: 'hello', i: 0, race: true })), 'Wie is het eerst? Klopt deze kleur?');
  assert.equal(say('nl', hostLine(pic, { say: 'try', res: { ok: true } })), 'Goed gezien! Een banaan is geel, niet blauw.');
  assert.equal(say('en', hostLine(pic, { say: 'try', res: { ok: true } })), 'Well spotted! A banana is yellow, not blue.');
  assert.equal(say('nl', hostLine(pic, { say: 'try', res: { ok: false, why: 'look' } })), 'Kijk nog eens. Is een banaan echt blauw?');
  const yes = { ...pic, ink: 'geel', answer: 'yes' };
  assert.equal(say('nl', hostLine(yes, { say: 'try', res: { ok: true } })), 'Ja! Een banaan is geel.');
  assert.equal(say('nl', hostLine({ ...yes, thing: 'zon' }, { say: 'try', res: { ok: true } })), 'Ja! De zon is geel.');
  const word = { kind: 'word', word: 'rood', ink: 'groen', answer: 'no', options: ['yes', 'no'] };
  assert.equal(say('nl', hostLine(word, { say: 'try', res: { ok: true } })), 'Goed gezien! Er staat ‘rood’, maar de letters zijn groen.');
  assert.equal(say('en', hostLine(word, { say: 'try', res: { ok: true } })), 'Well spotted! It says ‘red’, but the letters are green.');
  const st = { kind: 'stroop', word: 'rood', ink: 'blauw', answer: 'blauw', options: [] };
  assert.equal(say('nl', hostLine(st, { say: 'hello', i: 0 })), 'Hoi! Tik de kleur van de letters, niet het woord.');
  assert.equal(say('nl', hostLine(st, { say: 'try', res: { ok: true } })), 'Ja! De letters zijn blauw.');
  assert.equal(say('nl', hostLine(st, { say: 'try', res: { ok: false, why: 'word' } })), 'Dat is wat er staat. Welke kleur hebben de letters?');
  assert.equal(say('nl', hostLine(st, { say: 'try', res: { ok: false, why: 'look' }, help: true })), 'Kijk nog eens naar de letters. Kijk, het lichtje helpt je.');
  assert.equal(say('nl', hostLine(st, { say: 'won', who: 'wolk' })), 'Wolk was het eerst!');
  assert.equal(say('en', hostLine(st, { say: 'won', who: 'bloem' })), 'Flower was first!');
  assert.equal(say('nl', hostLine(st, { say: 'won', who: 'turtle' })), 'Het schildpadje was het eerst!');
  assert.equal(say('nl', hostLine(st, { say: 'won', who: 'you' })), 'Jij was het eerst!');
  assert.equal(say('en', hostLine(st, { say: 'won', who: 'turtle' })), 'The turtle was first!');
  assert.equal(say('nl', hostLine(st, { say: 'nobody' })), 'Niemand dit keer: de letters waren blauw. Op naar de volgende!');
  assert.equal(say('nl', hostLine(pic, { say: 'nobody' })), 'Niemand dit keer: een banaan is geel. Op naar de volgende!');
});

test('every line of 200 rounds per tier, every answer tapped, reads well in both languages and never says "fout" or "wrong"', () => {
  for (const key of LINE_KEYS) assert.ok(has(key), `no text for ${key}`);
  for (const lang of LANGS) {
    for (const tier of TIER_IDS) {
      for (let seed = 1; seed <= SEEDS; seed++) {
        makeRound({ tier, seed }).forEach((q, i) => {
          const lines = [hostLine(q, { say: 'hello', i }), hostLine(q, { say: 'hello', i, who: PLAYER_IDS[i % 4] }), hostLine(q, { say: 'hello', i, race: true }), hostLine(q, { say: 'nobody' })];
          for (const who of [...PLAYER_IDS, 'turtle', 'you']) lines.push(hostLine(q, { say: 'won', who }));
          for (const a of q.options) lines.push(hostLine(q, { say: 'try', res: tapAnswer(q, startState(), a), a, help: true }));
          for (const line of lines) {
            const s = say(lang, line);
            assert.ok(s && !/[{}]|kermis\./.test(s), `${lang} ${tier} ${seed}: ${s}`);
            assert.match(s, /^\p{Lu}/u, `${lang}: ${s}`);
            assert.ok(!/\bfout\b|\bwrong\b/i.test(s), `${lang}: ${s}`);
          }
        });
      }
    }
  }
});

// ---------- the drawings ----------

const HEX = /(?:fill|stroke)="(#[0-9a-f]{6})"/g;
const NEUTRAL = new Set(['#3b2f2f', '#2b2422', '#000000', '#ffffff']);

test('every drawing is ours and clean: no ids, url(#), style attributes or text', () => {
  const all = [...THING_IDS.map((id) => thingSvg(id)), ...THING_IDS.map((id) => thingSvg(id, 'blauw')), hostSvg(), turtleSvg(), ...PLAYER_ART_IDS.map(playerSvg), ...STROOP_COLOURS.map(swatchSvg), YES_SVG, NO_SVG, flagSvg(), playersSvg(4), stallSvg(), tileSvg()];
  for (const s of all) {
    assert.ok(!/\sid=|url\(#|\sstyle=|<text|<use|<image/.test(s), s.slice(0, 80));
    assert.ok(/aria-hidden="true"/.test(s));
  }
});

test('a thing\'s body takes its ink from the page; its details never show its own colour; the chameleon never looks like an answer', () => {
  for (const id of THING_IDS) {
    const s = thingSvg(id);
    assert.ok(/class="kk-body"/.test(s), `${id}: no body to colour`);
    const own = INKS[THINGS[id].ink];
    for (const [, hex] of s.matchAll(HEX)) {
      if (NEUTRAL.has(hex)) continue;
      assert.ok(dE(hex, own) >= 20, `${id}: a detail in ${hex} is close to its own colour ${own}`);
    }
    assert.ok(thingSvg(id, 'blauw').includes(`fill="${INKS.blauw}"`) && !thingSvg(id, 'blauw').includes('kk-body'));
  }
  for (const part of [HOST.skin, HOST.dark]) for (const c of INK_IDS) assert.ok(dE(part, INKS[c]) >= 20, `the chameleon's ${part} is close to ${c}`);
  for (const id of PLAYER_ART_IDS) assert.ok(!/#(?!2b2422|ffffff)[0-9a-f]{6}/.test(playerSvg(id)), `${id}: a corner symbol in colour`);
  for (const c of STROOP_COLOURS) assert.ok(swatchSvg(c).includes(`fill="${INKS[c]}"`));
});

// ---------- the shell: free part, players, the save ----------

test('free: tier 1 in Rustig; tiers 2-3 and the race in the full version; four players in their corners', () => {
  assert.equal(meta.id, 'kermis');
  assert.equal(meta.group, 'learning');
  assert.equal(meta.isLocked({ tier: 't1', mode: 'calm' }, false), false);
  assert.equal(meta.isLocked({ tier: 't1' }, false), false);
  assert.equal(meta.isLocked({ tier: 't1', mode: 'race' }, false), true);
  assert.equal(meta.isLocked({ tier: 't2', mode: 'calm' }, false), true);
  assert.equal(meta.isLocked({ tier: 't3', mode: 'race' }, true), false);
  assert.deepEqual(MODES, ['calm', 'race']);
  assert.deepEqual(SLOTS.slice(0, 2), ['bl', 'tr'], 'two children sit in opposite corners');
  for (const id of PLAYER_IDS) assert.ok(has(`kermis.p.${id}`) && has(`kermis.turn.${id}`));
  for (const tier of TIER_IDS) assert.ok(has(`kermis.tier.${tier}`) && has(`kermis.short.${tier}`) && has(`kermis.how.${tier}`));
  assert.equal(S.nl['games.kermis'], 'Kleurenkermis');
  assert.equal(S.en['games.kermis'], 'Colour Fair');
});

test('the save survives a transfer: stars per round, random rounds per tier, how-to cards seen, the last tier, mode and players', () => {
  const sent = { games: { kermis: { stars: { 't1-1': 3, 't1-2': 2, 't3-3': 1, bad: -1 }, random: { t2: 4, t3: 1 }, howSeen: { t1: true, race: true, t3: 'yes' }, lastTier: 't3', lastMode: 'race', lastPlayers: 3 } } };
  const out = sanitizePayload(JSON.parse(JSON.stringify(sent)));
  assert.deepEqual(out.games.kermis.stars, { 't1-1': 3, 't1-2': 2, 't3-3': 1 });
  assert.deepEqual(out.games.kermis.random, { t2: 4, t3: 1 });
  assert.deepEqual(out.games.kermis.howSeen, { t1: true, race: true });
  assert.equal(out.games.kermis.lastTier, 't3');
  assert.equal(out.games.kermis.lastMode, 'race');
  assert.equal(out.games.kermis.lastPlayers, 3);
  const mine = { version: 1, games: { kermis: { stars: { 't1-1': 1 }, random: { t2: 6 }, lastPlayers: 2 } }, purchase: { owned: false }, settings: {} };
  const merged = mergeTransfer(mine, out);
  assert.equal(merged.games.kermis.stars['t1-1'], 3, 'the higher stars win');
  assert.equal(merged.games.kermis.random.t2, 6, 'the higher count wins');
  assert.equal(merged.games.kermis.lastPlayers, 2, 'this device keeps its own option');
  assert.equal(merged.games.kermis.lastMode, 'race');
  assert.deepEqual(merged.games.kermis.howSeen, { t1: true, race: true });
  const replaced = replaceTransfer(mine, out);
  assert.deepEqual(replaced.games.kermis.stars, { 't1-1': 3, 't1-2': 2, 't3-3': 1 });
  assert.equal(replaced.games.kermis.lastMode, 'race');
});
