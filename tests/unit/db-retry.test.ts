import { describe, expect, it, vi } from "vitest";

import { isConnectionError, withReadRetry } from "@/lib/db/retry";

const closed = Object.assign(new Error("Server has closed the connection."), { code: "P1017" });

describe("withReadRetry", () => {
  it("retries a read once after the connection was closed", async () => {
    const run = vi.fn().mockRejectedValueOnce(closed).mockResolvedValueOnce({ id: "u1" });
    await expect(withReadRetry("findFirst", run, 0)).resolves.toEqual({ id: "u1" });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("gives up after the second failure", async () => {
    const run = vi.fn().mockRejectedValue(closed);
    await expect(withReadRetry("findMany", run, 0)).rejects.toBe(closed);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("never repeats a write", async () => {
    const run = vi.fn().mockRejectedValue(closed);
    await expect(withReadRetry("create", run, 0)).rejects.toBe(closed);
    await expect(withReadRetry("update", run, 0)).rejects.toBe(closed);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("does not retry ordinary query errors", async () => {
    const unique = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    const run = vi.fn().mockRejectedValue(unique);
    await expect(withReadRetry("findFirst", run, 0)).rejects.toBe(unique);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("recognises only connection errors", () => {
    expect(isConnectionError(closed)).toBe(true);
    expect(isConnectionError({ code: "P1001" })).toBe(true);
    expect(isConnectionError({ code: "P2025" })).toBe(false);
    expect(isConnectionError(new Error("x"))).toBe(false);
    expect(isConnectionError(null)).toBe(false);
  });
});
