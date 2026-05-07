import { describe, it, expect } from "vitest";
import {
  listProviders,
  listReadyProviders,
  listProvidersByCapability,
  isProviderReady,
  getProvider,
} from "../registry.js";

describe("provider registry", () => {
  describe("listProviders", () => {
    it("returns all registered providers", () => {
      const all = listProviders();
      const ids = all.map((p) => p.id);
      expect(ids).toContain("mock");
      expect(ids).toContain("statsbomb");
      expect(ids).toContain("sportmonks");
      expect(ids).toContain("football-data-org");
      expect(ids).toContain("openfootball");
      expect(ids).toContain("api-football");
    });
  });

  describe("listReadyProviders", () => {
    it("includes mock provider", () => {
      const ready = listReadyProviders();
      expect(ready.find((p) => p.id === "mock")).toBeDefined();
    });

    it("excludes placeholder providers (StatsBomb)", () => {
      const ready = listReadyProviders();
      expect(ready.find((p) => p.id === "statsbomb")).toBeUndefined();
    });

    it("excludes placeholder providers (Sportmonks without key)", () => {
      const ready = listReadyProviders();
      expect(ready.find((p) => p.id === "sportmonks")).toBeUndefined();
    });
  });

  describe("isProviderReady", () => {
    it("returns true for mock (full, no key required)", () => {
      const mock = getProvider("mock");
      expect(isProviderReady(mock.meta)).toBe(true);
    });

    it("returns false for statsbomb (placeholder)", () => {
      const sb = getProvider("statsbomb");
      expect(isProviderReady(sb.meta)).toBe(false);
    });

    it("returns false for sportmonks (placeholder, needs key)", () => {
      const sm = getProvider("sportmonks");
      expect(isProviderReady(sm.meta)).toBe(false);
    });

    it("returns true for providers without status field (backward compat)", () => {
      // A provider with no status field should default to "full"
      const fakeProvider = {
        id: "test",
        name: "Test",
        description: "test",
        requiresApiKey: false,
        tokenConfigured: false,
      };
      expect(isProviderReady(fakeProvider)).toBe(true);
    });

    it("returns false when status is needs-key and requiresApiKey is true", () => {
      const fakeProvider = {
        id: "test",
        name: "Test",
        description: "test",
        requiresApiKey: true,
        tokenConfigured: false,
        status: "needs-key" as const,
        capabilities: { upcomingMatches: true },
      };
      expect(isProviderReady(fakeProvider)).toBe(false);
    });
  });

  describe("listProvidersByCapability", () => {
    it("mock appears for lineup + prediction (full workflow)", () => {
      const result = listProvidersByCapability(["lineup", "prediction"]);
      const ids = result.map((p) => p.id);
      expect(ids).toContain("mock");
    });

    it("statsbomb placeholder is excluded from full workflow", () => {
      const result = listProvidersByCapability([
        "upcomingMatches",
        "match",
        "lineup",
        "prediction",
      ]);
      const ids = result.map((p) => p.id);
      expect(ids).not.toContain("statsbomb");
    });

    it("sportmonks placeholder is excluded", () => {
      const result = listProvidersByCapability(["upcomingMatches"]);
      const ids = result.map((p) => p.id);
      expect(ids).not.toContain("sportmonks");
    });

    it("filtering by lineup returns only mock (others lack lineup)", () => {
      const result = listProvidersByCapability(["lineup"]);
      const ids = result.map((p) => p.id);
      expect(ids).toContain("mock");
      expect(ids).not.toContain("openfootball");
      expect(ids).not.toContain("football-data-org");
      expect(ids).not.toContain("api-football");
    });

    it("filtering by prediction returns only mock", () => {
      const result = listProvidersByCapability(["prediction"]);
      const ids = result.map((p) => p.id);
      expect(ids).toEqual(["mock"]);
    });

    it("filtering by upcomingMatches returns mock + open-ready providers with that cap", () => {
      const result = listProvidersByCapability(["upcomingMatches"]);
      const ids = result.map((p) => p.id);
      expect(ids).toContain("mock");
      // football-data-org and api-football may appear only if their keys are set
      // openfootball appears (no key required, has upcomingMatches)
      expect(ids).toContain("openfootball");
    });

    it("empty required list returns all ready providers", () => {
      const result = listProvidersByCapability([]);
      expect(result.length).toBeGreaterThanOrEqual(1);
      // Should not contain placeholders
      const ids = result.map((p) => p.id);
      expect(ids).not.toContain("statsbomb");
      expect(ids).not.toContain("sportmonks");
    });
  });
});
