import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { postAuthDestination } from "./auth-navigation";

describe("completed authentication", () => {
  it("lands directly on /dashboard", () => {
    assert.equal(postAuthDestination(), "/dashboard");
  });
});