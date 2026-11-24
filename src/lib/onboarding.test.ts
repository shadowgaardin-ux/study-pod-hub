import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { TOUR_METADATA_KEY, hasCompletedTour, rememberTourOnDevice } from "./onboarding";

function memoryStore() {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
}

describe("onboarding tour completion", () => {
  it("is shown to a user who has never completed it", () => {
    assert.equal(hasCompletedTour("user-a", {}, memoryStore()), false);
  });

  it("is remembered per user, not per device", () => {
    const store = memoryStore();
    rememberTourOnDevice("user-a", store);
    assert.equal(hasCompletedTour("user-a", {}, store), true);
    assert.equal(hasCompletedTour("user-b", {}, store), false);
  });

  it("counts completion saved on the account from another device", () => {
    assert.equal(hasCompletedTour("user-a", { [TOUR_METADATA_KEY]: "2026-11-24T00:00:00Z" }, memoryStore()), true);
  });
});
