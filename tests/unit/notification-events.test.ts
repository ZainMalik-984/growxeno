import { describe, expect, it } from "vitest";

import {
  ALL_NOTIFICATION_CHANNELS,
  ALL_NOTIFICATION_EVENTS,
  getDefaultPreference,
  renderTemplate,
  validateTemplateVariables,
} from "@/lib/notifications/events";

describe("getDefaultPreference", () => {
  it("matches specification Section 74's worked example exactly", () => {
    expect(getDefaultPreference("ORDER_ASSIGNED", "EMAIL")).toBe(true);
    expect(getDefaultPreference("ORDER_ASSIGNED", "WHATSAPP")).toBe(true);
    expect(getDefaultPreference("ORDER_COMPLETED", "EMAIL")).toBe(true);
    expect(getDefaultPreference("ORDER_COMPLETED", "WHATSAPP")).toBe(false);
    expect(getDefaultPreference("DEADLINE_6H", "EMAIL")).toBe(false);
    expect(getDefaultPreference("DEADLINE_6H", "WHATSAPP")).toBe(true);
  });

  it("defaults in-app to on for every event", () => {
    for (const event of ALL_NOTIFICATION_EVENTS) {
      expect(getDefaultPreference(event, "IN_APP")).toBe(true);
    }
  });

  it("has a default for every event x channel combination", () => {
    for (const event of ALL_NOTIFICATION_EVENTS) {
      for (const channel of ALL_NOTIFICATION_CHANNELS) {
        expect(typeof getDefaultPreference(event, channel)).toBe("boolean");
      }
    }
  });
});

describe("validateTemplateVariables", () => {
  it("accepts a template using only known, declared variables", () => {
    const result = validateTemplateVariables("Hi {{worker_name}}, order {{order_number}} is due.", [
      "worker_name",
      "order_number",
    ]);
    expect(result.ok).toBe(true);
  });

  it("rejects an unknown placeholder", () => {
    const result = validateTemplateVariables("Hi {{nickname}}", []);
    expect(result).toEqual({ ok: false, error: expect.stringContaining("Unknown placeholder") });
  });

  it("rejects a declared variable that never appears in the text", () => {
    const result = validateTemplateVariables("Hi there.", ["worker_name"]);
    expect(result).toEqual({ ok: false, error: expect.stringContaining("never used") });
  });
});

describe("renderTemplate", () => {
  it("substitutes every placeholder with its value", () => {
    expect(renderTemplate("Hi {{worker_name}}, #{{order_number}}", { worker_name: "Ahmed", order_number: "42" })).toBe(
      "Hi Ahmed, #42",
    );
  });

  it("throws rather than sending a message with a literal placeholder", () => {
    expect(() => renderTemplate("Hi {{worker_name}}", {})).toThrow(/Missing value/);
  });
});
