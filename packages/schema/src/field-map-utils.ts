// @lineupcast/schema — field mapping transform utilities

import type { FieldMapping, FieldTransform } from "./index.js";

/** Apply a single FieldTransform to a value */
export function applyTransform(value: unknown, transform: FieldTransform): unknown {
  if (value == null) return value;
  switch (transform) {
    case "toUpperCase":
      return String(value).toUpperCase();
    case "toLowerCase":
      return String(value).toLowerCase();
    case "toNumber":
      return Number(value);
    case "toBoolean":
      return Boolean(value);
    case "toDate":
      return new Date(String(value)).toISOString();
    case "splitComma":
      return String(value)
        .split(",")
        .map((s) => s.trim());
    case "trim":
      return String(value).trim();
    case "iso8601": {
      const d = new Date(String(value));
      return isNaN(d.getTime()) ? String(value) : d.toISOString();
    }
    default:
      return value;
  }
}

/**
 * Map a raw source object to a partial target object using field mappings.
 * Returns a plain object with targetField keys populated from source.
 */
export function applyFieldMappings(
  source: Record<string, unknown>,
  mappings: FieldMapping[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const mapping of mappings) {
    let value = getNestedValue(source, mapping.sourceField);
    if (value === undefined) {
      value = mapping.fallback;
    }
    if (value !== undefined && mapping.transform) {
      value = applyTransform(value, mapping.transform);
    }
    if (value !== undefined) {
      setNestedValue(result, mapping.targetField, value);
    }
  }
  return result;
}

/** Dot-path getter: getNestedValue({a:{b:1}}, "a.b") → 1 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Dot-path setter: setNestedValue({}, "a.b", 1) → {a:{b:1}} */
function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    if (!(key in current) || typeof current[key] !== "object" || current[key] == null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]!] = value;
}
