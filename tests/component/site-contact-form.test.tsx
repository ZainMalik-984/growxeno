import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SiteContactForm } from "@/app/(app)/settings/system/site-contact-form";
import { DEFAULT_SITE_CONTACT } from "@/lib/settings/site-contact";

const save = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/settings/actions", () => ({ saveSiteContactAction: save }));

describe("SiteContactForm", () => {
  beforeEach(() => save.mockReset().mockResolvedValue({ ok: true, message: "Contact details saved." }));

  it("shows the WhatsApp message preview and the link a handle will save as", async () => {
    const user = userEvent.setup();
    render(<SiteContactForm initial={DEFAULT_SITE_CONTACT} canEdit />);
    // The default opening message is in the field and the chat preview.
    expect(screen.getByLabelText("Opening message")).toHaveValue(DEFAULT_SITE_CONTACT.whatsappMessage);
    expect(screen.getAllByText(DEFAULT_SITE_CONTACT.whatsappMessage!).length).toBeGreaterThan(1);

    await user.type(screen.getByLabelText("Instagram"), "@growxeno");
    expect(screen.getByRole("link", { name: "www.instagram.com/growxeno" })).toHaveAttribute("href", "https://www.instagram.com/growxeno");
  });

  it("saves through the save bar, which appears only after a change", async () => {
    const user = userEvent.setup();
    render(<SiteContactForm initial={DEFAULT_SITE_CONTACT} canEdit />);
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();

    await user.type(screen.getByLabelText("WhatsApp number"), "+92 300 1234567");
    await user.type(screen.getByLabelText("X (Twitter)"), "growxeno");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ whatsapp: "+92 300 1234567", twitter: "https://x.com/growxeno", email: "hello@growxeno.com" }),
    );
  });

  it("stops a link to the wrong site", async () => {
    const user = userEvent.setup();
    render(<SiteContactForm initial={DEFAULT_SITE_CONTACT} canEdit />);
    await user.type(screen.getByLabelText("Facebook"), "https://evil.example/page");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a Facebook link");
    expect(save).not.toHaveBeenCalled();
  });
});
