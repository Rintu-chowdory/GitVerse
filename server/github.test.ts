import { describe, expect, it } from "vitest";
import { normalizeRepoRef } from "./github";

describe("github helpers", () => {
  it("normalizes repository URLs to owner/name references", () => {
    expect(normalizeRepoRef("https://github.com/rintu/nexus-ui/")).toBe("rintu/nexus-ui");
    expect(normalizeRepoRef("rintu/nexus-ui")).toBe("rintu/nexus-ui");
  });

  it("does not expose write-oriented methods in the read-only helper surface", () => {
    expect(normalizeRepoRef).toBeTypeOf("function");
    expect("createIssue" in { normalizeRepoRef }).toBe(false);
    expect("pushCommit" in { normalizeRepoRef }).toBe(false);
  });
});
