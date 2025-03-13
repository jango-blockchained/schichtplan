# Fair Distribution Scheduler Enhancement

This document describes the fair distribution enhancements implemented in the scheduler system. These improvements focus on creating more equitable shift assignments while respecting employee preferences and operational constraints.

## Overview

The fair distribution system enhances the scheduler by:

1. Tracking historical shift assignments for each employee
2. Scoring shifts based on desirability (early, late, weekend)
3. Balancing shift types across employees over time
4. Considering employee preferences in assignments
5. Providing metrics for analyzing shift distribution

## Components

### DistributionManager

The core component `DistributionManager` (in `distribution.py`) manages the fair distribution of shifts among employees. Key responsibilities include:

- Tracking historical shift assignments
- Calculating assignment scores
- Managing employee preferences
- Providing distribution metrics

### Integration with ScheduleGenerator

The `ScheduleGenerator` has been enhanced to:

- Initialize the distribution manager with historical data
- Use distribution-based scoring for employee assignments
- Update distribution metrics as shifts are assigned
- Provide detailed distribution metrics for analysis

## How It Works

### Shift Categorization

Shifts are categorized into several types:
- **Early**: Shifts starting before 8:00 AM
- **Late**: Shifts ending after 8:00 PM
- **Weekend**: Shifts on Saturday or Sunday
- **Standard**: Regular weekday shifts during business hours

### Scoring System

The system uses a scoring approach where:
- Each shift type has a base score reflecting its general desirability
- Lower scores indicate more desirable assignments
- Adjustments are made based on employee history, preferences, and other factors

### Score Components

1. **Base Score**: Determined by shift type (early, late, weekend, standard)
2. **History Adjustment**: Based on employee's past shift distribution
3. **Preference Adjustment**: Based on employee's stated preferences
4. **Seniority Adjustment**: Optional adjustment for seniority (if applicable)

### Assignment Selection

When assigning employees to shifts:
1. Available and qualified employees are identified
2. Scores are calculated for each potential assignment
3. Employee with lowest (best) score is selected
4. Distribution metrics are updated

## Configuration Options

The fair distribution system can be customized through several parameters:

- `fair_distribution_weight`: Controls importance of distribution fairness (default: 1.0)
- `preference_weight`: Controls importance of employee preferences (default: 1.0)
- `seniority_weight`: Controls importance of seniority (default: 0.5)

These weights can be adjusted to prioritize different aspects of the scheduling process.

## Metrics and Analysis

The system provides detailed metrics for analyzing shift distribution:

- Per-employee shift type distribution (counts and percentages)
- Overall shift type distribution
- Category totals and percentages

Example metrics output:
```json
{
  "employee_distribution": {
    "1": {
      "percentages": {
        "early": 40.0,
        "late": 30.0,
        "weekend": 20.0,
        "standard": 10.0
      },
      "counts": {
        "early": 4,
        "late": 3,
        "weekend": 2,
        "standard": 1,
        "total": 10
      }
    },
    "2": {
      "percentages": {
        "early": 20.0,
        "late": 50.0,
        "weekend": 20.0,
        "standard": 10.0
      },
      "counts": {
        "early": 2,
        "late": 5,
        "weekend": 2,
        "standard": 1,
        "total": 10
      }
    }
  },
  "category_totals": {
    "early": 6,
    "late": 8,
    "weekend": 4,
    "standard": 2,
    "total": 20
  },
  "overall_percentages": {
    "early": 30.0,
    "late": 40.0,
    "weekend": 20.0,
    "standard": 10.0
  }
}
```

## Future Enhancements

Planned future enhancements include:

1. **Enhanced Preference System**: More granular preference specification
2. **Rotation Systems**: Formal rotation handling for certain shift types
3. **Team Balance**: Ensuring balanced distribution across teams
4. **Visualization**: Improved visualization of distribution metrics
5. **Feedback Loop**: Using employee feedback to adjust distribution parameters 