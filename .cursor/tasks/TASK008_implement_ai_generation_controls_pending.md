# Task: Implement AI Generation Controls

## Overview
Develop user interface controls for initiating and configuring AI-powered schedule generation.

## Priority
High

## Dependencies
TASK004_create_wireframes
TASK006_create_schedule_visualization_component
TASK007_create_ai_schedule_api_endpoints

## Objectives
- Create intuitive UI for initiating AI scheduling
- Build constraint specification interface
- Develop preference adjustment controls
- Add progress indication during generation
- Implement version comparison feature

## Details

### Component Architecture
- Create a new component in `src/frontend/src/components/Schedule/AiControls.tsx`
- Implement subcomponents for different control aspects:
  - GenerationPanel for initiating schedule creation
  - ConstraintEditor for specifying constraints
  - PreferenceSliders for adjusting optimization priorities
  - ProgressIndicator for generation status
  - VersionCompare for reviewing different generated options

### Key Features
1. **Generation Controls**
   - Clear "Generate Schedule" button with appropriate placement
   - Date range selection with presets (next week, next month)
   - Option to use current schedule as starting point
   - Settings for generation quality/time tradeoff

2. **Constraint Specification**
   - Interface for key constraints (minimum staffing, keyholder requirements)
   - Employee-specific constraint editor
   - Ability to prioritize certain constraints over others
   - Saved constraint templates for reuse

3. **Preference Controls**
   - Sliders for balancing competing objectives:
     - Coverage vs. employee satisfaction
     - Fairness vs. optimization
     - Consistency vs. innovation
   - Visual feedback on preference impact

4. **Progress Indication**
   - Clear status updates during generation
   - Progress bar with percentage completion
   - Cancelation option for long-running operations
   - Preview of partial results when available

5. **Version Management**
   - Side-by-side comparison of schedule versions
   - Metrics highlighting differences between versions
   - Ability to merge or cherry-pick from different versions
   - Clear labeling and metadata for versions

### Technical Approach
- Use React hooks for state management
- Implement API client for AI endpoints
- Use WebSockets or polling for progress updates
- Ensure responsive design for all controls

### Deliverables
- AiControls component and related subcomponents
- CSS/styling for all controls
- Integration with API client
- Unit tests for all components
- Documentation for component API and usage

## Acceptance Criteria
- All controls function correctly and communicate with the API
- UI is intuitive and follows the design wireframes
- Progress indication accurately reflects generation status
- Version comparison clearly highlights differences
- All components are responsive and work on mobile devices

## Estimated Effort
4 days

## Notes
- Focus on making complex AI concepts accessible to non-technical users
- Ensure controls provide appropriate defaults for common scenarios
- Consider adding tooltips or help text for advanced features