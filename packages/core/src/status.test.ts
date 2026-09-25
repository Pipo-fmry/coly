import { describe, expect, it } from "vitest";
import type { SourceKind, StatusFact } from "./facts.ts";
import type { UserStatus } from "./index.ts";
import { fromLaPosteCode, fromShip24Milestone, fuseStatus } from "./status.ts";

const obs = (kind: SourceKind, status: UserStatus, at: string): StatusFact => ({
  field: "status",
  value: status,
  kind,
  confidence: "certain",
  sourceRef: `${kind} ${at}`,
  observedAt: at,
});
const derive = (facts: StatusFact[]) => fuseStatus(facts)?.value;

describe("fuseStatus", () => {
  it("le cas AfterShip : « livré » du transporteur final l'emporte sur « disponible au retrait »", () => {
    expect(
      derive([
        obs("aggregator", "available_for_pickup", "2026-09-22T09:00"),
        obs("official_api", "delivered", "2026-09-21T18:00"),
      ]),
    ).toBe("delivered");
  });

  it("garde le rang le plus avancé entre sources non terminales", () => {
    expect(
      derive([
        obs("aggregator", "in_transit", "2026-09-22T09:00"),
        obs("official_api", "available_for_pickup", "2026-09-22T08:00"),
      ]),
    ).toBe("available_for_pickup");
  });

  it("signale un problème s'il est l'observation la plus récente", () => {
    expect(
      derive([
        obs("aggregator", "in_transit", "2026-09-20T09:00"),
        obs("aggregator", "problem", "2026-09-21T09:00"),
      ]),
    ).toBe("problem");
  });

  it("ignore un vieux problème résolu depuis", () => {
    expect(
      derive([
        obs("aggregator", "problem", "2026-09-19T09:00"),
        obs("aggregator", "out_for_delivery", "2026-09-21T09:00"),
      ]),
    ).toBe("out_for_delivery");
  });

  it("donne les sources de la valeur retenue", () => {
    expect(
      fuseStatus([
        obs("carrier_email", "available_for_pickup", "2026-09-18T14:42"),
        obs("aggregator", "available_for_pickup", "2026-09-18T14:19"),
        obs("aggregator", "in_transit", "2026-09-17T09:00"),
      ])?.sources,
    ).toEqual(["carrier_email 2026-09-18T14:42", "aggregator 2026-09-18T14:19"]);
  });

  it("ne renvoie rien sans observation", () => {
    expect(derive([])).toBeUndefined();
  });
});

describe("correspondances des sources", () => {
  it("traduit les codes La Poste connus et ignore les autres", () => {
    expect(fromLaPosteCode("DI1")).toBe("delivered");
    expect(fromLaPosteCode("AG1")).toBe("available_for_pickup");
    expect(fromLaPosteCode("PB2")).toBe("problem");
    expect(fromLaPosteCode("ET3")).toBe("in_transit");
    expect(fromLaPosteCode("ZZ9")).toBeUndefined();
  });

  it("traduit les jalons Ship24", () => {
    expect(fromShip24Milestone("failed_attempt")).toBe("problem");
    expect(fromShip24Milestone("available_for_pickup")).toBe("available_for_pickup");
    expect(fromShip24Milestone("pending")).toBeUndefined();
  });
});
