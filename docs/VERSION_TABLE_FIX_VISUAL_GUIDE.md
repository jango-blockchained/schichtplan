# Version Table Fix - Visual Guide

## Problem: Exact Date Range Matching

### Before the Fix

When selecting a week (e.g., 2025-01-06 to 2025-01-12):

```
Timeline:
┌──────────────────────────────────────────────────────┐
│     Dec  │  Jan Week 1  │  Jan Week 2  │  Jan Week 3 │
├──────────┼──────────────┼──────────────┼──────────────┤
│  29-04   │   05-11      │   12-18      │   19-25     │
└──────────┴──────────────┴──────────────┴──────────────┘

Selected Range: Jan 06 - Jan 12
                    ▼
                ┌───────┐
                │Week 2 │
                └───────┘

Versions in Database:
┌────────────────────────────────────────┐
│ Version 1: Dec 30 - Jan 05 (Week 1)   │ ❌ Hidden (doesn't match exactly)
│ Version 2: Jan 06 - Jan 12 (Week 2)   │ ✅ Shown (exact match)
│ Version 3: Jan 06 - Jan 31 (Month)    │ ❌ Hidden (doesn't match exactly)
│ Version 4: Jan 10 - Jan 16 (Custom)   │ ❌ Hidden (doesn't match exactly)
└────────────────────────────────────────┘

PROBLEM: Only Version 2 is shown!
User cannot see overlapping versions 3 and 4.
```

## Solution: Overlapping Date Range Matching

### After the Fix

When selecting the same week (2025-01-06 to 2025-01-12):

```
Timeline:
┌──────────────────────────────────────────────────────┐
│     Dec  │  Jan Week 1  │  Jan Week 2  │  Jan Week 3 │
├──────────┼──────────────┼──────────────┼──────────────┤
│  29-04   │   05-11      │   12-18      │   19-25     │
└──────────┴──────────────┴──────────────┴──────────────┘

Selected Range: Jan 06 - Jan 12
                    ▼
                ┌───────┐
                │Week 2 │
                └───────┘

Versions in Database:
┌────────────────────────────────────────┐
│ Version 1: Dec 30 - Jan 05 (Week 1)   │ ❌ Hidden (no overlap - ends before)
│ Version 2: Jan 06 - Jan 12 (Week 2)   │ ✅ Shown (exact match - overlaps)
│ Version 3: Jan 06 - Jan 31 (Month)    │ ✅ Shown (contains week - overlaps)
│ Version 4: Jan 10 - Jan 16 (Custom)   │ ✅ Shown (partial overlap - overlaps)
└────────────────────────────────────────┘

SOLUTION: All overlapping versions are shown!
User can see all relevant versions for the selected period.
```

## Overlapping Logic

### Visual Representation

```
Request Range:  [========]
                 A      B

Test Cases:

1. Fully Contained (OVERLAP ✅)
   Version:      [====]
                 A  B

2. Partial Overlap Start (OVERLAP ✅)
   Version:    [====]
               A  B

3. Partial Overlap End (OVERLAP ✅)
   Version:        [====]
                   A  B

4. Fully Containing (OVERLAP ✅)
   Version:    [==========]
               A    B

5. No Overlap - Before (NO OVERLAP ❌)
   Version:  [===]
             A  B

6. No Overlap - After (NO OVERLAP ❌)
   Version:          [===]
                     A  B

7. Exact Match (OVERLAP ✅)
   Version:    [========]
               A      B

8. Adjacent - Touching (NO OVERLAP ❌)
   Request:   [========]
              A      B
   Version:            [========]
                       C      D
```

### Mathematical Formula

A version overlaps with the request range if:

```
version.start <= request.end  AND  version.end >= request.start
```

### Code Implementation

**Backend (Python):**
```python
query = query.filter(
    and_(
        VersionMeta.date_range_start <= end_date,
        VersionMeta.date_range_end >= start_date,
    )
)
```

**Frontend (TypeScript):**
```typescript
const overlaps = versionStart <= currentTo && versionEnd >= currentFrom;
```

## Real-World Example

### Scenario: Planning a Holiday Week

User wants to plan schedules for Christmas week (Dec 23-29, 2024).

**Before Fix:**
- Only sees versions created specifically for Dec 23-29
- Misses monthly version (Dec 1-31) that covers this period
- Misses partial versions (Dec 25-Jan 2) that overlap

**After Fix:**
- Sees version for Dec 23-29 (exact match)
- Sees version for Dec 1-31 (contains the week)
- Sees version for Dec 25-Jan 2 (partial overlap)
- Can compare all relevant versions for better planning

## Benefits

1. **Complete Visibility**: Users see all versions relevant to their selection
2. **Better Planning**: Can compare overlapping versions
3. **Flexible Scheduling**: Supports custom date ranges that overlap weeks
4. **Intuitive**: Matches user expectations ("show me all versions for this period")

## Edge Cases Handled

✅ **Week transitions**: Versions spanning multiple weeks are visible
✅ **Month boundaries**: Versions crossing month boundaries are visible
✅ **Custom ranges**: Any arbitrary date range works correctly
✅ **Single-day versions**: Still work correctly
✅ **Long-term versions**: Multi-month versions are visible when relevant
