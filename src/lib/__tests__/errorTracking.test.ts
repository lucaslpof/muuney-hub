import { describe, it, expect, vi, beforeEach } from "vitest";
import { logError, logWarning, getStoredErrors, clearStoredErrors } from "../errorTracking";

describe("errorTracking", () => {
  beforeEach(() => {
    clearStoredErrors();
    vi.restoreAllMocks();
  });

  it("logError stores error in localStorage", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("Test error");

    logError(error, { source: "test" });

    const stored = getStoredErrors();
    expect(stored).toHaveLength(1);
    expect((stored[0] as { message: string }).message).toBe("Test error");
    expect((stored[0] as { source: string }).source).toBe("test");

    spy.mockRestore();
  });

  it("logWarning outputs to console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    logWarning("Test warning", { key: "value" });

    expect(spy).toHaveBeenCalledWith(
      "[muuney.hub] Warning:",
      "Test warning",
      { key: "value" }
    );

    spy.mockRestore();
  });

  it("clearStoredErrors removes all entries", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError(new Error("err1"));
    logError(new Error("err2"));

    expect(getStoredErrors()).toHaveLength(2);

    clearStoredErrors();
    expect(getStoredErrors()).toHaveLength(0);

    spy.mockRestore();
  });

  it("caps stored errors at MAX_STORED_ERRORS", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    for (let i = 0; i < 60; i++) {
      logError(new Error(`err-${i}`));
    }

    const stored = getStoredErrors();
    expect(stored.length).toBeLessThanOrEqual(50);

    spy.mockRestore();
  });
});
