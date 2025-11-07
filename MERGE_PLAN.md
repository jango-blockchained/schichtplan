# Multi-Step Merge Plan: feature/reui-design-upgrade-v2 ← 98bc0b55

## Overview

Merging commit `98bc0b55` (feature/week-navigation-only) into `feature/reui-design-upgrade-v2`.

**Current Branch:** feature/reui-design-upgrade-v2 (42fdc518)
**Target Commit:** 98bc0b55 (feature/week-navigation-only)
**Total Changes:** 62 files, ~5200 insertions, ~5600 deletions

### Key Differences

1. **API Service Refactoring:** Monolithic api.ts split into modular structure (11 new files)
2. **CI/CD Pipelines:** New GitHub Actions workflows (.github/workflows/)
3. **Electron Support:** New electron/ directory and electron-builder.json
4. **Authentication Changes:** PassKey auth route refactored, admin passkey reset removed
5. **Employee Types:** New migration and fields (hours_on_absence, working_days_per_week)
6. **UI Components:** EmployeeAvailabilityViewer, EnumDataTable components added
7. **Documentation:** Old auth docs removed, new CI/CD docs and summaries added
8. **Settings Model:** Updated with new fields

---

## Merge Strategy: Phased Approach

### Phase 1: Preparation

- [ ] Create backup branch
- [ ] Check for conflicts
- [ ] Document current state

### Phase 2: Non-Conflicting Infrastructure

- [ ] Merge CI/CD workflows (.github/workflows/)
- [ ] Merge Electron support (electron/, electron-builder.json)
- [ ] Update .gitignore
- [ ] Merge package.json changes (add Electron dependencies)

### Phase 3: Database Migrations

- [ ] Apply employee type fields migration (add_employee_type_fields.py)
- [ ] Update Settings model with new fields
- [ ] Run database migrations

### Phase 4: Backend Changes

- [ ] Merge authentication route changes (passkey_auth.py)
- [ ] Merge setup route changes (setup.py)
- [ ] Update models (user.py changes)
- [ ] Merge backend migrations directory

### Phase 5: Frontend API Refactoring (Critical)

- [ ] Backup current api.ts
- [ ] Create new modular structure:
  - src/frontend/src/services/api/index.ts (main export)
  - src/frontend/src/services/api/absence.ts
  - src/frontend/src/services/api/ai.ts
  - src/frontend/src/services/api/coverage.ts
  - src/frontend/src/services/api/database.ts
  - src/frontend/src/services/api/employee.ts
  - src/frontend/src/services/api/instance.ts
  - src/frontend/src/services/api/log.ts
  - src/frontend/src/services/api/schedule.ts
  - src/frontend/src/services/api/settings.ts
  - src/frontend/src/services/api/shift.ts
  - src/frontend/src/services/api/util.ts
  - src/frontend/src/services/api/version.ts
  - src/frontend/src/services/api/week.ts
- [ ] Consolidate monolithic api.ts into modular exports
- [ ] Update all imports across frontend

### Phase 6: Frontend UI Components

- [ ] Add EmployeeAvailabilityViewer.tsx
- [ ] Add EnumDataTable.tsx
- [ ] Update EmployeeSettingsEditor.tsx
- [ ] Update ShiftTypesEditor.tsx
- [ ] Update LoginPage.tsx
- [ ] Update SetupWizard.tsx
- [ ] Update ScheduleTable.tsx
- [ ] Update setupService.ts
- [ ] Update useSettings hook

### Phase 7: Documentation & Cleanup

- [ ] Remove old authentication documentation:
  - docs/AUTHENTICATION_FINAL_STATUS.md
  - docs/AUTHENTICATION_TEST_GUIDE.md
  - docs/AUTHENTICATION_UI_POLISH_SUMMARY.md
  - docs/PASSKEY_RESET_GUIDE.md
  - AUTHENTICATION_COMPLETION_SUMMARY.md
  - AUTHENTICATION_QUICK_START.md
  - AUTHENTICATION_VERIFICATION_REPORT.md
- [ ] Add new documentation:
  - docs/CI_CD_ARCHITECTURE.md
  - docs/CI_CD_IMPLEMENTATION_SUMMARY.md
  - docs/CI_CD_QUICK_REFERENCE.md
  - docs/CI_CD_SETUP.md
  - FEATURE_SUMMARY.txt
  - IMPLEMENTATION_SUMMARY.md
  - PR_SUMMARY.md
  - REFACTORING_SUMMARY.md
  - TESTING_GUIDE.md
  - verify_features.py
- [ ] Update README.md

### Phase 8: Testing & Validation

- [ ] Run database migration validation
- [ ] Test backend startup
- [ ] Test frontend build
- [ ] Verify API endpoints
- [ ] Run test suite
- [ ] Manual smoke tests

### Phase 9: Conflict Resolution

- [ ] Review any merge conflicts
- [ ] Reconcile authentication changes
- [ ] Ensure UI component integration

---

## Potential Conflict Areas

### 1. API Service (HIGH PRIORITY)

**Current State:** Monolithic `src/frontend/src/services/api.ts` (2095 lines)
**Target State:** Modular structure with 14 files

**Resolution Strategy:**

- Keep authentication additions from current branch
- Ensure all API endpoints are exported from new modular structure
- Test all API calls after refactoring

### 2. Authentication Routes

**Current State:** Enhanced passkey registration with credential parsing
**Target State:** Simplified passkey routes without admin reset tool

**Resolution Strategy:**

- Preserve authentication enhancements from current branch
- Apply target branch's route organization
- Keep both passkey registration improvements

### 3. LoginPage & SetupWizard

**Current State:** Enhanced styling and user feedback
**Target State:** UI updates with new components

**Resolution Strategy:**

- Merge both styling improvements and new component structure
- Ensure visual consistency maintained

### 4. Package.json

**Current State:** Current branch dependencies
**Target State:** Adds Electron and new packages

**Resolution Strategy:**

- Merge both dependency sets
- Ensure no version conflicts

---

## Implementation Commands

```bash
# Step 1: Create safety backup
git branch backup/reui-design-upgrade-v2-before-merge

# Step 2: Start merge
git merge 98bc0b55 --no-commit --no-ff

# Step 3: Handle conflicts as they appear
git status  # Review conflicts
# Edit conflicting files
git add <resolved-files>

# Step 4: Complete merge
git commit -m "Merge: Integrate API refactoring and Electron support from feature/week-navigation-only"

# Step 5: Verify
npm run build  # or bun run build
npm test      # or bun test
```

---

## Risk Assessment

| Risk                           | Severity | Mitigation                           |
| ------------------------------ | -------- | ------------------------------------ |
| API refactoring breaks imports | HIGH     | Comprehensive test of all API calls  |
| Authentication regression      | HIGH     | Preserve current auth improvements   |
| Electron bloat if not needed   | MEDIUM   | Can be removed in settings           |
| Database migration failures    | HIGH     | Test on backup database first        |
| Missing dependencies           | MEDIUM   | Verify package.json merged correctly |

---

## Post-Merge Checklist

- [ ] Database migrations applied successfully
- [ ] Backend starts without errors
- [ ] Frontend builds without errors
- [ ] All API endpoints functional
- [ ] Authentication flows work
- [ ] No console errors in browser
- [ ] Test suite passes
- [ ] New components render correctly
- [ ] CI/CD pipelines configured

---

## Rollback Plan

If issues arise:

```bash
git reset --hard backup/reui-design-upgrade-v2-before-merge
```

---

## Notes

- The target commit includes major refactoring (API modularization)
- 11 new API service files need careful import consolidation
- Database schema changes require migration verification
- Old authentication documentation should be removed as per target branch
- Electron support is additive (can be disabled if not needed)
