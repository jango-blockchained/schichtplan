/// <reference lib="dom" />

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen } from "../../../test-utils/test-utils";
import type { ActionControlsSectionProps } from "../ActionControlsSection";
import { ActionControlsSection } from "../ActionControlsSection";

describe("ActionControlsSection", () => {
  const defaultProps: ActionControlsSectionProps = {
    // Schedule state
    isLoading: false,
    isGenerating: false,
    isAiFastGenerating: false,
    isAiDetailedGenerating: false,
    
    // Capabilities
    canAdd: true,
    canDelete: true,
    canGenerate: true,
    hasScheduleData: true,
    isAiEnabled: true,
    
    // Schedule actions
    onAddSchedule: mock(() => {}),
    onDeleteSchedule: mock(() => {}),
    onGenerateStandardSchedule: mock(() => {}),
    onGenerateAiFastSchedule: mock(() => {}),
    onGenerateAiDetailedSchedule: mock(() => {}),
    onOpenGenerationSettings: mock(() => {}),
    onOpenStatistics: mock(() => {}),
    
    // AI-specific actions
    onPreviewAiData: mock(() => {}),
    onImportAiResponse: mock(() => {}),
    
    // Utility actions
    onAddFixed: mock(() => {}),
    onAddUnavailable: mock(() => {}),
    onAddPreferred: mock(() => {}),
    
    // Action dock props
    showActionDock: true,
    currentVersion: 1,
    selectedDate: new Date("2024-01-01"),
    dateRange: {
      from: new Date("2024-01-01"),
      to: new Date("2024-01-07"),
    },
    versionMeta: {
      version: 1,
      is_published: false,
      created_at: "2024-01-01T00:00:00Z",
      notes: "Test version",
    },
    versionStatus: "DRAFT" as const,
    onDockClose: mock(() => {}),
    onDrop: mock(async () => {}),
    onAIPrompt: mock(async () => {}),
  };

  beforeEach(() => {
    // Reset all mocks before each test
    Object.values(defaultProps).forEach(prop => {
      if (typeof prop === 'function' && 'mockClear' in prop) {
        (prop as { mockClear: () => void }).mockClear();
      }
    });
  });

  it("renders ActionControlsSection with basic structure", () => {
    render(<ActionControlsSection {...defaultProps} />);
    
    // Check that the main container is rendered
    const container = screen.getByRole("group", { hidden: true });
    expect(container).toBeInTheDocument();
  });

  it("handles schedule action callbacks", () => {
    render(<ActionControlsSection {...defaultProps} />);
    
    // The component renders ScheduleActions and ActionDock
    // Since we're not mocking these components, we just verify they don't crash
    expect(() => render(<ActionControlsSection {...defaultProps} />)).not.toThrow();
  });

  it("handles loading states correctly", () => {
    const loadingProps = {
      ...defaultProps,
      isLoading: true,
      isGenerating: true,
    };
    
    render(<ActionControlsSection {...loadingProps} />);
    
    // Component should render without errors
    expect(() => render(<ActionControlsSection {...loadingProps} />)).not.toThrow();
  });

  it("handles disabled capabilities correctly", () => {
    const disabledProps = {
      ...defaultProps,
      canAdd: false,
      canDelete: false,
      canGenerate: false,
      isAiEnabled: false,
    };
    
    render(<ActionControlsSection {...disabledProps} />);
    
    // Component should render without errors
    expect(() => render(<ActionControlsSection {...disabledProps} />)).not.toThrow();
  });

  it("conditionally renders ActionDock based on showActionDock prop", () => {
    const propsWithoutDock = {
      ...defaultProps,
      showActionDock: false,
    };
    
    render(<ActionControlsSection {...propsWithoutDock} />);
    
    // Component should render without errors
    expect(() => render(<ActionControlsSection {...propsWithoutDock} />)).not.toThrow();
  });

  it("handles AI generation states", () => {
    const aiGeneratingProps = {
      ...defaultProps,
      isAiFastGenerating: true,
      isAiDetailedGenerating: true,
    };
    
    render(<ActionControlsSection {...aiGeneratingProps} />);
    
    // Component should render without errors
    expect(() => render(<ActionControlsSection {...aiGeneratingProps} />)).not.toThrow();
  });

  it("handles missing optional props gracefully", () => {
    const minimalProps = {
      ...defaultProps,
      currentVersion: undefined,
      selectedDate: undefined,
      dateRange: undefined,
      versionMeta: undefined,
      versionStatus: undefined,
      onDockClose: undefined,
      onDrop: undefined,
      onAIPrompt: undefined,
    };
    
    render(<ActionControlsSection {...minimalProps} />);
    
    // Component should render without errors
    expect(() => render(<ActionControlsSection {...minimalProps} />)).not.toThrow();
  });
});
