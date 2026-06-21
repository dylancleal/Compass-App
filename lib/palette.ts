// Calm, modern accent palette. Categories store a key; UI reads hex from here.
// Inline styles are used (not Tailwind classes) so colours stay data-driven.

export interface Accent {
  label: string;
  accent: string; // primary accent
  soft: string; // tinted background
  text: string; // readable text on soft bg
}

export const PALETTE: Record<string, Accent> = {
  blue: { label: "Blue", accent: "#3b82f6", soft: "#eff6ff", text: "#1e40af" },
  violet: { label: "Violet", accent: "#8b5cf6", soft: "#f5f3ff", text: "#5b21b6" },
  green: { label: "Green", accent: "#10b981", soft: "#ecfdf5", text: "#065f46" },
  amber: { label: "Amber", accent: "#f59e0b", soft: "#fffbeb", text: "#92400e" },
  teal: { label: "Teal", accent: "#14b8a6", soft: "#f0fdfa", text: "#115e59" },
  rose: { label: "Rose", accent: "#f43f5e", soft: "#fff1f2", text: "#9f1239" },
  indigo: { label: "Indigo", accent: "#6366f1", soft: "#eef2ff", text: "#3730a3" },
  slate: { label: "Slate", accent: "#64748b", soft: "#f8fafc", text: "#334155" },
};

export const PALETTE_KEYS = Object.keys(PALETTE);

export function accentOf(colorKey: string): Accent {
  return PALETTE[colorKey] ?? PALETTE.slate;
}
