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
};

const HEX = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;

function parseColors(value) {
  const colors = value.split(",").map((c) => c.trim()).filter(Boolean);
  if (colors.length !== 5 || !colors.every((c) => HEX.test(c))) {
    throw new Error(`Expected five hex colors, got "${value}".`);
  }
  return colors;
}

export function resolveTheme(mode, { palette = "github", colorsDark = "", colorsLight = "" } = {}) {
  const base = PALETTES[palette];
  if (!base && !(colorsDark && colorsLight)) {
    throw new Error(`Unknown palette "${palette}". Use ${Object.keys(PALETTES).join(" or ")}, or set both custom color lists.`);
  }
  const custom = mode === "dark" ? colorsDark : colorsLight;
  const levels = custom ? parseColors(custom) : base[mode];
  return { ...SURFACES[mode], levels };
}
