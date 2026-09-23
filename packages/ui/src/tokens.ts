/**
 * Tokens du design system Coly (v0.1).
 * Source visuelle : canvas « Coly design system » (lien dans docs/design/design-system.md).
 * Règle : les composants lisent ces tokens, jamais un hex en dur.
 */

/** Palette de marque. Le vert est un accent : 80 % de l'interface vit sur les neutres. */
export const brand = {
  /** Texte principal, fond sombre (codes de retrait). */
  foret: "#132a13",
  /** Action principale. */
  pin: "#31572c",
  /** Liens, états actifs. */
  mousse: "#4f772d",
  /** Icônes, frises. Jamais en texte (contraste 2,6:1 sur blanc). */
  sauge: "#90a955",
  /** Signal « à retirer ». Jamais en texte sur fond clair. */
  citron: "#ecf39e",
} as const;

export const neutral = {
  page: "#F7F7F2",
  surface: "#FFFFFF",
  divider: "#ECECE4",
  border: "#E6E6DD",
  chip: "#EFEFE8",
  textPrimary: brand.foret,
  textSecondary: "#5C6157",
  textTertiary: "#686D63",
} as const;

/** Couleurs de statut utilisateur : fond + texte, toujours utilisés en paire. */
export const status = {
  pickup: { bg: brand.citron, fg: brand.foret },
  transit: { bg: "#EEF3E6", fg: "#3E5F28" },
  done: { bg: neutral.chip, fg: neutral.textSecondary },
  deadline: { bg: "#FCEFD6", fg: "#8A4B08" },
  problem: { bg: "#FBE7E4", fg: "#A1281B" },
} as const;

export type StatusTone = keyof typeof status;

/** Échelle d'espacement (px), multiples de 4. */
export const space = [0, 4, 8, 12, 16, 24, 32, 48] as const;

export const radius = {
  thumb: 10,
  button: 14,
  list: 16,
  card: 20,
  pill: 999,
} as const;

export const font = {
  sans: "Figtree, -apple-system, system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
} as const;

/** Échelle typographique : [taille px, graisse]. */
export const text = {
  largeTitle: [34, 700],
  screenTitle: [28, 700],
  section: [20, 700],
  rowLabel: [16, 600],
  body: [15, 400],
  meta: [13, 400],
} as const;

/** Cible tactile minimale (px). */
export const minTouchTarget = 44;

/**
 * Paires texte/fond réellement utilisées, vérifiées par test (WCAG AA : 4,5:1).
 * Ajouter ici toute nouvelle paire avant de l'utiliser dans un composant.
 */
export const textPairs = [
  { name: "texte principal / page", fg: neutral.textPrimary, bg: neutral.page },
  { name: "texte secondaire / surface", fg: neutral.textSecondary, bg: neutral.surface },
  { name: "texte secondaire / page", fg: neutral.textSecondary, bg: neutral.page },
  { name: "texte tertiaire / surface", fg: neutral.textTertiary, bg: neutral.surface },
  { name: "blanc / action principale", fg: neutral.surface, bg: brand.pin },
  { name: "lien / surface", fg: brand.mousse, bg: neutral.surface },
  { name: "citron / forêt", fg: brand.citron, bg: brand.foret },
  ...Object.entries(status).map(([tone, { fg, bg }]) => ({ name: `statut ${tone}`, fg, bg })),
] as const;
