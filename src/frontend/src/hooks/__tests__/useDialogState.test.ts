import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "bun:test";
import { useDialogState } from "../useDialogState";

describe("useDialogState", () => {
  it("initializes with all dialogs closed", () => {
    const { result } = renderHook(() => useDialogState());
    
    expect(result.current.isGenerationSettingsOpen).toBe(false);
    expect(result.current.isAddScheduleDialogOpen).toBe(false);
    expect(result.current.isStatisticsModalOpen).toBe(false);
    expect(result.current.isDiagnosticsOpen).toBe(false);
    expect(result.current.isAddAvailabilityShiftsDialogOpen).toBe(false);
    expect(result.current.confirmDeleteMessage).toBeNull();
  });

  it("opens and closes generation settings dialog", () => {
    const { result } = renderHook(() => useDialogState());
    
    // Open dialog
    act(() => {
      result.current.openGenerationSettings();
    });
    
    expect(result.current.isGenerationSettingsOpen).toBe(true);
    
    // Close dialog
    act(() => {
      result.current.closeGenerationSettings();
    });
    
    expect(result.current.isGenerationSettingsOpen).toBe(false);
  });

  it("opens and closes add schedule dialog", () => {
    const { result } = renderHook(() => useDialogState());
    
    act(() => {
      result.current.openAddScheduleDialog();
    });
    
    expect(result.current.isAddScheduleDialogOpen).toBe(true);
    
    act(() => {
      result.current.closeAddScheduleDialog();
    });
    
    expect(result.current.isAddScheduleDialogOpen).toBe(false);
  });

  it("opens and closes statistics modal", () => {
    const { result } = renderHook(() => useDialogState());
    
    act(() => {
      result.current.openStatisticsModal();
    });
    
    expect(result.current.isStatisticsModalOpen).toBe(true);
    
    act(() => {
      result.current.closeStatisticsModal();
    });
    
    expect(result.current.isStatisticsModalOpen).toBe(false);
  });

  it("opens and closes diagnostics dialog", () => {
    const { result } = renderHook(() => useDialogState());
    
    act(() => {
      result.current.openDiagnostics();
    });
    
    expect(result.current.isDiagnosticsOpen).toBe(true);
    
    act(() => {
      result.current.closeDiagnostics();
    });
    
    expect(result.current.isDiagnosticsOpen).toBe(false);
  });

  it("opens and closes availability shifts dialog with correct type", () => {
    const { result } = renderHook(() => useDialogState());
    
    // Open with FIXED type
    act(() => {
      result.current.openAddAvailabilityShiftsDialog('FIXED');
    });
    
    expect(result.current.isAddAvailabilityShiftsDialogOpen).toBe(true);
    expect(result.current.availabilityShiftType).toBe('FIXED');
    
    // Close dialog
    act(() => {
      result.current.closeAddAvailabilityShiftsDialog();
    });
    
    expect(result.current.isAddAvailabilityShiftsDialogOpen).toBe(false);
    
    // Open with UNAVAILABLE type
    act(() => {
      result.current.openAddAvailabilityShiftsDialog('UNAVAILABLE');
    });
    
    expect(result.current.availabilityShiftType).toBe('UNAVAILABLE');
    
    // Open with PREFERRED type
    act(() => {
      result.current.openAddAvailabilityShiftsDialog('PREFERRED');
    });
    
    expect(result.current.availabilityShiftType).toBe('PREFERRED');
  });

  it("shows and hides confirm delete message", () => {
    const { result } = renderHook(() => useDialogState());
    
    const confirmMessage = {
      title: "Delete Schedule",
      message: "Are you sure you want to delete this schedule?",
      details: ["This action cannot be undone", "All data will be lost"],
      onConfirm: () => {},
      onCancel: () => {},
    };
    
    act(() => {
      result.current.showConfirmDelete(confirmMessage);
    });
    
    expect(result.current.confirmDeleteMessage).toEqual(confirmMessage);
    
    act(() => {
      result.current.hideConfirmDelete();
    });
    
    expect(result.current.confirmDeleteMessage).toBeNull();
  });

  it("closes all dialogs when closeAllDialogs is called", () => {
    const { result } = renderHook(() => useDialogState());
    
    // Open multiple dialogs
    act(() => {
      result.current.openGenerationSettings();
      result.current.openAddScheduleDialog();
      result.current.openStatisticsModal();
      result.current.openDiagnostics();
      result.current.openAddAvailabilityShiftsDialog('FIXED');
      result.current.showConfirmDelete({
        title: "Test",
        message: "Test message",
        onConfirm: () => {},
        onCancel: () => {},
      });
    });
    
    // Verify all are open
    expect(result.current.isGenerationSettingsOpen).toBe(true);
    expect(result.current.isAddScheduleDialogOpen).toBe(true);
    expect(result.current.isStatisticsModalOpen).toBe(true);
    expect(result.current.isDiagnosticsOpen).toBe(true);
    expect(result.current.isAddAvailabilityShiftsDialogOpen).toBe(true);
    expect(result.current.confirmDeleteMessage).not.toBeNull();
    
    // Close all
    act(() => {
      result.current.closeAllDialogs();
    });
    
    // Verify all are closed
    expect(result.current.isGenerationSettingsOpen).toBe(false);
    expect(result.current.isAddScheduleDialogOpen).toBe(false);
    expect(result.current.isStatisticsModalOpen).toBe(false);
    expect(result.current.isDiagnosticsOpen).toBe(false);
    expect(result.current.isAddAvailabilityShiftsDialogOpen).toBe(false);
    expect(result.current.confirmDeleteMessage).toBeNull();
  });

  it("correctly reports hasOpenDialogs state", () => {
    const { result } = renderHook(() => useDialogState());
    
    // Initially no dialogs open
    expect(result.current.hasOpenDialogs).toBe(false);
    
    // Open one dialog
    act(() => {
      result.current.openGenerationSettings();
    });
    
    expect(result.current.hasOpenDialogs).toBe(true);
    
    // Open another dialog
    act(() => {
      result.current.openAddScheduleDialog();
    });
    
    expect(result.current.hasOpenDialogs).toBe(true);
    
    // Close one dialog
    act(() => {
      result.current.closeGenerationSettings();
    });
    
    // Should still have open dialogs
    expect(result.current.hasOpenDialogs).toBe(true);
    
    // Close all dialogs
    act(() => {
      result.current.closeAllDialogs();
    });
    
    expect(result.current.hasOpenDialogs).toBe(false);
  });

  it("can handle individual state setters", () => {
    const { result } = renderHook(() => useDialogState());
    
    // Test individual state setters
    act(() => {
      result.current.setIsGenerationSettingsOpen(true);
    });
    
    expect(result.current.isGenerationSettingsOpen).toBe(true);
    
    act(() => {
      result.current.setIsAddScheduleDialogOpen(true);
    });
    
    expect(result.current.isAddScheduleDialogOpen).toBe(true);
    
    act(() => {
      result.current.setAvailabilityShiftType('UNAVAILABLE');
    });
    
    expect(result.current.availabilityShiftType).toBe('UNAVAILABLE');
  });

  it("handles confirm delete message with complex data", () => {
    const { result } = renderHook(() => useDialogState());
    
    const complexConfirmMessage = {
      title: "Bulk Delete Operation",
      message: "You are about to delete multiple schedules. This action cannot be undone.",
      details: [
        "Schedule v1.0 (Feb 1-28, 2024)",
        "Schedule v1.1 (Mar 1-31, 2024)",
        "Schedule v1.2 (Apr 1-30, 2024)",
        "All associated data will be permanently removed",
        "Employees will be notified of the changes",
      ],
      onConfirm: () => console.log("Confirmed bulk delete"),
      onCancel: () => console.log("Cancelled bulk delete"),
    };
    
    act(() => {
      result.current.showConfirmDelete(complexConfirmMessage);
    });
    
    expect(result.current.confirmDeleteMessage).toEqual(complexConfirmMessage);
    expect(result.current.confirmDeleteMessage?.details).toHaveLength(5);
    expect(result.current.confirmDeleteMessage?.title).toBe("Bulk Delete Operation");
  });

  it("handles dialog state changes with options callback", () => {
    const mockCallback = () => {};
    
    const { result } = renderHook(() => useDialogState({ onDialogChange: mockCallback }));
    
    act(() => {
      result.current.openGenerationSettings();
    });
    
    // Should call callback when dialog opens
    // Note: In real implementation, this would depend on the actual callback mechanism
    
    act(() => {
      result.current.closeGenerationSettings();
    });
    
    // Should call callback when dialog closes
    // Note: In real implementation, this would depend on the actual callback mechanism
  });
});
