# TASK: Implementing Preference Learning from Manual Adjustments

## Objective
Create a system that learns from user's manual schedule adjustments to improve future generated schedules by capturing implicit preferences and patterns.

## Technical Details

### Current State Analysis
Currently, the system does not capture or learn from manual adjustments made to generated schedules. Each generation is independent of previous user modifications.

### Preference Learning System Design

#### 1. Manual Adjustment Capture
- Create event tracking system for schedule modifications:
  ```typescript
  // Frontend tracking in ScheduleTable component
  const trackManualAdjustment = (
    originalAssignment: Assignment,
    newAssignment: Assignment,
    reason?: string
  ) => {
    api.schedules.trackAdjustment({
      originalEmployeeId: originalAssignment.employeeId,
      newEmployeeId: newAssignment.employeeId,
      dateShiftId: originalAssignment.dateShiftId,
      date: originalAssignment.date,
      shiftId: originalAssignment.shiftId,
      reason,
      timestamp: new Date().toISOString(),
      userId: currentUser.id
    });
  };
  ```

- Backend API endpoint for capturing adjustments:
  ```python
  @bp.route('/schedules/adjustments/track', methods=['POST'])
  def track_adjustment():
      data = request.json
      adjustment = ScheduleAdjustment(
          original_employee_id=data['originalEmployeeId'],
          new_employee_id=data['newEmployeeId'],
          date_shift_id=data['dateShiftId'],
          date=data['date'],
          shift_id=data['shiftId'],
          reason=data.get('reason'),
          timestamp=data['timestamp'],
          user_id=data['userId']
      )
      db.session.add(adjustment)
      db.session.commit()
      # Trigger async preference learning update
      process_new_adjustment.delay(adjustment.id)
      return jsonify({'status': 'success'})
  ```

#### 2. Database Schema for Adjustments
- New model for tracking adjustments:
  ```python
  class ScheduleAdjustment(db.Model):
      __tablename__ = 'schedule_adjustments'
      
      id = db.Column(db.Integer, primary_key=True)
      original_employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'))
      new_employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'))
      date_shift_id = db.Column(db.Integer, db.ForeignKey('date_shifts.id'))
      date = db.Column(db.Date)
      shift_id = db.Column(db.Integer, db.ForeignKey('shift_templates.id'))
      reason = db.Column(db.String(255), nullable=True)
      timestamp = db.Column(db.DateTime)
      user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
      
      # Relationships
      original_employee = db.relationship('Employee', foreign_keys=[original_employee_id])
      new_employee = db.relationship('Employee', foreign_keys=[new_employee_id])
      date_shift = db.relationship('DateShift')
      shift = db.relationship('ShiftTemplate')
  ```

- New model for learned preferences:
  ```python
  class EmployeePreference(db.Model):
      __tablename__ = 'employee_preferences'
      
      id = db.Column(db.Integer, primary_key=True)
      employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'))
      shift_id = db.Column(db.Integer, db.ForeignKey('shift_templates.id'))
      day_of_week = db.Column(db.Integer)  # 0-6 for Monday-Sunday
      preference_score = db.Column(db.Float)  # 0.0 to 1.0
      confidence = db.Column(db.Float)  # 0.0 to 1.0
      last_updated = db.Column(db.DateTime)
      
      # Composite unique constraint
      __table_args__ = (
          db.UniqueConstraint('employee_id', 'shift_id', 'day_of_week'),
      )
  ```

#### 3. Preference Learning Algorithm
- Create learning service in `src/backend/services/preferences/`:
  ```python
  class PreferenceLearner:
      def __init__(self, db_session):
          self.db = db_session
          
      def process_adjustment(self, adjustment_id):
          """Process a single adjustment and update preferences"""
          adjustment = self.db.query(ScheduleAdjustment).get(adjustment_id)
          
          # Negative feedback for original assignment
          self._update_preference(
              adjustment.original_employee_id,
              adjustment.shift_id,
              adjustment.date.weekday(),
              negative=True
          )
          
          # Positive feedback for new assignment
          self._update_preference(
              adjustment.new_employee_id,
              adjustment.shift_id,
              adjustment.date.weekday(),
              negative=False
          )
          
      def _update_preference(self, employee_id, shift_id, day_of_week, negative=False):
          """Update preference scores using exponential decay model"""
          preference = self.db.query(EmployeePreference).filter_by(
              employee_id=employee_id,
              shift_id=shift_id,
              day_of_week=day_of_week
          ).first()
          
          if not preference:
              preference = EmployeePreference(
                  employee_id=employee_id,
                  shift_id=shift_id,
                  day_of_week=day_of_week,
                  preference_score=0.5,  # Initial neutral score
                  confidence=0.1,  # Low initial confidence
                  last_updated=datetime.now()
              )
              self.db.add(preference)
          
          # Update score using exponential decay model
          learning_rate = 0.2 * preference.confidence  # Adapt learning rate based on confidence
          direction = -1 if negative else 1
          preference.preference_score += direction * learning_rate
          
          # Clamp values
          preference.preference_score = max(0.0, min(1.0, preference.preference_score))
          
          # Increase confidence with each observation
          preference.confidence = min(0.9, preference.confidence + 0.05)
          preference.last_updated = datetime.now()
          
          self.db.commit()
  ```

#### 4. Integration with Distribution Algorithm
- Modify `get_available_employees()` in distribution.py to consider learned preferences:
  ```python
  def get_available_employees(self, date_shift, availability_type=None):
      """Get available employees, sorted by learned preference if available"""
      available_employees = super().get_available_employees(date_shift, availability_type)
      
      if not available_employees:
          return []
      
      # Get preference scores for these employees
      day_of_week = date_shift.date.weekday()
      preferences = self.db.query(EmployeePreference).filter(
          EmployeePreference.employee_id.in_([e.id for e in available_employees]),
          EmployeePreference.shift_id == date_shift.shift_id,
          EmployeePreference.day_of_week == day_of_week
      ).all()
      
      # Create lookup table of preference scores
      pref_map = {p.employee_id: p.preference_score for p in preferences}
      
      # Sort employees by preference score (if available) then by standard criteria
      return sorted(
          available_employees,
          key=lambda e: (-pref_map.get(e.id, 0.5), self._get_employee_priority(e))
      )
  ```

#### 5. Feedback UI Elements
- Add components to show learning in progress:
  ```typescript
  const PreferenceIndicator: React.FC<{employeeId: number, shiftId: number, date: string}> = 
    ({employeeId, shiftId, date}) => {
      const [preferenceData, setPreferenceData] = useState<{score: number, confidence: number} | null>(null);
      
      useEffect(() => {
        // Fetch preference data
        api.preferences.getScore(employeeId, shiftId, new Date(date).getDay())
          .then(data => setPreferenceData(data));
      }, [employeeId, shiftId, date]);
      
      if (!preferenceData) return null;
      
      return (
        <Tooltip content={`Preference: ${(preferenceData.score * 100).toFixed(0)}% (Confidence: ${(preferenceData.confidence * 100).toFixed(0)}%)`}>
          <div className="preference-indicator">
            <div 
              className="preference-bar"
              style={{
                width: `${preferenceData.score * 100}%`,
                opacity: preferenceData.confidence
              }}
            />
          </div>
        </Tooltip>
      );
    };
  ```

## Implementation Steps
1. Create database models for adjustments and preferences
2. Implement adjustment tracking in frontend and backend
3. Build preference learning algorithm
4. Integrate preferences into distribution algorithm
5. Add preference visualization in UI
6. Create preference management dashboard
7. Implement forgotten preference decay

## Evaluation Metrics
- Reduction in manual adjustments over time
- Preference prediction accuracy
- User satisfaction with automated assignments
- System adaptability to changing preferences

## Dependencies
- No additional libraries required beyond existing stack

## Risks & Mitigations
- **Risk**: Overfitting to specific patterns
  - **Mitigation**: Implement confidence decay over time
- **Risk**: Conflicting preferences between users
  - **Mitigation**: Track preferences by user and implement reconciliation logic
- **Risk**: Performance impact from complex queries
  - **Mitigation**: Cache preference scores during generation process