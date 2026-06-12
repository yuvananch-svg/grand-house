import { describe, expect, it } from "vitest";
import { makeClientId } from "./ids";

describe("id utilities", () => {
  it("adds a stable device suffix to client-created ids", () => {
    const id = makeClientId("SAL", "DEV-12345678-ABCD");
    expect(id).toMatch(/^SAL-\d+-[A-Z0-9]{4}-5678ABCD$/);
  });
});
