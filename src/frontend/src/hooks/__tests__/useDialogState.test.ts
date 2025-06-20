import { describe, expect, it } from "bun:test";
import { renderHook, act } from "@testing-library/react";
import { useDialogState } from "../useDialogState";

describe("useDialogState", () => {
  it("initializes with all dialogs closed", () => {
    const { result } = renderHook(() => useDialogState());
    
    expect(result.current.dialogs.confirmationDialog.isOpen).toBe(false);
    expect(result.current.dialogs.aiDataPreviewDialog.isOpen).toBe(false);
    expect(result.current.dialogs.addScheduleDialog.isOpen).toBe(false);
    expect(result.current.dialogs.generationSettingsDialog.isOpen).toBe(false);
    expect(result.current.dialogs.statisticsDialog.isOpen).toBe(false);
  });

  it("opens confirmation dialog with correct data", () => {
    const { result } = renderHook(() => useDialogState());
    
    const confirmationData = {
      title: "Test Confirmation",
      message: "Are you sure?",
      onConfirm: () => {},
      variant: "destructive" as const,
    };
    
    act(() => {
      result.current.openConfirmationDialog(confirmationData);
    });
    
    expect(result.current.dialogs.confirmationDialog.isOpen).toBe(true);
    expect(result.current.dialogs.confirmationDialog.data).toEqual(confirmationData);
  });

  it("closes confirmation dialog and clears data", () => {
    const { result } = renderHook(() => useDialogState());
    
    // First open the dialog
    act(() => {
      result.current.openConfirmationDialog({
        title: "Test",
        message: "Test message",
        onConfirm: () => {},
      });
    });
    
    expect(result.current.dialogs.confirmationDialog.isOpen).toBe(true);
    
    // Then close it
    act(() => {
      result.current.closeConfirmationDialog();
    });
    
    expect(result.current.dialogs.confirmationDialog.isOpen).toBe(false);
    expect(result.current.dialogs.confirmationDialog.data).toBeNull();
  });

  it("opens AI data preview dialog with data", () => {
    const { result } = renderHook(() => useDialogState());
    
    const aiData = {
      employees: [{ id: 1, name: "John Doe" }],
      shifts: [{ id: 1, name: "Morning Shift" }],
    };
    
    act(() => {
      result.current.openAiDataPreviewDialog(aiData);
    });
    
    expect(result.current.dialogs.aiDataPreviewDialog.isOpen).toBe(true);
    expect(result.current.dialogs.aiDataPreviewDialog.data).toEqual(aiData);
  });

  it("closes AI data preview dialog", () => {
    const { result } = renderHook(() => useDialogState());
    
    // First open with data
    act(() => {
      result.current.openAiDataPreviewDialog({ test: "data" });
    });
    
    expect(result.current.dialogs.aiDataPreviewDialog.isOpen).toBe(true);
    
    // Then close
    act(() => {
      result.current.closeAiDataPreviewDialog();
    });
    
    expect(result.current.dialogs.aiDataPreviewDialog.isOpen).toBe(false);
    expect(result.current.dialogs.aiDataPreviewDialog.data).toBeNull();
  });

  it("opens add schedule dialog", () => {
    const { result } = renderHook(() => useDialogState());
    
    act(() => {
      result.current.openAddScheduleDialog();
    });
    
    expect(result.current.dialogs.addScheduleDialog.isOpen).toBe(true);
  });

  it("closes add schedule dialog", () => {
    const { result } = renderHook(() => useDialogState());
    
    // First open
    act(() => {
      result.current.openAddScheduleDialog();
    });
    
    expect(result.current.dialogs.addScheduleDialog.isOpen).toBe(true);
    
    // Then close
    act(() => {
      result.current.closeAddScheduleDialog();
    });
    
    expect(result.current.dialogs.addScheduleDialog.isOpen).toBe(false);
  });

  it("opens generation settings dialog", () => {
    const { result } = renderHook(() => useDialogState());
    
    act(() => {
      result.current.openGenerationSettingsDialog();
    });
    
    expect(result.current.dialogs.generationSettingsDialog.isOpen).toBe(true);
  });

  it("closes generation settings dialog", () => {
    const { result } = renderHook(() => useDialogState());
    
    // First open
    act(() => {
      result.current.openGenerationSettingsDialog();
    });
    
    // Then close
    act(() => {
      result.current.closeGenerationSettingsDialog();
    });
    
    expect(result.current.dialogs.generationSettingsDialog.isOpen).toBe(false);
  });

  it("opens statistics dialog", () => {
    const { result } = renderHook(() => useDialogState());
    
    act(() => {
      result.current.openStatisticsDialog();
    });
    
    expect(result.current.dialogs.statisticsDialog.isOpen).toBe(true);
  });

  it("closes statistics dialog", () => {
    const { result } = renderHook(() => useDialogState());
    
    // First open
    act(() => {
      result.current.openStatisticsDialog();
    });
    
    // Then close
    act(() => {
      result.current.closeStatisticsDialog();
    });
    
    expect(result.current.dialogs.statisticsDialog.isOpen).toBe(false);
  });

  it("can handle multiple dialogs independently", () => {
    const { result } = renderHook(() => useDialogState());
    
    // Open multiple dialogs
    act(() => {
      result.current.openAddScheduleDialog();
      result.current.openStatisticsDialog();
      result.current.openConfirmationDialog({
        title: "Test",
        message: "Test message",
        onConfirm: () => {},
      });
    });
    
    // All should be open
    expect(result.current.dialogs.addScheduleDialog.isOpen).toBe(true);
    expect(result.current.dialogs.statisticsDialog.isOpen).toBe(true);
    expect(result.current.dialogs.confirmationDialog.isOpen).toBe(true);
    
    // Close one
    act(() => {
      result.current.closeAddScheduleDialog();
    });
    
    // Others should remain open
    expect(result.current.dialogs.addScheduleDialog.isOpen).toBe(false);
    expect(result.current.dialogs.statisticsDialog.isOpen).toBe(true);
    expect(result.current.dialogs.confirmationDialog.isOpen).toBe(true);
  });

  it("handles confirmation dialog with loading state", () => {
    const { result } = renderHook(() => useDialogState());
    
    act(() => {
      result.current.openConfirmationDialog({
        title: "Delete Item",
        message: "This will permanently delete the item",
        onConfirm: () => {},
        isLoading: true,
      });
    });
    
    expect(result.current.dialogs.confirmationDialog.data?.isLoading).toBe(true);
  });

  it("handles confirmation dialog with details", () => {
    const { result } = renderHook(() => useDialogState());
    
    const details = ["Item 1", "Item 2", "Item 3"];
    
    act(() => {
      result.current.openConfirmationDialog({
        title: "Bulk Delete",
        message: "Delete these items?",
        details,
        onConfirm: () => {},
      });
    });
    
    expect(result.current.dialogs.confirmationDialog.data?.details).toEqual(details);
  });

  it("preserves confirmation callback function", () => {
    const { result } = renderHook(() => useDialogState());
    const mockCallback = () => "test callback executed";
    
    act(() => {
      result.current.openConfirmationDialog({
        title: "Test",
        message: "Test message",
        onConfirm: mockCallback,
      });
    });
    
    const storedCallback = result.current.dialogs.confirmationDialog.data?.onConfirm;
    expect(typeof storedCallback).toBe("function");
    expect(storedCallback?.()).toBe("test callback executed");
  });

  it("handles AI data preview with complex data structures", () => {
    const { result } = renderHook(() => useDialogState());
    
    const complexData = {
      metadata: {
        generated_at: "2024-02-01T10:00:00Z",
        version: "1.0",
        settings: {
          ai_model: "gpt-4",
          parameters: {
            temperature: 0.7,
            max_tokens: 1000,
          },
        },
      },
      scheduleData: {
        employees: [
          { id: 1, name: "Alice", availability: ["monday", "tuesday"] },
          { id: 2, name: "Bob", availability: ["wednesday", "thursday"] },
        ],
        shifts: [
          { id: 1, name: "Morning", start: "08:00", end: "16:00" },
          { id: 2, name: "Evening", start: "16:00", end: "00:00" },
        ],
        assignments: [
          { employeeId: 1, shiftId: 1, date: "2024-02-01" },
          { employeeId: 2, shiftId: 2, date: "2024-02-01" },
        ],
      },
    };
    
    act(() => {
      result.current.openAiDataPreviewDialog(complexData);
    });
    
    expect(result.current.dialogs.aiDataPreviewDialog.data).toEqual(complexData);
    expect(result.current.dialogs.aiDataPreviewDialog.data?.scheduleData?.employees).toHaveLength(2);
    expect(result.current.dialogs.aiDataPreviewDialog.data?.metadata?.version).toBe("1.0");
  });
});
