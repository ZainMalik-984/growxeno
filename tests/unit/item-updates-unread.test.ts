import { describe, expect, it } from "vitest";

import { countUnreadByItem, itemIdFromActionUrl } from "@/lib/notifications/item-updates-unread";

const ITEM = "3f1e0c1a-8d1e-4a59-9f61-6d1f6f0f9a11";
const OTHER = "9b2d4c3e-1a2b-4c5d-8e9f-0a1b2c3d4e5f";

describe("itemIdFromActionUrl", () => {
  it("reads the item from a team or worker link", () => {
    expect(itemIdFromActionUrl(`/orders/order-1?updates=${ITEM}`)).toBe(ITEM);
    expect(itemIdFromActionUrl(`/orders?updates=${ITEM}`)).toBe(ITEM);
  });

  it("ignores links without an item", () => {
    expect(itemIdFromActionUrl("/orders/order-1")).toBeNull();
    expect(itemIdFromActionUrl(`/orders?open=${ITEM}`)).toBeNull();
    expect(itemIdFromActionUrl(null)).toBeNull();
  });
});

describe("countUnreadByItem", () => {
  it("counts per item", () => {
    expect(countUnreadByItem([`/orders?updates=${ITEM}`, `/orders/x?updates=${ITEM}`, `/orders?updates=${OTHER}`, "/dashboard", null])).toEqual({
      [ITEM]: 2,
      [OTHER]: 1,
    });
  });
});
