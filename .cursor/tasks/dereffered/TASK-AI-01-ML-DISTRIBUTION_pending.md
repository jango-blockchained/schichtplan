# TASK: Enhancing Distribution Algorithm with Machine Learning

## Objective
Transform the current rule-based distribution algorithm into a hybrid system that incorporates machine learning to optimize employee-to-shift assignments.

## Technical Details

### Current Implementation Analysis
The current distribution algorithm in `src/backend/services/scheduler/distribution.py` uses rule-based logic with methods like:
- `assign_employees_to_shifts()` - Main orchestration
- `assign_employees_by_type()` - Handles different availability types
- `get_available_employees()` - Filters employees based on availability

### ML Enhancement Plan

#### 1. Data Collection & Feature Engineering
- Extract features from historical schedules:
  - Employee shift history (patterns, preferences)
  - Previous assignment success rates
  - Shift-to-employee match scores
  - Constraint violation frequency
  - Time between similar shifts
- Create training dataset structure:
  ```python
  {
    'employee_id': int,
    'shift_id': int,
    'date': date,
    'day_of_week': int,
    'previous_shift': str,
    'consecutive_days_worked': int,
    'days_since_similar_shift': int,
    'historical_preference_score': float,
    'constraint_risk_score': float,
    'was_assigned': bool,  # Target variable
    'manual_adjustment_made': bool
  }
  ```

#### 2. Model Development
- Implement a multi-class classification model predicting optimal employee for each shift
- Potential model options:
  ```python
  from sklearn.ensemble import RandomForestClassifier
  from xgboost import XGBClassifier
  ```
- Cross-validation approach for model evaluation
- Hyperparameter tuning strategy

#### 3. Integration Architecture
- Create `MLDistributionPredictor` class:
  ```python
  class MLDistributionPredictor:
      def __init__(self, model_path=None):
          self.model = self._load_model(model_path)
          
      def predict_assignments(self, date_shifts, available_employees, context_data):
          features = self._extract_features(date_shifts, available_employees, context_data)
          predictions = self.model.predict_proba(features)
          return self._format_predictions(predictions, date_shifts, available_employees)
          
      def _extract_features(self, date_shifts, available_employees, context_data):
          # Feature extraction logic
          
      def _format_predictions(self, predictions, date_shifts, available_employees):
          # Convert predictions to assignment recommendations
  ```

#### 4. Hybrid System Design
- Modify `DistributionManager` to incorporate ML predictions:
  ```python
  def assign_employees_to_shifts(self, date_shifts, context=None):
      # Get ML predictions if model is available
      ml_recommendations = self.ml_predictor.predict_assignments(
          date_shifts, self.available_employees, context
      ) if hasattr(self, 'ml_predictor') else None
      
      # Hybrid assignment logic that combines:
      # 1. ML recommendations (with confidence scores)
      # 2. Existing rule-based logic
      # 3. Constraint checking
  ```

#### 5. Confidence Scoring
- Add confidence score to each assignment:
  ```python
  class Assignment:
      def __init__(self, employee_id, date_shift_id, confidence=None, source=None):
          self.employee_id = employee_id
          self.date_shift_id = date_shift_id
          self.confidence = confidence  # ML prediction confidence
          self.source = source  # 'ml', 'rule', or 'hybrid'
  ```

#### 6. Training Pipeline
- Create training script in `src/backend/tools/scheduler/train_ml_model.py`
- Implement batch prediction for testing
- Add model versioning and storage

## Implementation Steps
1. Create feature extraction module
2. Build initial ML model with historical data
3. Implement prediction integration in distribution
4. Create hybrid assignment logic
5. Add confidence scoring
6. Build training pipeline and versioning
7. Create automated evaluation system

## Evaluation Metrics
- Assignment quality (% of assignments requiring manual adjustment)
- Distribution fairness scores
- Constraint violation reduction
- Processing time comparison

## Dependencies
- Add required ML libraries to requirements.txt:
  ```
  scikit-learn>=1.0.0
  xgboost>=1.5.0
  joblib>=1.1.0
  pandas>=1.3.0
  ```

## Risks & Mitigations
- **Risk**: Insufficient historical data for training
  - **Mitigation**: Start with a hybrid system weighted toward rules
- **Risk**: ML model increases processing time
  - **Mitigation**: Implement caching and pre-computation strategies
- **Risk**: Unpredictable ML assignments confuse users
  - **Mitigation**: Add explainability features