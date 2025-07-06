# Task: Restore Classic AI Generation Dialog

## Task ID

RST001

## Description

Restore the old, more professional version of the AI generation dialog alongside the current multi-step conversation dialog.

## Objectives

1. Create a new dialog component based on the old `DetailedAIGenerationModal.tsx`
2. Name it `ClassicAIGenerationDialog` to distinguish from current version
3. Integrate it into the SchedulePage with proper controls
4. Update interfaces to work with current backend services
5. Add UI controls to let users choose between dialog types

## Current Status

- Found the old professional version: `DetailedAIGenerationModal.tsx`
- It has comprehensive controls: priority sliders, constraint overrides, employee options, AI parameters, conversation panel
- Current dialog is `AIConversationGenerationDialog` with multi-step process
- Need to create new version and integrate alongside current one

## Technical Details

- Old version has tabbed interface with 5 tabs: Priorities, Constraints, Employees, AI Parameters, Conversation
- Current version has 6-step process: initialize, analyze, recommend, generate, review, complete
- Need to adapt old version's interface to work with current backend API

## Integration Points

- SchedulePage.tsx line ~2563 uses AIConversationGenerationDialog
- Need to add new dialog alongside current one
- Add toggle/choice UI to select between classic and modern dialog

## Priority

High - User specifically requested this restoration

## Dependencies

None

## Output Files

- `/home/jango/Git/maike2/schichtplan/src/frontend/src/components/Schedule/ClassicAIGenerationDialog.tsx`
- Updated `/home/jango/Git/maike2/schichtplan/src/frontend/src/pages/SchedulePage.tsx`

## Completion Criteria

- New ClassicAIGenerationDialog component created and working
- Integrated into SchedulePage with proper controls
- Users can choose between classic and modern dialog
- Backend integration working properly
