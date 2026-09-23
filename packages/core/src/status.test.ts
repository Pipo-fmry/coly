import { describe, expect, it } from "vitest";
import { deriveStatus, fromLaPosteCode, fromShip24Milestone } from "./status.ts";

describe("deriveStatus", () => {
  it("le cas AfterShip : « livré » du transporteur final l'emporte sur « disponible au retrait »", () => {
    expect(
      deriveStatus([
        { source: "ship24", status: "available_for_pickup", at: "2026-09-22T09:00" },
        { source: "laposte", status: "delivered", at: "2026-09-21T18:00" },
      ]),
    ).toBe("delivered");
  });

  it("garde le rang le plus avancé entre sources non terminales", () => {
    expect(
      deriveStatus([
        { source: "ship24", status: "in_transit", at: "2026-09-22T09:00" },
        { source: "laposte", status: "available_for_pickup", at: "2026-09-22T08:00" },
      ]),
    ).toBe("available_for_pickup");
  });

  it("signale un problème s'il est l'observation la plus récente", () => {
    expect(
      deriveStatus([
        { source: "ship24", status: "in_transit", at: "2026-09-20T09:00" },
        { source: "ship24", status: "problem", at: "2026-09-21T09:00" },
      ]),
    ).toBe("problem");
  });

  it("ignore un vieux problème résolu depuis", () => {
    expect(
      deriveStatus([
        { source: "ship24", status: "problem", at: "2026-09-19T09:00" },
        { source: "ship24", status: "out_for_delivery", at: "2026-09-21T09:00" },
      ]),
    ).toBe("out_for_delivery");
  });

  it("ne renvoie rien sans observation", () => {
    expect(deriveStatus([])).toBeUndefined();
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
