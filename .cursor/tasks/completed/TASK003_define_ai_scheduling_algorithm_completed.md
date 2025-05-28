# Task: Define AI Scheduling Algorithm Requirements

## Overview
Define the requirements and specifications for the AI scheduling algorithm that will power the new schedule page, leveraging the existing AI scheduling settings.

## Priority
High

## Dependencies
TASK001_analyze_existing_schedule

## Objectives
- Review existing AI scheduling settings in the application
- Define the core algorithm approach for schedule generation
- Identify required inputs, constraints, and optimization criteria
- Document API requirements for AI integration
- Specify feedback mechanisms for algorithm improvement

## Details

### Current AI Settings Analysis
- Review the existing `ai_scheduling` settings in the Settings model
- Analyze the API key that exists but appears to be unused
- Determine if any AI scheduling logic already exists in the codebase

### Algorithm Requirements
- Define optimization objectives:
  - Coverage requirement fulfillment
  - Employee preference satisfaction
  - Fair distribution of shifts
  - Adherence to labor regulations
  - Minimization of scheduling conflicts
- Specify constraint handling:
  - Employee availability
  - Required skills/qualifications
  - Break requirements
  - Maximum/minimum working hours
  - Rest periods between shifts

### API Specification
- Input parameters:
  - Date range
  - Employee constraints
  - Coverage requirements
  - Optimization priorities
  - Previous schedules (for learning)
- Output format:
  - Generated schedule assignments
  - Confidence scores
  - Constraint satisfaction metrics
  - Alternative suggestions

## Findings & Recommendations

### Existing AI Implementation Analysis

1. **Current Infrastructure:**
   - An `AISchedulerService` class exists that interfaces with the Gemini 1.5 Flash model
   - The service collects data from models (Employee, ShiftTemplate, Coverage, Absence, EmployeeAvailability)
   - It formats data for the AI, calls the Gemini API, and parses/stores the results
   - API endpoints in `ai_schedule_routes.py` support generating schedules, importing AI responses, and providing feedback

2. **AI Settings Structure:**
   - The Settings model has an `ai_scheduling` JSON field with `enabled` and `api_key` properties
   - Several utility scripts exist for checking/updating these settings
   - Frontend components check for `isAiEnabled` to conditionally render AI features

3. **Integration Status:**
   - Some frontend integration points exist (importAiScheduleResponse in api.ts)
   - Basic API endpoints are implemented but not fully utilized
   - Missing comprehensive UI for AI configuration and feedback

### Core Algorithm Specification

#### 1. Hybrid Algorithm Model

The algorithm should combine rule-based constraint processing with AI-powered optimization:

- **Initial Pass:** Rule-based validation to ensure all hard constraints are met
- **Secondary Pass:** AI optimization to satisfy soft constraints and preferences
- **Final Pass:** Human review and feedback loop for continuous improvement

#### 2. Required Inputs

- **Scheduling Period:** 
  - Start date and end date
  - Version ID (for tracking different schedule iterations)

- **Employee Data:**
  - Basic information (ID, name, role)
  - Qualification data (is_keyholder, skills)
  - Contract constraints (max_weekly_hours)
  - Preference data (default_availability)
  - Historical data (previous schedules for learning patterns)

- **Shift Templates:**
  - Shift definitions (start_time, end_time)
  - Active days (which days of the week the shift applies to)
  - Special requirements (requires_keyholder)

- **Coverage Requirements:**
  - Minimum staffing levels by time period
  - Required skills/qualifications by time period
  - Priority levels for different coverage needs

- **Availability Constraints:**
  - Employee availability windows
  - Recurring availability patterns
  - Preference strength indicators (preferred vs. available)

- **Absence Data:**
  - Approved time off
  - Partial day absences

- **Algorithm Configuration:**
  - Weights for different optimization criteria
  - Maximum computation time
  - User-defined priority overrides

#### 3. Constraint Modeling

**Hard Constraints (Must Be Satisfied):**

- **Availability Constraints:**
  - Employees cannot be scheduled during unavailable periods
  - Implementation: Filter candidates before assignment

- **Absence Constraints:**
  - Employees cannot be scheduled during approved absences
  - Implementation: Pre-process to remove invalid assignments

- **Coverage Requirements:**
  - Each shift must have at least `min_employees` assigned
  - Implementation: Post-validation check

- **Keyholder Requirements:**
  - Shifts requiring keyholders must have at least one keyholder assigned
  - Implementation: Candidate filtering + post-validation

- **Working Hours Limits:**
  - Daily maximum: Employees cannot work more than `max_daily_hours` per day
  - Weekly maximum: Employees cannot work more than `max_weekly_hours` per week
  - Implementation: Running tallies during assignment

- **Rest Period Requirements:**
  - Employees must have at least `min_rest_hours` between shifts
  - Implementation: Check against previous day's assignments

**Soft Constraints (Optimize For):**

- **Preference Satisfaction:**
  - Prioritize scheduling employees during their preferred times
  - Weight: High

- **Fair Distribution:**
  - Distribute desirable/undesirable shifts equitably
  - Weight: Medium

- **Skill Matching:**
  - Assign employees to shifts that best utilize their skills
  - Weight: Medium

- **Shift Continuity:**
  - Prefer consistent scheduling patterns (early/late/etc.)
  - Weight: Low

- **Seniority Consideration:**
  - Consider employee seniority for preferred shifts
  - Weight: Low

#### 4. Optimization Criteria

**Primary Objectives:**
- **Coverage Fulfillment:** Ensure all shifts have the required minimum staffing
- **Constraint Satisfaction:** Adhere to all hard constraints
- **Preference Maximization:** Satisfy as many employee preferences as possible
- **Fairness Metrics:** Distribute shifts equitably

**Secondary Objectives:**
- **Continuity:** Maintain consistent scheduling patterns where beneficial
- **Skill Utilization:** Optimal deployment of specialized skills
- **Overtime Minimization:** Reduce excess hours
- **Work-Life Balance:** Consider weekends, evenings distribution

**Measurable Metrics:**
- Percentage of shifts with minimum coverage met
- Percentage of employee preferences satisfied
- Standard deviation of assigned hours (fairness)
- Variance in weekend/evening shift distribution
- Number of constraint violations (should be zero for hard constraints)

#### 5. Algorithm Flow

1. **Data Collection Phase:**
   - Gather all required inputs
   - Format data into structured representations
   - Pre-process data to identify potential conflicts

2. **Pre-Validation Phase:**
   - Check for impossible constraints
   - Identify dates/shifts with potential coverage issues
   - Flag potential conflicts in availability vs. coverage needs

3. **Initial Assignment Phase:**
   - Create an empty schedule grid
   - For each date and shift combination:
     - Identify eligible employees
     - Calculate preference scores for each eligible employee
     - Make initial assignments based on hard constraints and highest preferences
     - Track running totals of hours assigned per employee

4. **Constraint Validation Phase:**
   - Verify all hard constraints are satisfied
   - Identify any constraint violations
   - Roll back problematic assignments if necessary

5. **Optimization Phase:**
   - Use AI to refine the initial schedule
   - Prompt AI with current state, constraints, and optimization objectives
   - Parse AI suggestions for improvements
   - Apply changes that maintain hard constraint satisfaction while improving metrics

6. **Finalization Phase:**
   - Generate final schedule with assignments
   - Calculate quality metrics
   - Provide explanations for key decisions
   - Store results with version tracking

7. **Feedback Integration Phase:**
   - Collect human feedback on generated schedules
   - Identify patterns in accepted vs. rejected assignments
   - Update optimization weights based on feedback
   - Store feedback for future learning

### API Requirements

1. **Schedule Generation API:**
   - **Endpoint:** `/api/ai_schedule_bp/schedule/generate-ai` (existing)
   - **Method:** POST
   - **Input Parameters:**
     - `start_date`: Start date of scheduling period (YYYY-MM-DD)
     - `end_date`: End date of scheduling period (YYYY-MM-DD)
     - `version_id`: Optional version identifier
     - `ai_model_params`: Optional AI model configuration
     - `optimization_weights`: Optional weighting for different optimization criteria
     - `constraints_override`: Optional override for specific constraints
   - **Response:**
     - `status`: Success/failure
     - `schedule_data`: Generated assignments
     - `metrics`: Quality metrics for the generated schedule
     - `explanations`: Explanations for key decisions
     - `warnings`: Any potential issues identified
     - `diagnostic_log_path`: Path to detailed logs

2. **Schedule Import API:**
   - **Endpoint:** `/api/ai_schedule_bp/schedule/import-ai-response` (existing)
   - **Method:** POST
   - **Input Parameters:**
     - `file`: CSV file with schedule assignments
     - `version_id`: Version identifier
     - `start_date`: Start date of scheduling period
     - `end_date`: End date of scheduling period
   - **Response:**
     - `status`: Success/failure
     - `imported_count`: Number of assignments imported
     - `errors`: Any import errors encountered

3. **Feedback API:**
   - **Endpoint:** `/api/ai_schedule_bp/feedback` (existing)
   - **Method:** POST
   - **Input Parameters:**
     - `version_id`: Version identifier for the schedule
     - `manual_assignments`: User modifications to the schedule
     - `rejected_assignments`: Assignments explicitly rejected
     - `feedback_comments`: Textual feedback
     - `rating`: Overall quality rating
   - **Response:**
     - `status`: Success/failure
     - `feedback_id`: Identifier for the submitted feedback

4. **Schedule Explanation API:**
   - **Endpoint:** `/api/ai_schedule_bp/schedule/explain` (new)
   - **Method:** GET
   - **Input Parameters:**
     - `version_id`: Version identifier
     - `date`: Specific date to explain
     - `employee_id`: Optional filter for specific employee
     - `shift_id`: Optional filter for specific shift
   - **Response:**
     - `explanations`: Detailed explanations for assignments
     - `constraints_applied`: Constraints that affected the decisions
     - `alternatives_considered`: Alternative assignments that were considered

5. **Configuration API:**
   - **Endpoint:** `/api/ai_schedule_bp/config` (new)
   - **Method:** GET/POST
   - **Input Parameters (POST):**
     - `ai_settings`: Settings for the AI scheduler
     - `constraint_weights`: Relative importance of different constraints
     - `optimization_priorities`: Prioritization of optimization objectives
   - **Response:**
     - `current_config`: Current configuration settings

### Extended AI Settings Model

To support the enhanced AI scheduling functionality, the existing `ai_scheduling` settings should be extended:

```json
{
  "enabled": true,
  "api_key": "your-gemini-api-key",
  "model": {
    "provider": "gemini",
    "model_name": "gemini-1.5-flash",
    "temperature": 0.6,
    "max_tokens": 8192
  },
  "constraints": {
    "enforce_min_coverage": true,
    "enforce_keyholder_requirements": true,
    "enforce_max_hours": true,
    "enforce_rest_periods": true,
    "min_rest_hours": 10,
    "max_daily_hours": 10,
    "max_weekly_hours": 40
  },
  "optimization": {
    "weights": {
      "preference_satisfaction": 10,
      "fair_distribution": 7,
      "skill_matching": 5,
      "shift_continuity": 3,
      "seniority": 2
    },
    "priority_overrides": {
      "coverage": "high",
      "preferences": "medium",
      "fairness": "medium"
    }
  },
  "explanations": {
    "enabled": true,
    "detail_level": "medium",
    "include_alternatives": true
  },
  "feedback": {
    "collect_ratings": true,
    "apply_learning": true,
    "learning_rate": 0.1
  }
}
```

### Feedback Mechanisms

1. **Direct User Feedback:**
   - Allow users to rate generated schedules
   - Collect specific feedback on problematic assignments
   - Enable manual overrides with reasons
   - Track which AI suggestions are accepted vs. rejected

2. **Implicit Feedback:**
   - Monitor which assignments are modified after generation
   - Track patterns in manual edits
   - Analyze common override scenarios
   - Measure user interaction patterns with AI suggestions

3. **Learning Integration:**
   - Store feedback associated with specific constraint scenarios
   - Update constraint weights based on feedback patterns
   - Refine prompt engineering based on successful generations
   - Adjust optimization priorities based on user behavior

### Integration Strategy

The AI scheduler should complement rather than replace the existing scheduler components:

1. **Relationship with Existing Scheduler:**
   - The AI scheduler should be an optional alternative to the existing rule-based scheduler
   - Users should be able to choose between standard and AI-powered scheduling
   - The same input data and models should be used for both approaches
   - Results from both approaches should be comparable

2. **Shared Components:**
   - Data collection utilities
   - Basic constraint definitions
   - Storage mechanisms for assignments
   - Validation logic for assignments

3. **AI-Specific Extensions:**
   - Enhanced optimization logic
   - Explanation generation
   - Feedback processing
   - Learning mechanisms

4. **UI Integration Points:**
   - Scheduler selection control
   - AI configuration panel
   - Explanation display for assignments
   - Feedback collection interface

## Implementation Plan

1. **Phase 1: Core Algorithm Enhancement**
   - Extend the AISchedulingSettingsSchema
   - Implement comprehensive constraint modeling
   - Enhance data collection to support all required inputs
   - Improve prompt engineering for better AI responses

2. **Phase 2: Optimization and Explanation**
   - Add detailed metrics calculation
   - Implement the explanation API
   - Enhance optimization logic with weights
   - Improve parsing and validation of AI responses

3. **Phase 3: Feedback and Learning**
   - Implement comprehensive feedback collection
   - Develop feedback analysis mechanisms
   - Create a learning system to improve over time
   - Add automated testing against historical schedules

## Acceptance Criteria
- [x] Comprehensive algorithm specification aligned with business requirements
- [x] Clear definition of all constraints and how they'll be handled
- [x] Detailed API specification for implementation
- [x] Implementation approach that leverages existing AI settings
- [x] Feedback mechanism design that enables continuous improvement

## Estimated Effort
3 days

## Notes
- Consider both rule-based and machine learning approaches
- Focus on explainability of the AI-generated schedules
- Ensure the algorithm can handle the scale of the current data (30 employees, 8 shift templates, etc.)