# AI Schedule Integration - Complete Documentation

## Overview

The AI Schedule Integration has been successfully implemented to provide intelligent, optimized schedule generation for the Schichtplan application. This system uses multi-factor scoring algorithms to assign employees to shifts based on availability, preferences, fairness, historical performance, and other factors.

## Key Features

### 1. **AI-Powered Employee Scoring**
- Multi-factor scoring system with configurable weights
- Considers 8 key factors: availability, preferences, fairness, history, workload, keyholder requirements, skills, and fatigue
- Scores range from 0 to 1, where 1 indicates the best fit

### 2. **Employee Preferences Support**
- Day preferences (e.g., prefer weekdays, specific days)
- Time preferences (e.g., prefer morning shifts)
- 5-level preference scale: strongly dislike (1) to strongly like (5)

### 3. **Fair Distribution Algorithm**
- Ensures equitable distribution of hours among employees
- Prioritizes employees with fewer assigned hours
- Considers team average hours for balance

### 4. **Historical Performance Tracking**
- Tracks punctuality, reliability, quality, and attendance scores
- Uses historical data to inform future assignments
- 30-day lookback window by default

### 5. **Constraint Management**
- Respects all existing constraints (rest periods, max hours, consecutive days)
- Keyholder requirements with opening/closing time adjustments
- Skill/qualification matching
- Fatigue management based on consecutive work days

## Architecture

### New Components

1. **`src/bun-backend/scheduler/aiScoring.ts`**
   - Core AI scoring module
   - `AIScheduleScorer` class with configurable weights
   - ML feature extraction for future model integration

2. **Enhanced `src/bun-backend/scheduler/assignment.ts`**
   - Integrated AI scoring into candidate selection
   - Asynchronous scoring for all eligible candidates
   - Maintains backward compatibility with non-AI mode

3. **Updated `src/bun-backend/services/scheduleService.ts`**
   - Complete implementation of `generateSchedule` function
   - Expansion of coverage rules into 15-minute slots
   - Integration with AI scheduler
   - Database persistence of generated schedules

4. **Enhanced API Endpoints**
   - `/api/schedules/generate` now accepts AI configuration
   - Support for custom scoring weights and scheduler parameters

### Database Schema Additions

```sql
-- Employee Preferences
employee_preferences (
    id, employee_id, preference_type, 
    day_of_week, start_time, end_time, 
    preference_level, created_at, updated_at
)

-- Employee Qualifications
employee_qualifications (
    id, employee_id, qualification_id,
    acquired_date, expiry_date, is_active,
    created_at, updated_at
)

-- Performance Metrics
schedule_performance_metrics (
    id, employee_id, metric_date,
    punctuality_score, reliability_score,
    quality_score, attendance_rate,
    notes, created_at, updated_at
)

-- AI Scoring Logs (for debugging/ML training)
ai_scoring_logs (
    id, generation_id, employee_id,
    shift_start, shift_end, total_score,
    component_scores, context, ml_features,
    was_assigned, created_at
)

-- Generation Logs
schedule_generation_logs (
    id, generation_id, version, dates,
    status, statistics, config,
    timing, warnings, created_at
)
```

## API Usage

### Generate AI-Powered Schedule

```bash
POST /api/schedules/generate
Content-Type: application/json

{
  "startDate": "2024-01-01",
  "endDate": "2024-01-07",
  "createEmptySchedules": true,
  "version": null,  // Auto-create new version
  "aiConfig": {
    "weights": {
      "availability": 0.3,
      "preferences": 0.2,
      "fairness": 0.15,
      "history": 0.1,
      "workload": 0.1,
      "keyholder": 0.05,
      "skills": 0.05,
      "fatigue": 0.05
    },
    "fatigueThreshold": 4,
    "workloadBalanceTarget": 40,
    "historicalLookbackDays": 30
  },
  "schedulerConfig": {
    "minShiftMinutes": 120,
    "maxShiftMinutes": 600,
    "slotIntervalMinutes": 15,
    "maxConsecutiveDays": 6,
    "enforceKeyholderRule": true
  }
}
```

### Response Format

```json
{
  "status": "SUCCESS",
  "message": "AI-powered schedule generation completed",
  "version": 5,
  "dates": ["2024-01-01", "2024-01-07"],
  "counts": {
    "employees": 20,
    "assignments": 84,
    "unfilledSlots": 2,
    "warnings": 3
  },
  "warnings": [
    "Slot 2024-01-01T19:45:00.000Z is understaffed. Needed: 2, Assigned: 1"
  ],
  "logs": [...],
  "schedules": [...]
}
```

## Configuration Options

### AI Scoring Weights (0-1 scale)

- **availability** (0.3): Base weight for employee availability
- **preferences** (0.2): Weight for employee day/time preferences
- **fairness** (0.15): Weight for fair distribution of hours
- **history** (0.1): Weight for historical performance
- **workload** (0.1): Weight for workload balance
- **keyholder** (0.05): Weight for keyholder requirements
- **skills** (0.05): Weight for skill/qualification matching
- **fatigue** (0.05): Weight for fatigue/consecutive days factor

### Scheduler Configuration

- **minShiftMinutes**: Minimum shift duration (default: 120)
- **maxShiftMinutes**: Maximum shift duration (default: 600)
- **slotIntervalMinutes**: Time slot granularity (default: 15)
- **maxConsecutiveDays**: Maximum consecutive work days (default: 6)
- **defaultMinRestPeriodMinutes**: Minimum rest between shifts (default: 660)
- **enforceKeyholderRule**: Enable keyholder requirements (default: true)

## Setup Instructions

1. **Run Database Migration**
   ```sql
   -- Execute the migration script at:
   -- src/bun-backend/db/migrations/add_ai_schedule_tables.sql
   ```

2. **Add Employee Preferences**
   ```sql
   INSERT INTO employee_preferences 
   (employee_id, preference_type, day_of_week, preference_level)
   VALUES (1, 'day', 1, 4); -- Employee 1 likes Mondays
   ```

3. **Add Employee Qualifications**
   ```sql
   INSERT INTO employee_qualifications
   (employee_id, qualification_id, acquired_date)
   VALUES (1, 'keyholder', '2023-01-01');
   ```

4. **Add Performance Metrics**
   ```sql
   INSERT INTO schedule_performance_metrics
   (employee_id, metric_date, punctuality_score, reliability_score)
   VALUES (1, '2024-01-01', 0.95, 0.98);
   ```

## How It Works

1. **Coverage Expansion**: Converts coverage rules into 15-minute time slots
2. **Candidate Identification**: Finds available employees for each slot
3. **AI Scoring**: Scores each candidate using the multi-factor algorithm
4. **Optimal Selection**: Selects highest-scoring candidates
5. **Shift Consolidation**: Combines consecutive slots into shifts
6. **Constraint Validation**: Ensures all constraints are met
7. **Database Persistence**: Saves the optimized schedule

## Benefits

- **Improved Fairness**: Equitable distribution of hours and shifts
- **Employee Satisfaction**: Respects preferences when possible
- **Operational Efficiency**: Optimizes coverage while minimizing overstaffing
- **Flexibility**: Highly configurable weights and parameters
- **Transparency**: Detailed logging and score explanations
- **Future-Ready**: ML feature extraction for future enhancements

## Monitoring and Debugging

### View AI Scoring Logs
```sql
SELECT * FROM ai_scoring_logs 
WHERE generation_id = 'xxx' 
ORDER BY total_score DESC;
```

### Check Generation Statistics
```sql
SELECT * FROM schedule_generation_logs
WHERE version = 5;
```

### Employee Score Breakdown
```sql
SELECT 
  employee_id,
  AVG(total_score) as avg_score,
  AVG(preference_score) as avg_pref,
  AVG(fairness_score) as avg_fair
FROM ai_scoring_logs
GROUP BY employee_id;
```

## Future Enhancements

1. **Machine Learning Integration**: Train models on historical scoring data
2. **Real-time Optimization**: Dynamic schedule adjustments
3. **Preference Learning**: Automatically learn preferences from behavior
4. **Multi-objective Optimization**: Balance multiple business goals
5. **Predictive Analytics**: Forecast staffing needs

## Troubleshooting

### Common Issues

1. **No candidates available**: Check employee availability and absences
2. **Low scores across board**: Review and adjust weight configuration
3. **Unfilled slots**: May need to relax constraints or add employees
4. **Performance issues**: Consider reducing historicalLookbackDays

### Debug Mode

Enable detailed logging by setting the logger level:
```javascript
scheduleLogger.level = 'debug';
```

## Conclusion

The AI Schedule Integration provides a powerful, flexible system for generating optimal schedules. By considering multiple factors and using intelligent scoring, it creates schedules that balance operational needs with employee preferences and well-being.