import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * An outsourced worker's own team (2026-11-17): every change is scoped to the
 * signed-in worker. Another worker's members, and items not assigned to them,
 * read as not found.
 */

vi.mock("server-only", () => ({}));

type Row = Record<string, unknown>;
const db = {
  members: [] as Row[],
  items: [] as Row[],
  shares: [] as Row[],
};

const tx = {
  teamMember: {
    findFirst: vi.fn(async ({ where }: { where: { id: string; outsourcedWorkerId: string } }) =>
      db.members.find((m) => m.id === where.id && m.outsourcedWorkerId === where.outsourcedWorkerId) ?? null,
    ),
    create: vi.fn(async ({ data }: { data: Row }) => ({ id: "new-member", ...data })),
    update: vi.fn(async () => ({})),
  },
  orderItem: {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      const item = db.items.find((i) => i.id === where.id);
      return item ? { ...item, service: { metricType: "WATCH_HOURS" }, teamShares: db.shares.filter((s) => s.orderItemId === item.id) } : null;
    }),
  },
  teamShare: {
    findUnique: vi.fn(async () => null),
    findFirst: vi.fn(async ({ where }: { where: { id: string; teamMember: { outsourcedWorkerId: string } } }) => {
      const share = db.shares.find((s) => s.id === where.id);
      const member = share && db.members.find((m) => m.id === share.teamMemberId);
      return share && member && member.outsourcedWorkerId === where.teamMember.outsourcedWorkerId ? share : null;
    }),
    create: vi.fn(async ({ data }: { data: Row }) => ({ id: "new-share", ...data })),
    update: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
    deleteMany: vi.fn(async () => ({ count: 1 })),
  },
};

vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } }));

const { assignShare, clearTeamShares, removeShare, setShareStatus, updateTeamMember } = await import("@/lib/team/service");

const actor = (outsourcedWorkerId: string | null) => ({ user: { id: "user-1" }, outsourcedWorkerId }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  db.members = [
    { id: "ali", outsourcedWorkerId: "w1", isActive: true },
    { id: "other", outsourcedWorkerId: "w2", isActive: true },
  ];
  db.items = [
    { id: "mine", workerId: null, outsourcedWorkerId: "w1", startingCount: 200, targetCount: 4200 },
    { id: "theirs", workerId: null, outsourcedWorkerId: "w2", startingCount: 0, targetCount: 1000 },
  ];
  db.shares = [{ id: "s-ali", orderItemId: "mine", teamMemberId: "ali", amount: 2500, status: "PROCESSING" }];
});

describe("team service", () => {
  it("refuses anyone who isn't an outsourced worker", async () => {
    expect(await assignShare(actor(null), { itemId: "mine", memberId: "ali", amount: 100 })).toEqual({ ok: false, error: "Only outsourced workers have a team." });
  });

  it("hands part of their own task to their own member, as processing", async () => {
    db.shares = [];
    const result = await assignShare(actor("w1"), { itemId: "mine", memberId: "ali", amount: 2500, note: " fast " });
    expect(result).toEqual({ ok: true, data: expect.objectContaining({ id: "new-share" }) });
    expect(tx.teamShare.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PROCESSING", amount: 2500, note: "fast" }) }));
  });

  it("never touches another worker's member or task", async () => {
    expect((await assignShare(actor("w1"), { itemId: "mine", memberId: "other", amount: 100 })).ok).toBe(false);
    expect((await assignShare(actor("w1"), { itemId: "theirs", memberId: "ali", amount: 100 })).ok).toBe(false);
    expect((await updateTeamMember(actor("w2"), "ali", { name: "x" })).ok).toBe(false);
    expect((await removeShare(actor("w2"), "s-ali")).ok).toBe(false);
    expect(tx.teamShare.create).not.toHaveBeenCalled();
    expect(tx.teamShare.delete).not.toHaveBeenCalled();
  });

  it("won't hand out more than the task has left", async () => {
    const result = await assignShare(actor("w1"), { itemId: "mine", memberId: "ali", amount: 1600 });
    expect(result).toEqual({ ok: false, error: "Only 1,500 is left to assign." });
  });

  it("stops at shares on a task that was taken away from them", async () => {
    db.items[0]!.outsourcedWorkerId = "w2";
    expect((await setShareStatus(actor("w1"), "s-ali", "DONE")).ok).toBe(false);
  });

  it("marks a part done with its finish time and fills its progress", async () => {
    const now = new Date("2026-11-17T10:00:00Z");
    expect((await setShareStatus(actor("w1"), "s-ali", "DONE", now)).ok).toBe(true);
    expect(tx.teamShare.update).toHaveBeenCalledWith({ where: { id: "s-ali" }, data: { status: "DONE", finishedAt: now, done: 2500 } });
  });

  it("clears a worker's split when the task leaves them", async () => {
    await clearTeamShares(tx as never, "mine");
    expect(tx.teamShare.deleteMany).toHaveBeenCalledWith({ where: { orderItemId: "mine" } });
  });
});
