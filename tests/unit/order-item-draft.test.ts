import { describe, expect, it, vi } from "vitest";

// The editor's live preview calls a server action; only the pure helpers are tested here.
vi.mock("@/components/catalog/youtube-link-preview", () => ({ YoutubeLinkPreview: () => null }));
vi.mock("@/components/catalog/service-picker", () => ({ ServicePicker: () => null }));

import { type AssignableWorker, type DraftItem, draftCost, validateItem } from "@/app/(app)/orders/new/order-item-editor";
import { EMPTY_WORKLOAD } from "@/lib/outsourced-workers/workload";
import type { ServicePickerRow } from "@/lib/services/queries";
import { youtubeLinkProblem } from "@/lib/youtube/link";

const services: ServicePickerRow[] = [
  { id: "views", name: "Views", categoryName: "Youtube", categoryImageUrl: null, basePrice: null, currency: "USD", metricType: "VIEWS" },
  { id: "subs", name: "Subscribers", categoryName: "Youtube", categoryImageUrl: null, basePrice: null, currency: "USD", metricType: "SUBSCRIBERS" },
  { id: "ig", name: "Followers", categoryName: "Instagram", categoryImageUrl: null, basePrice: null, currency: "USD", metricType: "FOLLOWERS" },
  { id: "logo", name: "Logo design", categoryName: "Design", categoryImageUrl: null, basePrice: null, currency: "USD", metricType: null },
];

const draft = (over: Partial<DraftItem>): DraftItem => ({
  key: "i0",
  serviceId: "views",
  channelLink: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  startingCount: "1000",
  requiredCount: "500",
  workerId: "",
  workerCost: null,
  workerCostCurrency: null,
  ...over,
});

describe("youtubeLinkProblem (2026-11-12: a wrong link blocks the item)", () => {
  it("accepts the right kind of link", () => {
    expect(youtubeLinkProblem("VIEWS", "https://youtu.be/dQw4w9WgXcQ")).toBeNull();
    expect(youtubeLinkProblem("SUBSCRIBERS", "https://youtube.com/@somechannel")).toBeNull();
  });
  it("rejects a channel link for a video service and the other way round", () => {
    expect(youtubeLinkProblem("VIEWS", "https://youtube.com/@somechannel")).toMatch(/needs a video link/);
    expect(youtubeLinkProblem("SUBSCRIBERS", "https://youtu.be/dQw4w9WgXcQ")).toMatch(/needs a channel link/);
  });
  it("rejects links that aren't YouTube or have no id", () => {
    expect(youtubeLinkProblem("VIEWS", "https://vimeo.com/123")).toMatch(/isn't a YouTube link/);
    expect(youtubeLinkProblem("VIEWS", "https://youtube.com/watch?v=short")).toMatch(/no video id/);
  });
});

describe("validateItem", () => {
  it("blocks a YouTube item with the wrong kind of link", () => {
    expect(validateItem(draft({ channelLink: "https://youtube.com/@somechannel" }), services, false).channelLink).toMatch(/video link/);
  });
  it("lets a correct YouTube item through", () => {
    expect(validateItem(draft({}), services, false)).toEqual({});
  });
  it("doesn't apply YouTube rules to other platforms", () => {
    expect(validateItem(draft({ serviceId: "ig", channelLink: "https://instagram.com/someone" }), services, false)).toEqual({});
  });
  it("checks a typed worker cost", () => {
    const item = draft({ workerId: "w1", workerCost: "12,5" });
    expect(validateItem(item, services, false).workerCost).toBeTruthy();
    expect(validateItem({ ...item, workerCost: "12.50" }, services, false).workerCost).toBeUndefined();
  });
});

describe("draftCost", () => {
  const workers: AssignableWorker[] = [
    { id: "w1", name: "Zia", rates: [{ serviceId: "views", rate: "3.5", currency: "PKR" }], workload: EMPTY_WORKLOAD },
    { id: "w2", name: "Inzmam", rates: [], workload: EMPTY_WORKLOAD },
  ];

  it("is the rate times the units asked for", () => {
    expect(draftCost(draft({ workerId: "w1" }), services, workers)).toEqual({ cost: "1750.00", currency: "PKR", hasRate: true });
  });
  it("keeps what was typed", () => {
    expect(draftCost(draft({ workerId: "w1", workerCost: "1500", workerCostCurrency: "USD" }), services, workers)).toMatchObject({
      cost: "1500",
      currency: "USD",
    });
  });
  it("is empty when the worker has no rate, and null when nobody is picked", () => {
    expect(draftCost(draft({ workerId: "w2" }), services, workers)).toEqual({ cost: "", currency: "PKR", hasRate: false });
    expect(draftCost(draft({}), services, workers)).toBeNull();
  });
  it("charges a flat rate for a service without a count", () => {
    const flat: AssignableWorker[] = [{ id: "w1", name: "Zia", rates: [{ serviceId: "logo", rate: "2000", currency: "PKR" }], workload: EMPTY_WORKLOAD }];
    expect(draftCost(draft({ serviceId: "logo", workerId: "w1" }), services, flat)?.cost).toBe("2000.00");
  });
});
