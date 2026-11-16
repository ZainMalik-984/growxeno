import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GrowXenoLoader } from "@/components/brand/grow-xeno-loader";

describe("GrowXenoLoader", () => {
  it("is a labelled status by default", () => {
    render(<GrowXenoLoader />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("uses the given label", () => {
    render(<GrowXenoLoader label="Loading updates" />);
    expect(screen.getByRole("status", { name: "Loading updates" })).toBeInTheDocument();
  });

  it("is decorative with an empty label, so text beside it does the talking", () => {
    const { container } = render(<GrowXenoLoader label="" />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(container.querySelector(".gx-loader")).toHaveAttribute("aria-hidden", "true");
  });

  it.each([
    ["xs", 20, "compact"],
    ["sm", 28, "compact"],
    ["md", 48, "full"],
    ["lg", 72, "full"],
    ["xl", 100, "full"],
  ] as const)("%s is a %ipx square in %s mode", (size, px, mode) => {
    const { container } = render(<GrowXenoLoader size={size} />);
    const box = container.querySelector<HTMLElement>(".gx-loader")!;
    expect(box.style.width).toBe(`${px}px`);
    expect(box.style.height).toBe(`${px}px`);
    expect(box.dataset.mode).toBe(mode);
  });

  it("draws the exact logo: the arrow, the return stroke and four letterforms", () => {
    const { container } = render(<GrowXenoLoader />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("90 255 1050 780");
    // Filled letterforms + leaf, and their drawn outlines.
    expect(container.querySelectorAll(".gxl-fill path")).toHaveLength(5);
    expect(container.querySelectorAll(".gxl-line")).toHaveLength(5);
    expect(container.querySelector(".gxl-dot")).not.toBeNull();
  });

  it("scales its loop with speed", () => {
    const { container } = render(<GrowXenoLoader speed={2} />);
    expect(container.querySelector<HTMLElement>(".gx-loader")!.style.getPropertyValue("--gxl-duration")).toBe("1.5s");
  });

  it("gives every instance its own gradient ids", () => {
    const { container } = render(
      <>
        <GrowXenoLoader />
        <GrowXenoLoader variant="light" />
      </>,
    );
    const ids = Array.from(container.querySelectorAll("linearGradient")).map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
