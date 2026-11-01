// Surface colors follow GitHub's Primer tokens so the graph sits naturally on
// a profile page; the five activity colors come from the chosen palette.

export const SURFACES = {
  dark: {
    background: "#0d1117",
    border: "#30363d",
    text: "#e6edf3",
    muted: "#9198a1",
  },
  light: {
    background: "#ffffff",
    border: "#d1d9e0",
    text: "#1f2328",
    muted: "#59636e",
  },
};

export const PALETTES = {
  // GitHub's own contribution greens.
  github: {
    dark: ["#151b23", "#033a16", "#196c2e", "#2ea043", "#56d364"],
    light: ["#eff2f5", "#aceebb", "#4ac26b", "#2da44e", "#116329"],
  },
  // A warm pink-to-ember ramp for brands that want their own accent.
  ember: {
    dark: ["#151b23", "#4c0f27", "#82143f", "#c0185a", "#f2447f"],
    light: ["#eff2f5", "#fbcfde", "#f48bb0", "#e2487f", "#a80f45"],
  },
  // Seasons and holidays. Every ramp gets stronger with activity: brighter on
  // dark surfaces, darker on light ones.
  // Cherry blossom.
  spring: {
    dark: ["#151b23", "#4a1d3f", "#8a2f6b", "#d15a9e", "#ffb3d9"],
    light: ["#eff2f5", "#fcd5e5", "#f7a1c4", "#e0589a", "#a31d66"],
  },
  // Warm sea.
  summer: {
    dark: ["#151b23", "#06343a", "#0b6b6f", "#14a8a3", "#5ff0d6"],
    light: ["#eff2f5", "#b5f0e4", "#5bd6c4", "#14a195", "#0b5f5c"],
  },
  // Maple leaves.
  autumn: {
    dark: ["#151b23", "#4f1a12", "#8f2a1c", "#cc4a23", "#f2a03d"],
    light: ["#eff2f5", "#fbd9a8", "#f09a5a", "#cc4a23", "#7a1f12"],
  },
  // Pumpkin glow.
  halloween: {
    dark: ["#151b23", "#631c03", "#bd561d", "#fa7a18", "#fddf68"],
    light: ["#eff2f5", "#ffe45c", "#ffc83d", "#f68c41", "#1f2328"],
  },
  // GitHub's own winter colors.
  winter: {
    dark: ["#151b23", "#0c2d6b", "#1158c7", "#58a6ff", "#cae8ff"],
    light: ["#eff2f5", "#b6e3ff", "#54aeff", "#0969da", "#0a3069"],
  },
  // Pine, holly berries and a gold star.
  christmas: {
    dark: ["#151b23", "#0f3d24", "#1c7a3e", "#e5383b", "#ffd166"],
    light: ["#eff2f5", "#b7e4c0", "#3fa866", "#d1343a", "#7a1418"],
  },
  // Midnight and champagne.
  newyear: {
    dark: ["#151b23", "#2a1f5e", "#6b3fa0", "#d9a92a", "#fff3c4"],
    light: ["#eff2f5", "#ffeaa0", "#e8b93a", "#8e5bd0", "#3a1a7a"],
  },
};

// Month and day ranges for the seasonal palette, both ends included. The first
// match wins, so holidays come before the season around them. A range that
// ends before it starts runs across New Year.
const SEASONS = [
  ["halloween", "10-25", "10-31"],
  ["christmas", "12-18", "12-26"],
  ["newyear", "12-27", "01-02"],
  ["winter", "12-01", "02-29"],
  ["spring", "03-01", "05-31"],
  ["summer", "06-01", "08-31"],
  ["autumn", "09-01", "11-30"],
];

/** Palette name for a YYYY-MM-DD day. */
export function seasonFor(key) {
  const day = key.slice(5);
  const [name] = SEASONS.find(([, from, to]) =>
    from <= to ? day >= from && day <= to : day >= from || day <= to,
  );
  return name;
}

const HEX = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;

function parseColors(value) {
  const colors = value.split(",").map((c) => c.trim()).filter(Boolean);
  if (colors.length !== 5 || !colors.every((c) => HEX.test(c))) {
    throw new Error(`Expected five hex colors, got "${value}".`);
  }
  return colors;
}

export function resolveTheme(mode, { palette = "github", colorsDark = "", colorsLight = "", todayKey = new Date().toISOString().slice(0, 10) } = {}) {
  const base = PALETTES[palette === "seasonal" ? seasonFor(todayKey) : palette];
  if (!base && !(colorsDark && colorsLight)) {
    throw new Error(`Unknown palette "${palette}". Use seasonal, ${Object.keys(PALETTES).join(", ")}, or set both custom color lists.`);
  }
  const custom = mode === "dark" ? colorsDark : colorsLight;
  const levels = custom ? parseColors(custom) : base[mode];
  return { ...SURFACES[mode], levels };
}
