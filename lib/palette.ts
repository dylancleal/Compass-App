// Calm, modern accent palette. Categories store a key; UI reads hex from here.
// Inline styles are used (not Tailwind classes) so colours stay data-driven.

export interface Accent {
  label: string;
  accent: string; // primary accent
  soft: string; // tinted background
  text: string; // readable text on soft bg
}

// Earthy, muted accents tuned to sit in harmony with the Eucalyptus system —
// nature-toned rather than bright/digital. Keys are unchanged so stored
// category colours stay valid; only the hexes are softened.
export const PALETTE: Record<string, Accent> = {
  blue: { label: "Slate blue", accent: "#5a8ca8", soft: "#ecf2f5", text: "#2f5d78" },
  violet: { label: "Plum", accent: "#8478a8", soft: "#f1eef6", text: "#4f447a" },
  green: { label: "Eucalyptus", accent: "#5b8a72", soft: "#eaf2ec", text: "#3e6b54" },
  amber: { label: "Ochre", accent: "#c08a4b", soft: "#f7efe1", text: "#8a5e22" },
  teal: { label: "Spruce", accent: "#4e9b8a", soft: "#e9f4f1", text: "#2f6357" },
  rose: { label: "Clay", accent: "#c06b5a", soft: "#f8ece8", text: "#8a4435" },
  indigo: { label: "Indigo", accent: "#6a7ba8", soft: "#eef1f7", text: "#414f7a" },
  slate: { label: "Stone", accent: "#7d7c6e", soft: "#f3f1ea", text: "#54533f" },
};

export const PALETTE_KEYS = Object.keys(PALETTE);

export function accentOf(colorKey: string): Accent {
  return PALETTE[colorKey] ?? PALETTE.slate;
}
