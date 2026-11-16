import { describe, expect, it } from "vitest";

import { describeActivity } from "@/lib/orders/describe-activity";

describe("describeActivity", () => {
  it("reads an item status change", () => {
    expect(describeActivity("order_item.status_changed", 'Growth Bridge changed the item status of "Watch Hours" on order #2 from Done to Refill', "Growth Bridge")).toMatchObject({
      kind: "item-status",
      actor: "Growth Bridge",
      item: "Watch Hours",
      detail: { type: "change", from: "Done", to: "Refill" },
    });
  });

  it("marks an order status worked out from its items as automatic, with no actor", () => {
    expect(describeActivity("order.status_changed", "Order #5 is now Processing (updated automatically from its items)", "Inzmam")).toMatchObject({
      kind: "order-status",
      actor: null,
      automatic: true,
      detail: { type: "change", from: null, to: "Processing" },
    });
  });

  it("reads an assignment with its pay", () => {
    expect(describeActivity("order_item.assigned", 'Assigned "Subscribers" on order #5 to Inzmam at 400.00 PKR', "Growth Bridge")).toMatchObject({
      kind: "assigned",
      actor: "Growth Bridge",
      item: "Subscribers",
      detail: { type: "person", name: "Inzmam", extra: "400.00 PKR" },
    });
  });

  it("reads a handover and an update", () => {
    expect(
      describeActivity(
        "order_item.reassigned_remainder",
        'Grow Xeno moved the rest of "Youtube · Watch Hours" on order #3 from Inzmam (400 watch hours done) to Zia (600 watch hours left)',
        "Grow Xeno",
      ),
    ).toMatchObject({ kind: "reassigned", detail: { type: "handover", from: "Inzmam (400 watch hours done)", to: "Zia (600 watch hours left)" } });
    expect(
      describeActivity("order_item.update_posted", 'Inzmam posted an update on "Youtube · Watch Hours" on order #3: set progress to 1055 / 1655, a note', "Inzmam"),
    ).toMatchObject({ kind: "update", item: "Youtube · Watch Hours", detail: { type: "text", text: "set progress to 1055 / 1655, a note" } });
  });

  it("reads a YouTube count as automatic", () => {
    expect(describeActivity("order_item.stats_refreshed", 'YouTube latest count for "Youtube · Subscribers" on order #2: 277 subscribers', null)).toMatchObject({
      kind: "stats",
      automatic: true,
      detail: { type: "text", text: "277 subscribers" },
    });
  });

  it("falls back to the sentence, without the order number", () => {
    expect(describeActivity("order.something_new", "Something happened on order #9", "Ali")).toMatchObject({ kind: "other", verb: "Something happened" });
  });
});
