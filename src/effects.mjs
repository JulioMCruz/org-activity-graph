// Seasonal decoration: a short burst of motion when the graph loads, plus a few
// pieces that stay in the empty bands around the squares. Everything is plain
// SVG and CSS, since a README shows the file as an image, with no scripts and
// no outside files. Moving pieces leave the frame when they finish, and pieces
// that stay never touch a square or a label.

// Colors per season, for the dark and the light surface. A color shared with a
// palette level must map to the same light color as that level, because the
// adaptive file swaps colors by value.
export const EFFECT_COLORS = {
  // Snow, shadow, carrot, coal.
  winter: {
    dark: ["#eaf4ff", "#9cc4ec", "#f2a03d", "#1f2a38"],
    light: ["#b9d5f0", "#86b6e4", "#e8862e", "#2b3a4d"],
  },
  // Four leaf tones.
  autumn: {
    dark: ["#f2a13e", "#cc4a23", "#902b1d", "#e8c14f"],
    light: ["#f09a5a", "#cc4a23", "#7a1f12", "#d9a520"],
  },
  // Pumpkin, pumpkin shade, stem, candle light, bat.
  halloween: {
    dark: ["#fa7a18", "#bd571e", "#2ea043", "#fde068", "#b3a7dc"],
    light: ["#f68c41", "#c8601c", "#2da44e", "#ffd642", "#3b2f4f"],
  },
  // Red, green, gold, wire, snow.
  christmas: {
    dark: ["#e5383b", "#2ea043", "#ffd267", "#5a6472", "#eaf4ff"],
    light: ["#d1343a", "#2da44e", "#e0a82e", "#8c959f", "#cfe3f7"],
  },
  // Gold, champagne, violet, pink, glass.
  newyear: {
    dark: ["#d9aa2b", "#fff2c3", "#8e5bd0", "#ec1b69", "#c9d1d9"],
    light: ["#c99a1e", "#e8b93a", "#6b3fa0", "#d1155c", "#8c959f"],
  },
  // Blossom, pale blossom, branch, pollen.
  spring: {
    dark: ["#d15a9e", "#ffb4da", "#7a5a4a", "#ffe08a"],
    light: ["#e0589a", "#f7a1c4", "#8a6a55", "#e8b93a"],
  },
  // Sun, sun rays, sea, foam, sail.
  summer: {
    dark: ["#ffd267", "#f2a13e", "#14a8a3", "#5ff1d7", "#e6edf3"],
    light: ["#f5b82e", "#e8862e", "#14a195", "#5bd6c4", "#59636e"],
  },
};

const round = (n) => Math.round(n * 10) / 10;

function seeded(text) {
  let s = [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// Shapes centered on their origin, for pieces in motion.
const leaf = (color) =>
  `<path fill="${color}" d="M0-8 1.6-4.4 3.8-5.4 3.2-2.2 6.8-3 5.6-.6 7.4.4 3.6 2.6 4 4.6.7 3.9.7 7.6-.7 7.6-.7 3.9-4 4.6-3.6 2.6-7.4.4-5.6-.6-6.8-3-3.2-2.2-3.8-5.4-1.6-4.4Z"/>`;
const flake = (color) =>
  `<path fill="none" stroke="${color}" stroke-width="1.1" stroke-linecap="round" d="M0-6V6M-5.2-3 5.2 3M-5.2 3 5.2-3"/>`;
const dot = (color, r = 1.8) => `<circle r="${r}" fill="${color}"/>`;
const petal = (color) => `<path fill="${color}" d="M0-5C3-3 3.4 2 0 5-3.4 2-3-3 0-5Z"/>`;
const bubble = (color) =>
  `<circle r="4" fill="none" stroke="${color}" stroke-width="1"/><circle cx="-1.4" cy="-1.4" r=".8" fill="${color}"/>`;
const confetti = (color) => `<rect x="-1.5" y="-3" width="3" height="6" rx=".6" fill="${color}"/>`;
const bat = (color) =>
  `<path fill="${color}" d="M0 1C-1.2-.6-2.4-1-3.4-.2-4.6-2-7-2.4-9-1-7.6-.6-7-.2-6.4 1-5.4.2-4 .2-3.2 1.4-2 .8-.8 1 0 2.6.8 1 2 .8 3.2 1.4 4 .2 5.4.2 6.4 1 7-.2 7.6-.6 9-1 7-2.4 4.6-2 3.4-.2 2.4-1 1.2-.6 0 1ZM-1-.4-1.5-2.2-.5-1.2H.5L1.5-2.2 1-.4Z"/>`;

// Shapes standing on their origin, for pieces that stay.
const pumpkin = ([body, shade, stem, candle], size) =>
  `<g transform="scale(${round(size / 16)})"><ellipse cx="-4.6" cy="-7" rx="4.4" ry="6.4" fill="${shade}"/><ellipse cx="4.6" cy="-7" rx="4.4" ry="6.4" fill="${shade}"/><ellipse cy="-7" rx="5" ry="7" fill="${body}"/><path fill="${stem}" d="M-.9-13.6.1-16.4 2-15.8.9-13.6Z"/><path class="blink" fill="${candle}" d="M-5-9.4-2.4-10-2.8-7.4ZM5-9.4 2.4-10 2.8-7.4ZM-4.4-4.8Q-2.6-4.2-1.6-4.6L-1-3.8 0-4.4 1-3.8 1.6-4.6Q2.6-4.2 4.4-4.8 0-1.2-4.4-4.8Z"/></g>`;
const snowman = ([snow, shade, carrot, coal]) =>
  `<circle cy="-7" r="7" fill="${snow}"/><circle cy="-17.5" r="5" fill="${snow}"/><path d="M-7-7A7 7 0 0 0 7-7 8 8 0 0 1-7-7Z" fill="${shade}"/><path fill="${carrot}" d="M.6-18 6-17 .6-16Z"/><circle cx="-1.6" cy="-19" r=".8" fill="${coal}"/><circle cx="1.6" cy="-19" r=".8" fill="${coal}"/><circle cy="-10" r=".8" fill="${coal}"/><circle cy="-6.6" r=".8" fill="${coal}"/>`;
const tree = ([red, green, gold]) =>
  `<path fill="${green}" d="M0-30-7-19H-4L-9-11H-5L-11-3H11L5-11H9L4-19H7Z"/><path fill="${gold}" d="M0-33 1-30.8 3.2-30.6 1.5-29.1 2-27 0-28.1-2-27-1.5-29.1-3.2-30.6-1-30.8Z"/><circle cx="-3" cy="-13" r="1.2" fill="${red}"/><circle cx="4" cy="-8" r="1.2" fill="${gold}"/><circle cx="2" cy="-18" r="1.2" fill="${red}"/><path fill="${gold}" d="M-1.6-3H1.6V0H-1.6Z"/>`;
const flute = (glass, wine) =>
  `<path fill="${wine}" d="M-3.6-23H3.6L2.6-14Q0-11.6-2.6-14Z"/><path fill="none" stroke="${glass}" stroke-width="1" stroke-linecap="round" d="M-4-27-2.8-13.6Q0-10.6 2.8-13.6L4-27M0-11.4V-1M-3.4-.5H3.4"/>`;
const star = (color, size) =>
  `<path fill="${color}" transform="scale(${round(size / 12)})" d="M0-12 1.4-7.4 6-6 1.4-4.6 0 0-1.4-4.6-6-6-1.4-7.4Z"/>`;
const blossom = ([pink, pale, , pollen], x, y, size) => {
  const petals = [0, 72, 144, 216, 288]
    .map((angle) => `<ellipse cy="-2.4" rx="1.9" ry="2.6" fill="${pale}" transform="rotate(${angle})"/>`)
    .join("");
  return `<g transform="translate(${x} ${y}) scale(${size})">${petals}<circle r="1.1" fill="${pollen}"/><circle r=".4" fill="${pink}"/></g>`;
};
const sun = ([core, rays]) => {
  const beams = Array.from({ length: 8 }, (_, i) => `<rect x="-.9" y="-14" width="1.8" height="4" rx=".9" fill="${rays}" transform="rotate(${i * 45})"/>`).join("");
  return `<g transform="translate(0 -14)">${beams}<circle r="7.6" fill="${core}"/></g>`;
};
const boat = ([, , , , sail], hull) =>
  `<path fill="${sail}" d="M.8-17V-5H9ZM-.8-14V-5H-7Z"/><path fill="${hull}" d="M-9-3.6H10L7 0H-6Z"/>`;

/** A piece that drifts across the whole graph, swaying and turning. */
function drifter(rand, layout, shape, { rise = false, spread = 2.2 } = {}) {
  const t = round(3 + rand() * 2);
  const delay = round(rand() * spread);
  const scale = round(0.7 + rand() * 0.6);
  const turn = Math.round(120 + rand() * 360) * (rand() < 0.5 ? -1 : 1);
  const style = `--t:${t}s;--w:${delay}s;--a:${round(3 + rand() * 9)}px;--s:${round(0.7 + rand() * 0.7)}s;--r:${turn}deg`;
  const x = round(rand() * layout.width);
  return `<g transform="translate(${x} 0)" style="${style}"><g class="${rise ? "rise" : "drop"}"><g class="sway"><g class="spin"><g transform="scale(${scale})">${shape}</g></g></g></g></g>`;
}

/** A bat that crosses the frame near the top, flapping. */
function flyer(rand, layout, color, index) {
  const style = `--t:${round(2.6 + rand() * 1.4)}s;--w:${round(index * 0.5 + rand() * 0.3)}s;--b:${Math.round(rand() * 34 - 8)}px`;
  const y = round(20 + rand() * 170);
  return `<g transform="translate(0 ${y})" style="${style}"><g class="fly"><g class="flap"><g transform="scale(1.5)">${bat(color)}</g></g></g></g>`;
}

/** A firework: sparks that open from one point and fade away. */
function burst(rand, x, y, delay, colors) {
  const sparks = Array.from({ length: 18 }, (_, i) => {
    const angle = (i / 18) * Math.PI * 2;
    const reach = 40 + rand() * 30;
    const style = `--x:${round(Math.cos(angle) * reach)}px;--y:${round(Math.sin(angle) * reach)}px;--w:${delay}s`;
    return `<circle class="spark" r="2.1" fill="${colors[i % colors.length]}" style="${style}"/>`;
  }).join("");
  return `<g transform="translate(${x} ${y})">${sparks}</g>`;
}

const motionCss = (layout) =>
  [
    `.drop{animation:drop var(--t) linear var(--w) both}`,
    `@keyframes drop{from{transform:translateY(-16px)}to{transform:translateY(${layout.height + 16}px)}}`,
    `.rise{animation:rise var(--t) linear var(--w) both}`,
    `@keyframes rise{from{transform:translateY(${layout.height + 16}px)}to{transform:translateY(-16px)}}`,
    `.sway{animation:sway var(--s) ease-in-out var(--w) 8 alternate}`,
    `@keyframes sway{from{transform:translateX(calc(var(--a)*-1))}to{transform:translateX(var(--a))}}`,
    `.spin{animation:spin var(--t) linear var(--w) both}`,
    `@keyframes spin{to{transform:rotate(var(--r))}}`,
    `.fly{animation:fly var(--t) ease-in-out var(--w) both}`,
    `@keyframes fly{from{transform:translate(-20px,0)}50%{transform:translate(${Math.round(layout.width / 2)}px,var(--b))}to{transform:translate(${layout.width + 20}px,0)}}`,
    `.flap{animation:flap .18s ease-in-out 40 alternate}`,
    `@keyframes flap{to{transform:scaleY(.4)}}`,
    `.spark{animation:spark 1.3s ease-out var(--w) both}`,
    `@keyframes spark{from{opacity:0;transform:none}10%{opacity:1}to{opacity:0;transform:translate(var(--x),var(--y))}}`,
    `.piece{animation:piece .5s cubic-bezier(.2,.9,.3,1.3) var(--w) both;transform-box:fill-box;transform-origin:center bottom}`,
    `@keyframes piece{from{opacity:.35;transform:scale(.6)}to{opacity:1;transform:none}}`,
    `.blink{animation:blink .6s ease-in-out var(--w) 10 alternate}`,
    `@keyframes blink{to{opacity:.3}}`,
    `@media (prefers-reduced-motion:reduce){.fx{display:none}.piece,.blink{animation:none}}`,
  ].join("");

/** A piece that stays, standing on (x, y). Boxes let the tests prove it clears the data. */
function resting(layout, x, y, w, h, svg) {
  const left = round(x - w / 2);
  return {
    box: { x: left, y: round(y - h), w, h },
    svg: `<g transform="translate(${x} ${y})" style="--w:${layout.delayAt(x)}s"><g class="piece">${svg}</g></g>`,
  };
}

const footerX = (layout, share) => round(layout.footerFrom + (layout.footerTo - layout.footerFrom) * share);

const SEASONS = {
  winter(c, rand, layout) {
    const moving = Array.from({ length: 52 }, (_, i) =>
      drifter(rand, layout, i % 5 === 0 ? flake(c[0]) : dot(c[0], round(1 + rand() * 1.2))),
    );
    let d = `M2 ${layout.frameTop}`;
    let x = 2;
    while (x < layout.boxW - 2) {
      const step = Math.min(24 + Math.round(rand() * 38), layout.boxW - x);
      d += `q${round(step / 2)} ${-round(4 + rand() * 7)} ${step} 0`;
      x += step;
    }
    return {
      moving,
      rest: [
        { box: { x: 2, y: layout.frameTop - 6, w: layout.boxW - 2, h: 6 }, svg: `<path fill="${c[0]}" d="${d}Z"/>` },
        resting(layout, layout.width - 34, layout.frameTop - 2, 18, 30, `<g transform="scale(1.3)">${snowman(c)}</g>`),
      ],
    };
  },
  autumn(c, rand, layout) {
    const moving = Array.from({ length: 30 }, (_, i) => drifter(rand, layout, leaf(c[i % c.length])));
    const pile = [[-44, 0.8], [-30, 1.05], [-16, 0.9], [-4, 1.2], [10, 0.95], [24, 1.1], [-22, 0.8], [2, 0.8]];
    const rest = pile.map(([dx, size], i) => {
      const x = layout.width - 62 + dx;
      const lift = i > 5 ? 11 : 6;
      const shape = `<g transform="translate(0 ${-lift}) rotate(${Math.round(rand() * 80 - 40)}) scale(${size})">${leaf(c[i % c.length])}</g>`;
      return resting(layout, x, layout.frameTop, 18, 21, shape);
    });
    rest.push(resting(layout, footerX(layout, 0.42), layout.legendY + 13, 12, 12, `<g transform="translate(0 -6) rotate(24) scale(.72)">${leaf(c[1])}</g>`));
    rest.push(resting(layout, footerX(layout, 0.6), layout.legendY + 13, 12, 12, `<g transform="translate(0 -6) rotate(-30) scale(.72)">${leaf(c[0])}</g>`));
    return { moving, rest };
  },
  halloween(c, rand, layout) {
    const moving = Array.from({ length: 7 }, (_, i) => flyer(rand, layout, c[4], i));
    const rest = [
      resting(layout, layout.width - 40, layout.frameTop, 30, 31, pumpkin(c, 30)),
      resting(layout, layout.width - 74, layout.frameTop, 24, 24, pumpkin(c, 23)),
      resting(layout, layout.width - 102, layout.frameTop, 18, 18, pumpkin(c, 17)),
      resting(layout, footerX(layout, 0.32), layout.legendY + 13, 13, 13, pumpkin(c, 12.5)),
      resting(layout, footerX(layout, 0.5), layout.legendY + 13, 15, 15, pumpkin(c, 14.5)),
      resting(layout, footerX(layout, 0.68), layout.legendY + 13, 13, 13, pumpkin(c, 12.5)),
    ];
    if (layout.hasStrips) {
      rest.push(resting(layout, layout.boxW - 46, layout.stripsTop + 25, 20, 19, pumpkin(c, 18)));
      rest.push(resting(layout, layout.boxW - 72, layout.stripsTop + 25, 15, 15, pumpkin(c, 14)));
    }
    return { moving, rest };
  },
  christmas(c, rand, layout) {
    const moving = Array.from({ length: 44 }, (_, i) =>
      drifter(rand, layout, i % 5 === 0 ? flake(c[4]) : dot(c[4], round(1 + rand() * 1.2))),
    );
    const span = layout.boxW - 12;
    const count = Math.floor(span / 44);
    const swag = span / count;
    let wire = `M8 ${layout.frameTop - 10}`;
    const bulbs = [];
    for (let i = 0; i < count; i++) {
      const x0 = 8 + i * swag;
      wire += `Q${round(x0 + swag / 2)} ${layout.frameTop - 3} ${round(x0 + swag)} ${layout.frameTop - 10}`;
      const style = `--w:${round(0.2 + (i % 4) * 0.3)}s`;
      bulbs.push(`<circle class="blink" cx="${round(x0 + swag / 2)}" cy="${layout.frameTop - 3.4}" r="2.4" fill="${c[[0, 2, 1][i % 3]]}" style="${style}"/>`);
    }
    return {
      moving,
      rest: [
        { box: { x: 8, y: layout.frameTop - 10, w: span, h: 10 }, svg: `<path fill="none" stroke="${c[3]}" stroke-width="1" d="${wire}"/>${bulbs.join("")}` },
        resting(layout, layout.width - 42, layout.frameTop - 6, 22, 28, `<g transform="scale(.84)">${tree(c)}</g>`),
      ],
    };
  },
  newyear(c, rand, layout) {
    const sparks = [c[0], c[1], c[2], c[3]];
    const moving = Array.from({ length: 34 }, (_, i) => drifter(rand, layout, confetti(sparks[i % 4]), { spread: 2.8 }));
    const points = [[0.14, 76, 0.2], [0.34, 112, 0.7], [0.55, 70, 1.1], [0.78, 118, 1.6], [0.24, 150, 2], [0.66, 160, 2.4], [0.9, 66, 2.8], [0.45, 92, 3.2]];
    for (const [share, y, delay] of points) moving.push(burst(rand, Math.round(layout.width * share), y, delay, sparks));
    const clink = `<g transform="translate(-6 0) rotate(-8)">${flute(c[4], c[0])}</g><g transform="translate(7 0) rotate(8)">${flute(c[4], c[0])}</g>`;
    const rest = [
      resting(layout, layout.width - 44, layout.frameTop, 26, 29, clink),
      resting(layout, layout.width - 78, layout.frameTop - 6, 11, 12, star(c[1], 12)),
      resting(layout, layout.width - 96, layout.frameTop - 14, 9, 10, star(c[0], 9.5)),
      resting(layout, footerX(layout, 0.4), layout.legendY + 12, 10, 10, star(c[0], 10)),
      resting(layout, footerX(layout, 0.6), layout.legendY + 12, 10, 10, star(c[1], 10)),
    ];
    return { moving, rest };
  },
  spring(c, rand, layout) {
    const moving = Array.from({ length: 34 }, (_, i) => drifter(rand, layout, petal(i % 3 ? c[1] : c[0])));
    const branch = `<path fill="none" stroke="${c[2]}" stroke-width="1.6" stroke-linecap="round" d="M60-1Q20-6-6-12-30-17-54-16M-6-12Q-14-22-26-27M28-5Q20-14 8-23"/>`;
    const flowers = [[-54, -16, 1.2], [-40, -8, 0.8], [-26, -27, 1.1], [-14, -9, 1], [8, -23, 1.2], [18, -12, 0.9], [38, -20, 0.8], [46, -9, 1]]
      .map(([x, y, size]) => blossom(c, x, y, size))
      .join("");
    const rest = [resting(layout, layout.width - 72, layout.frameTop - 1, 120, 32, `${branch}${flowers}`)];
    rest.push(resting(layout, footerX(layout, 0.5), layout.legendY + 11, 12, 11, blossom(c, 0, -5, 1)));
    return { moving, rest };
  },
  summer(c, rand, layout) {
    const moving = Array.from({ length: 30 }, () => drifter(rand, layout, bubble(c[3]), { rise: true }));
    let waves = `M2 ${layout.frameTop - 3}`;
    const step = 22;
    const count = Math.floor((layout.boxW - 4) / step);
    for (let i = 0; i < count; i++) waves += `q${step / 2} ${i % 2 ? 3.4 : -3.4} ${step} 0`;
    const rest = [
      { box: { x: 2, y: layout.frameTop - 7, w: layout.boxW - 4, h: 7 }, svg: `<path fill="none" stroke="${c[2]}" stroke-width="1.4" stroke-linecap="round" d="${waves}"/>` },
      resting(layout, layout.width - 38, layout.frameTop - 4, 28, 28, `<g transform="translate(0 2) scale(.96)">${sun(c)}</g>`),
      resting(layout, layout.width - 96, layout.frameTop - 2, 20, 18, boat(c, c[1])),
    ];
    return { moving, rest };
  },
};

export const hasEffect = (season) => Boolean(SEASONS[season]);

/**
 * Moving pieces, resting pieces and the CSS for one season, or null for a
 * palette without an effect. Resting pieces that would run into a long title
 * are left out.
 */
export function seasonEffect(season, colors, layout) {
  if (!hasEffect(season)) return null;
  const { moving, rest } = SEASONS[season](colors, seeded(season), layout);
  const wide = (piece) => piece.box.h <= 10;
  const kept = rest.filter((piece) => wide(piece) || piece.box.y >= layout.frameTop || piece.box.x > layout.titleEnd);
  return {
    css: motionCss(layout),
    resting: kept,
    moving: `<g class="fx">${moving.join("")}</g>`,
  };
}
