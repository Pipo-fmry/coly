import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast.ts";
import { brand, neutral, textPairs } from "./tokens.ts";

describe("contrastRatio", () => {
  it("donne 21:1 pour noir sur blanc", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });

  it("rejette une couleur mal formée", () => {
    expect(() => contrastRatio("#fff", "#000000")).toThrow();
  });
});

describe("paires texte/fond du design system", () => {
  it.each(textPairs)("$name respecte WCAG AA (≥ 4,5:1)", ({ fg, bg }) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("sauge et citron restent interdits en texte sur fond clair", () => {
    expect(contrastRatio(brand.sauge, neutral.surface)).toBeLessThan(4.5);
    expect(contrastRatio(brand.citron, neutral.surface)).toBeLessThan(4.5);
  });
});
