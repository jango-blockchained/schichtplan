# Task: Design and Layout for AI Scheduling Frontend

## Priority

High

## Description

Design and implement the user interface for interacting with the AI scheduling features. This includes controls for initiating AI generation, viewing AI-generated schedule suggestions, and applying them.

## Objectives

- Design a user-friendly interface for AI scheduling.
- Create mockups/wireframes for the AI scheduling section of the frontend.
- Implement the layout and static components for these views.
- Ensure the design is consistent with the existing application's UI.

## Dependencies

- TASK005_implement_ai_scheduling_service_in_progress.md (for understanding backend capabilities)
- TASK007_create_ai_schedule_api_endpoints_on_hold.md (for API integration later)

## Details

### Key UI Elements to Design

1. **AI Generation Controls:**
   - Button to trigger AI schedule generation.
   - Options/parameters for the AI (e.g., date range, specific constraints to prioritize).
   - Loading/progress indicator during generation.

2. **AI Schedule Suggestion View:**
   - Display of one or more AI-generated schedule suggestions.
   - Clear visual distinction between current schedule and AI suggestions.
   - Ability to compare suggestions if multiple are presented.
   - Metrics/scores for each suggestion (e.g., coverage, fairness, cost).

3. **Suggestion Application:**
   - Controls to accept/apply an AI suggestion to the main schedule.
   - Mechanism to partially accept or edit a suggestion before applying.
   - Confirmation step before overwriting parts of the existing schedule.

4. **Status/Feedback Area:**
   - Display messages from the AI scheduler (e.g., "Generation complete", "No feasible schedule found with given constraints").

### Design Considerations

- **Clarity:** Users should easily understand how to use the AI features and interpret the results.
- **Control:** Users should feel in control of the AI, with clear options and confirmation steps.
- **Responsiveness:** The UI should be responsive and provide feedback during long operations.
- **Integration:** The new UI elements should seamlessly integrate into the existing frontend application structure and style.

## Acceptance Criteria

- Mockups/wireframes for the AI scheduling UI are created and approved (self-approval for now).
- Basic layout and static components are implemented in the frontend codebase.
- The design is intuitive and aligns with the application's existing look and feel.

## Plan

1. **Information Gathering and Inspiration:**
   - Search for examples of AI-assisted scheduling UIs or similar complex data interaction UIs.
   - Analyze the existing frontend structure in `src/frontend` to understand the framework, component libraries (e.g., Material UI, Bootstrap, custom components), and overall design language.
   - Identify common UI patterns used in the application.

2. **Wireframing/Layout Description:**
   - Based on findings and task requirements, create textual descriptions or simple wireframes for:
     - AI Generation Controls
     - AI Schedule Suggestion View
     - Suggestion Application Process
     - Status/Feedback Area
   - Focus on user flow and information hierarchy.

3. **Static Component Implementation:**
   - Identify or create appropriate files in `src/frontend/components/` (assuming a component-based structure) or relevant views.
   - Implement the HTML structure and basic CSS for the new UI elements based on the wireframes/descriptions.
   - Use placeholder content and ensure responsiveness if applicable.

## Wireframing/Layout Description (Textual)

The AI scheduling features will likely reside within an existing scheduling page or a new dedicated "AI Scheduler" page. Let's assume it's part of an existing schedule management view.

1.  **Main Layout:**
    -   The existing schedule view (e.g., a calendar or table) will remain the primary focus.
    -   A new collapsible section or a tab titled "AI Assistant" or "AI Scheduler" will be added, likely in a sidebar or a prominent control panel area.

2.  **AI Assistant Section (when expanded/active):**

    -   **AI Generation Controls (Top of the AI section):**
        -   A `Card` component from `shadcn/ui` to group these controls.
        -   `CardHeader`: "AI Schedule Generation"
        -   `CardContent`:
            -   `DatePicker` or `DateRangePicker` (from `components/ui/date-picker.tsx` or `date-range-picker.tsx`) for selecting the period for AI generation. Label: "Schedule Period".
            -   Potentially a `Select` component for choosing AI profiles or pre-set constraint priorities (if this becomes a feature). Label: "AI Profile (Optional)".
            -   A `Button` (primary variant) labeled "Generate with AI".
            -   Below the button, a small text area or `Alert` component for status messages during generation (e.g., "Generating...", "Analyzing constraints..."). This could use a `Skeleton` component while loading.

    -   **AI Schedule Suggestion View (Middle/Main part of the AI section):**
        -   This area will be conditionally rendered, appearing after generation is complete.
        -   If no suggestions: An `Alert` (variant: "destructive" or "info") saying "No feasible schedule found" or "AI generation did not produce suggestions for the selected period/constraints."
        -   If suggestions are available:
            -   A `Tabs` component to switch between multiple suggestions if the backend provides more than one (e.g., "Suggestion 1", "Suggestion 2").
            -   Each `TabsContent` (suggestion) will display:
                -   A `Card` or a styled `div` to encapsulate the suggestion.
                -   `CardHeader`: "AI Suggestion X" (with key metrics like "Coverage: 95%", "Fairness Score: 8/10"). These could be `Badge` components.
                -   `CardContent`: A compact representation of the suggested schedule. This is the most complex part.
                    -   It might be a simplified version of the main schedule table/calendar, highlighting changes or just showing the AI-assigned shifts.
                    -   Alternatively, a list of changes: "Assign Employee A to Morning Shift on 2025-06-01", "Remove Employee B from Night Shift on 2025-06-03".
                    -   Visual cues (colors, icons) to differentiate AI suggestions from the current schedule.
                -   `CardFooter`:
                    -   `Button` (secondary variant): "Preview Changes" (might overlay changes on the main schedule view temporarily).
                    -   `Button` (primary variant): "Apply this Suggestion".
                    -   `Button` (ghost or link variant): "Discard Suggestion".

    -   **Suggestion Application Process:**
        -   Clicking "Apply this Suggestion" could:
            -   Show a `AlertDialog` for confirmation: "Are you sure you want to apply this AI-generated schedule? This may overwrite existing shifts for the selected period."
                -   Buttons: "Confirm & Apply", "Cancel".
            -   Upon confirmation, a `Toast` (using `sonner.tsx` or `toaster.tsx`) for success/failure: "AI schedule applied successfully." or "Error applying schedule."

    -   **Status/Feedback Area (Persistent at the bottom of AI section or global):**
        -   A dedicated `Alert` component or a section within the AI `Card` to show persistent messages or errors from the AI scheduler that are not tied to a specific suggestion (e.g., "AI service unavailable", "Initial setup required for AI scheduling").

## Next Steps (after this task)

- Integrate with AI scheduling API endpoints.
- Implement dynamic data loading and interaction.
