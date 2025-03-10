# Schichtplan UI Improvement Tasks

## Sprint 1: Core UI Restructuring

### Task 1: Redesign Version Control
- [x] 1.1 Create CollapsibleSection component
- [x] 1.2 Update VersionControl to use tabbed interface
- [ ] 1.3 Integrate VersionControl with SchedulePage
- [ ] 1.4 Remove week selection from main UI
- [ ] 1.5 Update CSS for VersionControl component

### Task 2: Fix Empty Schedule Creation
- [x] 2.1 Modify create_new_version endpoint to always create empty schedules
- [ ] 2.2 Update frontend to handle empty schedules properly
- [ ] 2.3 Add proper error handling for schedule creation
- [ ] 2.4 Create visual indicators for empty vs filled shifts
- [ ] 2.5 Add confirmation dialogs for schedule changes

### Task 3: Implement Collapsible UI Sections
- [x] 3.1 Create reusable CollapsibleSection component
- [ ] 3.2 Apply CollapsibleSection to secondary form areas
- [ ] 3.3 Add animation for expand/collapse
- [ ] 3.4 Save user preferences for expanded/collapsed sections
- [ ] 3.5 Ensure correct initial state on page load

## Next Steps

After completing these initial tasks, we'll continue with:

1. Improving the shift table UX
2. Streamlining version management
3. Adding UI consistency
4. Optimizing performance

## Known Issues

- Type conflicts between imported Schedule types
- Need to ensure all components handle loading and error states properly
- Fix version selection in SchedulePage 