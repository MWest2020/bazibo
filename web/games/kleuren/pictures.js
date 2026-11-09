// The colouring pictures for the youngest (3-6), drawn in code on a 200×200 canvas. Every part
// that can be coloured is one closed path ("region"); parts are layered (later ones on top), so a
// shape never has to be cut out of another. Small details that are not coloured (eyes, a smile,
// whiskers) are `deco`: drawn on top and ignored by taps. Ordered from very few large parts to
// more and smaller ones; the first FREE_PICTURES are in the free version.

export const FREE_PICTURES = 6;
export const INK = '#3a2f6b';

const n = (v) => Math.round(v * 100) / 100;
/** A circle. */
export const C = (cx, cy, r) => `M${n(cx - r)} ${n(cy)}A${n(r)} ${n(r)} 0 1 0 ${n(cx + r)} ${n(cy)}A${n(r)} ${n(r)} 0 1 0 ${n(cx - r)} ${n(cy)}Z`;
/** An ellipse. */
export const E = (cx, cy, rx, ry) => `M${n(cx - rx)} ${n(cy)}A${n(rx)} ${n(ry)} 0 1 0 ${n(cx + rx)} ${n(cy)}A${n(rx)} ${n(ry)} 0 1 0 ${n(cx - rx)} ${n(cy)}Z`;
/** A rectangle with rounded corners. */
export const Rr = (x, y, w, h, r = 0) =>
  r
    ? `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`
    : `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
/** A polygon through the given [x, y] points. */
export const P = (...pts) => `M${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}Z`;
/** A five-pointed star. */
const star = (cx, cy, r) =>
  P(...Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  }));
/** A lens-shaped leaf from (x1, y1) to (x2, y2), bulging by `b` on both sides. */
const leaf = (x1, y1, x2, y2, b) => {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l = Math.hypot(dx, dy);
  const ox = (-dy / l) * b;
  const oy = (dx / l) * b;
  return `M${x1} ${y1}Q${n(mx + ox)} ${n(my + oy)} ${x2} ${y2}Q${n(mx - ox)} ${n(my - oy)} ${x1} ${y1}Z`;
};

/** The part of ellipse (cx, cy, rx, ry) between x1 and x2: a stripe that follows the outline. */
const stripe = (cx, cy, rx, ry, x1, x2) => {
  const h = (x) => ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));
  return `M${x1} ${n(cy - h(x1))}A${rx} ${ry} 0 0 1 ${x2} ${n(cy - h(x2))}L${x2} ${n(cy + h(x2))}A${rx} ${ry} 0 0 1 ${x1} ${n(cy + h(x1))}Z`;
};

const eye = (x, y, r = 5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/><circle cx="${x + r * 0.35}" cy="${y - r * 0.38}" r="${r * 0.36}" fill="#fff"/>`;
const smile = (x, y, w) => `<path d="M${x - w} ${y}Q${x} ${y + w * 0.9} ${x + w} ${y}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
const line = (d, w = 3) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

/** [id, d] pairs to regions. */
const regs = (...list) => list.map(([id, d]) => ({ id, d }));

export const PICTURES = Object.freeze([
  {
    id: 'zon',
    name: 'sun',
    regions: regs(
      ...Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4 - Math.PI / 2;
        const p = (r, da) => [100 + r * Math.cos(a + da), 100 + r * Math.sin(a + da)];
        return [`ray${i}`, P(p(56, -0.24), p(93, 0), p(56, 0.24))];
      }),
      ['face', C(100, 100, 50)],
    ),
    deco: eye(82, 92, 6) + eye(118, 92, 6) + smile(100, 112, 16) +
      '<ellipse cx="72" cy="112" rx="8" ry="5" fill="#ff9fb4" opacity=".6"/><ellipse cx="128" cy="112" rx="8" ry="5" fill="#ff9fb4" opacity=".6"/>',
  },
  {
    id: 'huis',
    name: 'house',
    regions: regs(
      ['ground', 'M0 172Q50 160 100 168T200 166V200H0Z'],
      ['chimney', Rr(126, 46, 20, 40)],
      ['wall', Rr(46, 96, 108, 76)],
      ['roof', P([34, 102], [100, 42], [166, 102])],
      ['door', Rr(88, 126, 26, 46, 8)],
      ['win1', Rr(58, 110, 22, 22, 3)],
      ['win2', Rr(122, 110, 22, 22, 3)],
    ),
    deco: line('M69 110V132M58 121H80M133 110V132M122 121H144', 2.4) + '<circle cx="107" cy="150" r="2.6" fill="#3a2f6b"/>' + line('M136 38q6-8 0-14q-6-8 2-14', 2.4),
  },
  {
    id: 'vis',
    name: 'fish',
    regions: regs(
      ['fin1', 'M78 66Q102 28 130 66Z'],
      ['fin2', 'M96 134Q112 160 128 134Z'],
      ['tail', P([46, 100], [12, 70], [20, 100], [12, 130])],
      ['body', E(104, 100, 62, 40)],
      ['stripe1', stripe(104, 100, 62, 40, 76, 92)],
      ['stripe2', stripe(104, 100, 62, 40, 108, 122)],
      ['bub1', C(176, 54, 9)],
      ['bub2', C(186, 30, 6)],
      ['bub3', C(170, 14, 4.5)],
    ),
    deco: eye(144, 90, 7) + smile(158, 110, 7),
  },
  {
    id: 'bloem',
    name: 'flower',
    regions: regs(
      ['stem', Rr(96, 100, 8, 66, 4)],
      ['leaf1', leaf(98, 150, 54, 122, 14)],
      ['leaf2', leaf(102, 140, 148, 116, 14)],
      ['pot', P([72, 172], [128, 172], [120, 198], [80, 198])],
      ['rim', Rr(64, 160, 72, 16, 6)],
      ...Array.from({ length: 6 }, (_, i) => {
        const a = (i * Math.PI) / 3 - Math.PI / 2;
        return [`petal${i}`, C(100 + 31 * Math.cos(a), 72 + 31 * Math.sin(a), 22)];
      }),
      ['heart', C(100, 72, 21)],
    ),
    deco: eye(92, 68, 4) + eye(108, 68, 4) + smile(100, 79, 7),
  },
  {
    id: 'puppy',
    name: 'puppy',
    regions: regs(
      ['tail', 'M140 158Q172 150 170 122Q168 112 160 118Q160 140 136 146Z'],
      ['body', E(100, 152, 46, 40)],
      ['spot', E(124, 150, 12, 10)],
      ['leg1', E(80, 184, 15, 13)],
      ['leg2', E(120, 184, 15, 13)],
      ['collar', Rr(68, 120, 64, 13, 6)],
      ['tag', C(100, 140, 7)],
      ['head', E(100, 84, 46, 42)],
      ['ear1', 'M64 58Q40 60 38 92Q38 114 54 116Q66 116 68 98Z'],
      ['ear2', 'M136 58Q160 60 162 92Q162 114 146 116Q134 116 132 98Z'],
      ['muzzle', E(100, 102, 22, 16)],
    ),
    deco: eye(84, 80, 6) + eye(116, 80, 6) +
      `<path d="M92 96q8-6 16 0q-2 7-8 8q-6-1-8-8z" fill="${INK}"/>` + line('M100 104v5M100 109q-6 6-11 1M100 109q6 6 11 1', 2.6),
  },
  {
    id: 'auto',
    name: 'car',
    regions: regs(
      ['road', Rr(0, 172, 200, 28)],
      ['cabin', 'M56 118L72 82Q76 74 86 74H128Q136 74 142 84L156 118Z'],
      ['win1', 'M72 114L84 86Q86 82 92 82H100V114Z'],
      ['win2', 'M108 114V82H126Q132 82 134 88L144 114Z'],
      ['body', 'M20 152Q20 118 52 116H152Q182 118 182 152V158Q182 168 172 168H30Q20 168 20 158Z'],
      ['light', E(174, 134, 6, 8)],
      ['wheel1', C(60, 166, 19)],
      ['wheel2', C(144, 166, 19)],
      ['hub1', C(60, 166, 7)],
      ['hub2', C(144, 166, 7)],
    ),
    deco: line('M104 120V160M112 132H120', 2.6) + line('M20 186H44M80 186H120M156 186H180', 3),
  },
  {
    id: 'kat',
    name: 'cat',
    regions: regs(
      ['tail', 'M138 168Q178 160 176 128Q174 108 162 116Q164 146 132 152Z'],
      ['body', E(100, 150, 44, 42)],
      ['belly', E(100, 158, 24, 26)],
      ['paw1', E(82, 188, 14, 9)],
      ['paw2', E(118, 188, 14, 9)],
      ['ear1', P([62, 70], [64, 28], [94, 52])],
      ['ear2', P([138, 70], [136, 28], [106, 52])],
      ['head', C(100, 86, 40)],
      ['inner1', P([70, 60], [70, 40], [86, 52])],
      ['inner2', P([130, 60], [130, 40], [114, 52])],
      ['nose', P([94, 96], [106, 96], [100, 104])],
    ),
    deco: eye(85, 84, 6) + eye(115, 84, 6) + line('M100 104q-5 8-11 4M100 104q5 8 11 4', 2.4) +
      line('M78 100H54M78 106L56 114M122 100H146M122 106L144 114', 2),
  },
  {
    id: 'vogel',
    name: 'bird',
    regions: regs(
      ['branch', 'M0 150Q100 136 200 156V168Q100 150 0 164Z'],
      ['leafa', leaf(30, 150, 14, 120, 10)],
      ['leafb', leaf(170, 158, 188, 128, 10)],
      ['tail', P([52, 102], [10, 84], [18, 104], [12, 124])],
      ['body', E(92, 106, 48, 38)],
      ['belly', E(102, 120, 30, 20)],
      ['wing', 'M66 96Q90 78 118 98Q102 124 72 118Z'],
      ['head', C(138, 78, 26)],
      ['beak', P([158, 72], [184, 80], [158, 90])],
    ),
    deco: eye(144, 74, 5) + line('M86 142v12M80 154h12M110 142v12M104 154h12', 3),
  },
  {
    id: 'boot',
    name: 'boat',
    regions: regs(
      ['sun', C(34, 38, 20)],
      ['flag', P([104, 28], [130, 36], [104, 44])],
      ['mast', Rr(98, 26, 7, 116, 3)],
      ['sail1', P([96, 46], [96, 132], [40, 132])],
      ['sail2', P([108, 52], [108, 132], [156, 132])],
      ['hull', 'M26 140H176L158 172H44Z'],
      ['port1', C(76, 155, 6)],
      ['port2', C(102, 155, 6)],
      ['port3', C(128, 155, 6)],
      ['sea', 'M0 170Q25 160 50 170T100 170T150 170T200 170V200H0Z'],
    ),
    deco: line('M150 40q10-10 20 0q10-10 20 0', 2.6),
  },
  {
    id: 'schildpad',
    name: 'turtle',
    regions: regs(
      ['ground', Rr(0, 178, 200, 22)],
      ['leg1', E(58, 166, 13, 16)],
      ['leg2', E(86, 170, 13, 16)],
      ['leg3', E(122, 170, 13, 16)],
      ['leg4', E(148, 166, 13, 16)],
      ['tail', P([40, 150], [18, 160], [42, 160])],
      ['head', E(170, 134, 22, 18)],
      ['shell', 'M38 152A64 64 0 0 1 166 152Z'],
      ['plate1', P([86, 104], [118, 104], [128, 126], [118, 148], [86, 148], [76, 126])],
      ['plate2', P([52, 148], [58, 128], [70, 126], [80, 148])],
      ['plate3', P([124, 148], [134, 126], [146, 128], [152, 148])],
      ['rim', Rr(32, 146, 140, 14, 7)],
    ),
    deco: eye(178, 128, 5) + smile(182, 140, 6),
  },
  {
    id: 'olifant',
    name: 'elephant',
    regions: regs(
      ['ground', Rr(0, 182, 200, 18)],
      ['leg1', Rr(44, 132, 22, 52, 8)],
      ['leg2', Rr(72, 136, 22, 48, 8)],
      ['leg3', Rr(104, 136, 22, 48, 8)],
      ['leg4', Rr(130, 132, 22, 52, 8)],
      ['tail', 'M30 112Q16 124 20 146L26 144Q24 128 34 118Z'],
      ['body', E(90, 112, 62, 44)],
      ['trunk', 'M168 104Q190 130 178 168Q176 176 168 172Q162 168 166 160Q174 132 156 112Z'],
      ['head', C(150, 90, 34)],
      ['ear', E(132, 94, 22, 30)],
      ['tusk', 'M164 118Q172 130 182 128Q174 122 170 112Z'],
    ),
    deco: eye(160, 80, 5) + line('M48 180h4M56 180h4M134 180h4M142 180h4', 2.4),
  },
  {
    id: 'raket',
    name: 'rocket',
    regions: regs(
      ['star1', star(34, 40, 16)],
      ['star2', star(168, 30, 12)],
      ['star3', star(176, 120, 14)],
      ['flame1', 'M86 160Q80 180 92 198Q100 184 98 160Z'],
      ['flame2', 'M114 160Q120 180 108 198Q100 184 102 160Z'],
      ['flame3', 'M96 160Q92 186 100 200Q108 186 104 160Z'],
      ['fin1', 'M74 116L48 156L76 150Z'],
      ['fin2', 'M126 116L152 156L124 150Z'],
      ['body', 'M74 70Q74 52 100 22Q126 52 126 70V156Q126 162 120 162H80Q74 162 74 156Z'],
      ['nose', 'M84 50Q92 34 100 22Q108 34 116 50Q100 56 84 50Z'],
      ['band', Rr(74, 128, 52, 12)],
      ['ring', C(100, 92, 17)],
      ['glass', C(100, 92, 10)],
      ['fin3', Rr(96, 140, 8, 24, 3)],
    ),
    deco: '',
  },
  {
    id: 'prieel',
    name: 'gazebo',
    regions: regs(
      ['grass', 'M0 170Q100 156 200 170V200H0Z'],
      ['bush1', 'M8 172Q4 146 24 142Q32 128 46 140Q62 140 58 172Z'],
      ['bush2', 'M142 172Q138 140 154 140Q168 128 176 142Q196 146 192 172Z'],
      ['floor', Rr(44, 158, 112, 14, 6)],
      ['pillar1', Rr(56, 92, 12, 68, 4)],
      ['pillar2', Rr(132, 92, 12, 68, 4)],
      ['rail', Rr(68, 132, 64, 8, 3)],
      ['post1', Rr(82, 140, 6, 18)],
      ['post2', Rr(97, 140, 6, 18)],
      ['post3', Rr(112, 140, 6, 18)],
      ['bubble', C(100, 116, 16)],
      ['roof', P([40, 94], [100, 34], [160, 94])],
      ['tip', Rr(97, 22, 6, 16, 3)],
      ['flower1', C(24, 150, 6)],
      ['flower2', C(176, 152, 6)],
    ),
    deco: '<ellipse cx="94" cy="110" rx="5" ry="3.5" fill="#fff" opacity=".85" transform="rotate(-30 94 110)"/>',
  },
]);

export const PICTURE_IDS = PICTURES.map((p) => p.id);
