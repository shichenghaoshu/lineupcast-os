import { describe, it, expect } from "vitest";
import { applyTransform, applyFieldMappings } from "../field-map-utils.js";
import type { FieldMapping } from "../index.js";

describe("applyTransform", () => {
  it("toUpperCase", () => {
    expect(applyTransform("hello", "toUpperCase")).toBe("HELLO");
  });

  it("toLowerCase", () => {
    expect(applyTransform("HELLO", "toLowerCase")).toBe("hello");
  });

  it("toNumber", () => {
    expect(applyTransform("42", "toNumber")).toBe(42);
    expect(applyTransform("3.14", "toNumber")).toBeCloseTo(3.14);
  });

  it("toBoolean", () => {
    expect(applyTransform("yes", "toBoolean")).toBe(true);
    expect(applyTransform("", "toBoolean")).toBe(false);
    expect(applyTransform(0, "toBoolean")).toBe(false);
  });

  it("toDate", () => {
    const result = applyTransform("2026-05-10", "toDate");
    expect(typeof result).toBe("string");
    expect(result).toContain("2026");
  });

  it("splitComma", () => {
    expect(applyTransform("a,b,c", "splitComma")).toEqual(["a", "b", "c"]);
    expect(applyTransform("a, b , c", "splitComma")).toEqual(["a", "b", "c"]);
  });

  it("trim", () => {
    expect(applyTransform("  hello  ", "trim")).toBe("hello");
  });

  it("iso8601", () => {
    const result = applyTransform("2026-05-10T15:00:00Z", "iso8601");
    expect(result).toBe("2026-05-10T15:00:00.000Z");
  });

  it("returns null/undefined as-is", () => {
    expect(applyTransform(null, "toUpperCase")).toBeNull();
    expect(applyTransform(undefined, "toUpperCase")).toBeUndefined();
  });
});

describe("applyFieldMappings", () => {
  it("maps flat fields", () => {
    const source = { full_name: "John Doe", age: "25" };
    const mappings: FieldMapping[] = [
      { sourceField: "full_name", targetField: "name" },
      { sourceField: "age", targetField: "age", transform: "toNumber" },
    ];
    const result = applyFieldMappings(source, mappings);
    expect(result).toEqual({ name: "John Doe", age: 25 });
  });

  it("maps nested fields via dot path", () => {
    const source = { person: { name: "Jane" } };
    const mappings: FieldMapping[] = [
      { sourceField: "person.name", targetField: "name" },
    ];
    const result = applyFieldMappings(source, mappings);
    expect(result).toEqual({ name: "Jane" });
  });

  it("uses fallback when source field is missing", () => {
    const source = {};
    const mappings: FieldMapping[] = [
      { sourceField: "missing", targetField: "status", fallback: "unknown" },
    ];
    const result = applyFieldMappings(source, mappings);
    expect(result).toEqual({ status: "unknown" });
  });

  it("skips undefined values without fallback", () => {
    const source = { a: "1" };
    const mappings: FieldMapping[] = [
      { sourceField: "a", targetField: "a" },
      { sourceField: "b", targetField: "b" },
    ];
    const result = applyFieldMappings(source, mappings);
    expect(result).toEqual({ a: "1" });
    expect("b" in result).toBe(false);
  });

  it("sets nested target fields", () => {
    const source = { name: "John" };
    const mappings: FieldMapping[] = [
      { sourceField: "name", targetField: "person.name" },
    ];
    const result = applyFieldMappings(source, mappings);
    expect(result).toEqual({ person: { name: "John" } });
  });

  it("applies transform and fallback together", () => {
    const source = {};
    const mappings: FieldMapping[] = [
      { sourceField: "rating", targetField: "rating", transform: "toNumber", fallback: "0" },
    ];
    const result = applyFieldMappings(source, mappings);
    expect(result).toEqual({ rating: 0 });
  });
});
