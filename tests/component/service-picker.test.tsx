import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ServicePicker, type ServiceOption } from "@/components/catalog/service-picker";

// next/image needs the Next runtime; a plain img is enough here.
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const SERVICES: ServiceOption[] = [
  { id: "tt-views", name: "Views", categoryName: "TikTok", categoryImageUrl: "https://example.supabase.co/tiktok.webp" },
  { id: "yt-subs", name: "Subscribers", categoryName: "Youtube", categoryImageUrl: null },
  { id: "yt-views", name: "Views", categoryName: "Youtube", categoryImageUrl: null },
];

function setup(value = "") {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(<ServicePicker id="svc" services={SERVICES} value={value} onChange={onChange} emptyLabel="No item — add later" />);
  return { onChange, user };
}

describe("ServicePicker", () => {
  it("shows the empty choice, then the selected service with its category", () => {
    const { unmount } = render(<ServicePicker id="a" services={SERVICES} value="" onChange={vi.fn()} emptyLabel="No item — add later" />);
    expect(screen.getByRole("button")).toHaveTextContent("No item — add later");
    unmount();
    render(<ServicePicker id="b" services={SERVICES} value="tt-views" onChange={vi.fn()} emptyLabel="No item — add later" />);
    expect(screen.getByRole("button")).toHaveTextContent("TikTok · Views");
  });

  it("lists services grouped by category, with the category logo", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button"));
    const list = screen.getByRole("listbox");
    expect(within(list).getByRole("group", { name: "TikTok" })).toBeInTheDocument();
    expect(within(list).getByRole("group", { name: "Youtube" })).toBeInTheDocument();
    // TikTok has an image; Youtube falls back to its initial.
    expect(list.querySelector('img[src="https://example.supabase.co/tiktok.webp"]')).not.toBeNull();
    expect(within(list).getAllByRole("option")).toHaveLength(4); // empty choice + 3 services
  });

  it("filters by search and picks with the keyboard", async () => {
    const { user, onChange } = setup();
    await user.click(screen.getByRole("button"));
    await user.type(screen.getByRole("combobox", { name: "Search services" }), "youtube");
    expect(screen.getAllByRole("option")).toHaveLength(2);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("yt-views");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("picks with the mouse and closes on Escape", async () => {
    const { user, onChange } = setup();
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("option", { name: /Subscribers/ }));
    expect(onChange).toHaveBeenCalledWith("yt-subs");
    await user.click(screen.getByRole("button"));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("button")).toHaveFocus();
  });
});
