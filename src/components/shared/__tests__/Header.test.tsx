import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Header } from "../Header";

describe("Header skeleton", () => {
  it("renders appName and userName", () => {
    render(<Header appName="Bloom" userName="東海林" />);
    expect(screen.getByText("Bloom")).toBeInTheDocument();
    expect(screen.getByText("東海林")).toBeInTheDocument();
  });
  it("renders rightActions when provided", () => {
    render(<Header appName="Bloom" userName="X" rightActions={<span>RIGHT</span>} />);
    expect(screen.getByText("RIGHT")).toBeInTheDocument();
  });
});
