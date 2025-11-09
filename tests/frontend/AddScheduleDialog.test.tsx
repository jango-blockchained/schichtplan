/**
 * Tests for keyholder shift preview in AddScheduleDialog
 *
 * Tests cover:
 * - Paired shift preview display
 * - Color-coded warning indicators
 * - API integration for paired shift fetching
 * - Edge cases and error handling
 */

import AddScheduleDialog from "@/components/Schedule/AddScheduleDialog";
import * as api from "@/services/api/schedule";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock API
vi.mock("@/services/api/schedule");

const mockGetPairedKeyholderShift = vi.mocked(api.getPairedKeyholderShift);

describe("AddScheduleDialog - Keyholder Preview", () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        });
        vi.clearAllMocks();
    });

    const renderDialog = (props = {}) => {
        const defaultProps = {
            open: true,
            onOpenChange: vi.fn(),
            onScheduleAdded: vi.fn(),
            initialDate: "2025-11-10",
            version: 1,
            ...props,
        };

        return render(
            <QueryClientProvider client={queryClient}>
                <AddScheduleDialog {...defaultProps} />
            </QueryClientProvider>
        );
    };

    it("shows paired shift preview when keyholder checkbox checked", async () => {
        // Mock paired shift exists
        mockGetPairedKeyholderShift.mockResolvedValue({
            schedule_id: 123,
            date: "2025-11-11",
            shift_type: "opening",
            employee: {
                id: 1,
                first_name: "John",
                last_name: "Doe",
            },
        });

        renderDialog();

        // Check keyholder checkbox
        const keyholderCheckbox = screen.getByLabelText(/keyholder/i);
        await userEvent.click(keyholderCheckbox);

        // Should show paired shift info
        await waitFor(() => {
            expect(screen.getByText(/paired shift exists/i)).toBeInTheDocument();
            expect(screen.getByText(/John Doe/i)).toBeInTheDocument();
        });
    });

    it("shows green checkmark when paired shift exists", async () => {
        mockGetPairedKeyholderShift.mockResolvedValue({
            schedule_id: 123,
            date: "2025-11-11",
            shift_type: "opening",
            employee: {
                id: 1,
                first_name: "John",
                last_name: "Doe",
            },
        });

        renderDialog();

        const keyholderCheckbox = screen.getByLabelText(/keyholder/i);
        await userEvent.click(keyholderCheckbox);

        // Should show green indicator
        await waitFor(() => {
            const checkIcon = screen.getByTestId("paired-shift-success");
            expect(checkIcon).toBeInTheDocument();
        });
    });

    it("shows amber warning when paired shift missing", async () => {
        mockGetPairedKeyholderShift.mockResolvedValue({
            date: "2025-11-11",
            shift_type: "opening",
            missing: true,
        });

        renderDialog();

        const keyholderCheckbox = screen.getByLabelText(/keyholder/i);
        await userEvent.click(keyholderCheckbox);

        // Should show amber warning
        await waitFor(() => {
            const warningIcon = screen.getByTestId("paired-shift-warning");
            expect(warningIcon).toBeInTheDocument();
            expect(screen.getByText(/no paired shift found/i)).toBeInTheDocument();
        });
    });

    it("updates preview when shift time changes", async () => {
        let resolveCount = 0;
        mockGetPairedKeyholderShift.mockImplementation(async () => {
            resolveCount++;
            if (resolveCount === 1) {
                // First call - closing shift (needs opening next day)
                return {
                    date: "2025-11-11",
                    shift_type: "opening",
                    missing: true,
                };
            }
            // Second call - opening shift (needs closing previous day)
            return {
                date: "2025-11-09",
                shift_type: "closing",
                missing: true,
            };
        });

        renderDialog();

        const keyholderCheckbox = screen.getByLabelText(/keyholder/i);
        await userEvent.click(keyholderCheckbox);

        // Initial preview (closing shift)
        await waitFor(() => {
            expect(screen.getByText(/2025-11-11/)).toBeInTheDocument();
        });

        // Change to opening shift time
        const startTimeInput = screen.getByLabelText(/start time/i);
        await userEvent.clear(startTimeInput);
        await userEvent.type(startTimeInput, "09:00");

        // Preview should update (looking for previous day closing)
        await waitFor(() => {
            expect(screen.getByText(/2025-11-09/)).toBeInTheDocument();
        });
    });

    it("hides preview when keyholder checkbox unchecked", async () => {
        mockGetPairedKeyholderShift.mockResolvedValue({
            schedule_id: 123,
            date: "2025-11-11",
            shift_type: "opening",
            employee: {
                id: 1,
                first_name: "John",
                last_name: "Doe",
            },
        });

        renderDialog();

        const keyholderCheckbox = screen.getByLabelText(/keyholder/i);

        // Check then uncheck
        await userEvent.click(keyholderCheckbox);
        await waitFor(() => {
            expect(screen.getByText(/paired shift/i)).toBeInTheDocument();
        });

        await userEvent.click(keyholderCheckbox);

        // Preview should be hidden
        await waitFor(() => {
            expect(screen.queryByText(/paired shift/i)).not.toBeInTheDocument();
        });
    });

    it("handles API errors gracefully", async () => {
        mockGetPairedKeyholderShift.mockRejectedValue(
            new Error("Network error")
        );

        renderDialog();

        const keyholderCheckbox = screen.getByLabelText(/keyholder/i);
        await userEvent.click(keyholderCheckbox);

        // Should not crash, may show error message or hide preview
        await waitFor(() => {
            expect(screen.queryByText(/network error/i)).toBeInTheDocument();
        }, { timeout: 3000 });
    });

    it("does not fetch paired shift for non-keyholder shifts", async () => {
        renderDialog();

        // Do not check keyholder checkbox
        const startTimeInput = screen.getByLabelText(/start time/i);
        await userEvent.type(startTimeInput, "11:00");

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 500));

        // API should not be called
        expect(mockGetPairedKeyholderShift).not.toHaveBeenCalled();
    });

    it("passes correct parameters to API", async () => {
        mockGetPairedKeyholderShift.mockResolvedValue({
            date: "2025-11-11",
            shift_type: "opening",
            missing: true,
        });

        renderDialog({
            initialDate: "2025-11-10",
            version: 2,
        });

        const keyholderCheckbox = screen.getByLabelText(/keyholder/i);
        await userEvent.click(keyholderCheckbox);

        const startTimeInput = screen.getByLabelText(/start time/i);
        const endTimeInput = screen.getByLabelText(/end time/i);

        await userEvent.type(startTimeInput, "13:00");
        await userEvent.type(endTimeInput, "20:00");

        await waitFor(() => {
            expect(mockGetPairedKeyholderShift).toHaveBeenCalledWith({
                date: "2025-11-10",
                version: 2,
                shift_start: "13:00",
                shift_end: "20:00",
            });
        });
    });

    it("shows loading state while fetching paired shift", async () => {
        let resolvePromise: (value: any) => void;
        const promise = new Promise((resolve) => {
            resolvePromise = resolve;
        });

        mockGetPairedKeyholderShift.mockReturnValue(promise as any);

        renderDialog();

        const keyholderCheckbox = screen.getByLabelText(/keyholder/i);
        await userEvent.click(keyholderCheckbox);

        // Should show loading indicator
        await waitFor(() => {
            expect(screen.getByTestId("paired-shift-loading")).toBeInTheDocument();
        });

        // Resolve promise
        resolvePromise!({
            schedule_id: 123,
            date: "2025-11-11",
            shift_type: "opening",
            employee: {
                id: 1,
                first_name: "John",
                last_name: "Doe",
            },
        });

        // Loading should disappear
        await waitFor(() => {
            expect(
                screen.queryByTestId("paired-shift-loading")
            ).not.toBeInTheDocument();
        });
    });

    it("shows correct message for opening shift needing closing", async () => {
        mockGetPairedKeyholderShift.mockResolvedValue({
            date: "2025-11-09",
            shift_type: "closing",
            missing: true,
        });

        renderDialog();

        const keyholderCheckbox = screen.getByLabelText(/keyholder/i);
        await userEvent.click(keyholderCheckbox);

        const startTimeInput = screen.getByLabelText(/start time/i);
        await userEvent.type(startTimeInput, "09:00"); // Opening shift

        await waitFor(() => {
            expect(
                screen.getByText(/requires closing shift on 2025-11-09/i)
            ).toBeInTheDocument();
        });
    });

    it("shows correct message for closing shift needing opening", async () => {
        mockGetPairedKeyholderShift.mockResolvedValue({
            date: "2025-11-11",
            shift_type: "opening",
            missing: true,
        });

        renderDialog();

        const keyholderCheckbox = screen.getByLabelText(/keyholder/i);
        await userEvent.click(keyholderCheckbox);

        const startTimeInput = screen.getByLabelText(/start time/i);
        await userEvent.type(startTimeInput, "13:00"); // Closing shift

        await waitFor(() => {
            expect(
                screen.getByText(/requires opening shift on 2025-11-11/i)
            ).toBeInTheDocument();
        });
    });

    it("updates when date changes", async () => {
        mockGetPairedKeyholderShift.mockResolvedValue({
            date: "2025-11-11",
            shift_type: "opening",
            missing: true,
        });

        renderDialog({ initialDate: "2025-11-10" });

        const keyholderCheckbox = screen.getByLabelText(/keyholder/i);
        await userEvent.click(keyholderCheckbox);

        await waitFor(() => {
            expect(mockGetPairedKeyholderShift).toHaveBeenCalledWith(
                expect.objectContaining({ date: "2025-11-10" })
            );
        });

        // Change date
        const dateInput = screen.getByLabelText(/date/i);
        await userEvent.clear(dateInput);
        await userEvent.type(dateInput, "2025-11-15");

        // Should fetch with new date
        await waitFor(() => {
            expect(mockGetPairedKeyholderShift).toHaveBeenCalledWith(
                expect.objectContaining({ date: "2025-11-15" })
            );
        });
    });

    it("shows paired shift across weekend boundary", async () => {
        mockGetPairedKeyholderShift.mockResolvedValue({
            schedule_id: 123,
            date: "2025-11-17", // Monday (skipping Sunday)
            shift_type: "opening",
            employee: {
                id: 1,
                first_name: "Jane",
                last_name: "Smith",
            },
        });

        renderDialog({ initialDate: "2025-11-15" }); // Saturday

        const keyholderCheckbox = screen.getByLabelText(/keyholder/i);
        await userEvent.click(keyholderCheckbox);

        // Should show Monday's shift (skipping Sunday)
        await waitFor(() => {
            expect(screen.getByText(/2025-11-17/)).toBeInTheDocument();
            expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
        });
    });
});
