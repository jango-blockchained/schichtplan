import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { SchedulePage } from "../SchedulePage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

describe("SchedulePage", () => {
  it("renders the schedule page", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <SchedulePage />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Schichtplan")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Schichtplan generieren/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Als PDF exportieren/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Layout anpassen/i }),
    ).toBeInTheDocument();
  });
});
