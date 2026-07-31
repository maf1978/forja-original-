import { describe, expect, it } from "vitest";
import { scoreRealEstateLead } from "../../src/tools/qualifyRealEstateLead";

describe("scoreRealEstateLead", () => {
  it("prioritizes a preapproved buyer with budget and timing", () => {
    const result = scoreRealEstateLead({ operation: "buyer", contact: "ana@example.com", area: "Miami", budget: "$600k", timeline: "30 days", preapproved: true });
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.tags).toContain("buyer");
    expect(result.tags).toContain("hot");
    expect(result.tags).toContain("preapproved");
  });
});
