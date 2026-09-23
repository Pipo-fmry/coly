/** Variables CSS générées depuis les tokens : les feuilles de style lisent `var(--…)`, jamais un hex. */

import { brand, font, neutral, radius, status } from "./tokens.ts";

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

export function cssVariables(): string {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(brand)) vars[`--brand-${k}`] = v;
  for (const [k, v] of Object.entries(neutral)) vars[`--${kebab(k)}`] = v;
  for (const [k, { bg, fg }] of Object.entries(status)) {
    vars[`--status-${k}-bg`] = bg;
    vars[`--status-${k}-fg`] = fg;
  }
  for (const [k, v] of Object.entries(radius)) vars[`--radius-${k}`] = `${v}px`;
  vars["--font-sans"] = font.sans;
  vars["--font-mono"] = font.mono;
  return `:root{${Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";")}}`;
}
