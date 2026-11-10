import { describe, expect, test } from "bun:test";
import { postAuthDestination } from "./auth-navigation";

describe("completed authentication", () => {
  test("lands directly on /dashboard", () => {
    expect(postAuthDestination()).toBe("/dashboard");
  });
});