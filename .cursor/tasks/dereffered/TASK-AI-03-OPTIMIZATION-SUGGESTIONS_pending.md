# TASK: Adding AI-Powered Optimization Suggestions for Existing Schedules

## Objective
Implement an intelligent system that analyzes existing schedules, identifies optimization opportunities, and provides actionable suggestions to improve schedule quality.

## Technical Details

### Current State Analysis
Currently, once a schedule is generated, the system does not offer suggestions for improving it. Manual adjustments are made without guidance on potential optimization opportunities.

### Optimization Suggestion System Design

#### 1. Schedule Quality Metrics Framework
- Implement comprehensive schedule quality evaluation:
  ```python
  class ScheduleQualityEvaluator:
      def __init__(self, db_session):
          self.db = db_session
          
      def evaluate_schedule(self, version_id, date_range=None):
          """Evaluate a schedule version and return quality metrics"""
          assignments = self._get_assignments(version_id, date_range)
          
          metrics = {
              'overall_score': 0,
              'metrics': {
                  'employee_satisfaction': self._calculate_employee_satisfaction(assignments),
                  'workload_distribution': self._calculate_workload_distribution(assignments),
                  'constraint_violations': self._calculate_constraint_violations(assignments),
                  'preference_alignment': self._calculate_preference_alignment(assignments),
                  'coverage_fulfillment': self._calculate_coverage_fulfillment(assignments),
                  'skill_utilization': self._calculate_skill_utilization(assignments),
                  'sequence_quality': self._calculate_sequence_quality(assignments)
              }
          }
          
          # Calculate weighted overall score
          weights = {
              'employee_satisfaction': 0.2,
              'workload_distribution': 0.15,
              'constraint_violations': 0.25,
              'preference_alignment': 0.15,
              'coverage_fulfillment': 0.15,
              'skill_utilization': 0.05,
              'sequence_quality': 0.05
          }
          
          metrics['overall_score'] = sum(
              score * weights[metric_name] 
              for metric_name, score in metrics['metrics'].items()
          )
          
          return metrics
      
      def _calculate_employee_satisfaction(self, assignments):
          # Calculate based on preference alignment, fair distribution, etc.
          
      def _calculate_workload_distribution(self, assignments):
          # Calculate standard deviation of shift counts, etc.
          
      def _calculate_constraint_violations(self, assignments):
          # Check for rule violations
          
      def _calculate_preference_alignment(self, assignments):
          # Compare against learned preferences
          
      def _calculate_coverage_fulfillment(self, assignments):
          # Check coverage requirements fulfillment
          
      def _calculate_skill_utilization(self, assignments):
          # Evaluate optimal skill usage
          
      def _calculate_sequence_quality(self, assignments):
          # Analyze shift sequences for optimal patterns
  ```

#### 2. Suggestion Generation Algorithm
- Implement suggestion generator service:
  ```python
  class OptimizationSuggestionGenerator:
      def __init__(self, db_session, quality_evaluator):
          self.db = db_session
          self.evaluator = quality_evaluator
          
      def generate_suggestions(self, version_id, date_range=None, limit=10):
          """Generate optimization suggestions for a schedule version"""
          assignments = self._get_assignments(version_id, date_range)
          metrics = self.evaluator.evaluate_schedule(version_id, date_range)
          
          suggestions = []
          
          # Generate different types of suggestions
          if metrics['metrics']['workload_distribution'] < 0.7:
              suggestions.extend(self._generate_workload_suggestions(assignments))
              
          if metrics['metrics']['constraint_violations'] < 0.9:
              suggestions.extend(self._generate_constraint_suggestions(assignments))
              
          if metrics['metrics']['preference_alignment'] < 0.8:
              suggestions.extend(self._generate_preference_suggestions(assignments))
              
          if metrics['metrics']['coverage_fulfillment'] < 0.9:
              suggestions.extend(self._generate_coverage_suggestions(assignments))
          
          # Sort by impact and limit
          suggestions.sort(key=lambda x: x['impact_score'], reverse=True)
          return suggestions[:limit]
      
      def _generate_workload_suggestions(self, assignments):
          """Generate suggestions to balance workload"""
          suggestions = []
          
          # Find overloaded employees
          employee_counts = Counter([a.employee_id for a in assignments])
          avg_count = sum(employee_counts.values()) / len(employee_counts)
          
          overloaded = [
              (emp_id, count) for emp_id, count in employee_counts.items()
              if count > avg_count * 1.2
          ]
          
          underloaded = [
              (emp_id, count) for emp_id, count in employee_counts.items()
              if count < avg_count * 0.8
          ]
          
          # Generate swap suggestions
          for over_id, over_count in overloaded:
              for under_id, under_count in underloaded:
                  swaps = self._find_potential_swaps(assignments, over_id, under_id)
                  
                  for swap in swaps:
                      suggestions.append({
                          'type': 'workload_balancing',
                          'action': 'swap',
                          'source': swap[0],  # Assignment for overloaded employee
                          'target': swap[1],  # Proposed date/shift for underloaded employee
                          'description': f"Move shift from {over_id} to {under_id} to balance workload",
                          'impact_score': ((over_count - avg_count) / avg_count) * 0.8,
                          'before': {'overloaded': over_count, 'underloaded': under_count},
                          'after': {'overloaded': over_count - 1, 'underloaded': under_count + 1}
                      })
          
          return suggestions
          
      def _generate_constraint_suggestions(self, assignments):
          """Generate suggestions to fix constraint violations"""
          # Implementation for constraint-based suggestions
          
      def _generate_preference_suggestions(self, assignments):
          """Generate suggestions based on learned preferences"""
          # Implementation for preference-based suggestions
          
      def _generate_coverage_suggestions(self, assignments):
          """Generate suggestions to improve coverage fulfillment"""
          # Implementation for coverage-based suggestions
  ```

#### 3. Backend API Endpoints
- Create API endpoints for suggestions:
  ```python
  @bp.route('/ai/schedule/suggestions', methods=['GET'])
  def get_schedule_suggestions():
      version_id = request.args.get('version_id', type=int)
      start_date = request.args.get('start_date')
      end_date = request.args.get('end_date')
      limit = request.args.get('limit', 10, type=int)
      
      if not version_id:
          return jsonify({'error': 'Version ID is required'}), 400
          
      date_range = None
      if start_date and end_date:
          date_range = (datetime.strptime(start_date, '%Y-%m-%d').date(),
                        datetime.strptime(end_date, '%Y-%m-%d').date())
      
      evaluator = ScheduleQualityEvaluator(db.session)
      generator = OptimizationSuggestionGenerator(db.session, evaluator)
      
      suggestions = generator.generate_suggestions(version_id, date_range, limit)
      metrics = evaluator.evaluate_schedule(version_id, date_range)
      
      return jsonify({
          'suggestions': suggestions,
          'metrics': metrics
      })
  
  @bp.route('/ai/schedule/apply-suggestion', methods=['POST'])
  def apply_suggestion():
      data = request.json
      suggestion_id = data.get('suggestion_id')
      
      # Apply the suggestion and create a new version
      # Implementation details...
      
      return jsonify({'status': 'success', 'new_version_id': new_version_id})
  ```

#### 4. Frontend UI Components
- Create schedule quality dashboard component:
  ```typescript
  const ScheduleQualityDashboard: React.FC<{versionId: number}> = ({versionId}) => {
    const [metrics, setMetrics] = useState<ScheduleMetrics | null>(null);
    
    useEffect(() => {
      api.schedules.getQualityMetrics(versionId).then(setMetrics);
    }, [versionId]);
    
    if (!metrics) return <Spinner />;
    
    return (
      <Card>
        <CardHeader>
          <CardTitle>Schedule Quality Score: {(metrics.overall_score * 100).toFixed(1)}%</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="metrics-grid">
            {Object.entries(metrics.metrics).map(([key, value]) => (
              <MetricCard 
                key={key}
                name={formatMetricName(key)}
                value={value} 
                color={getMetricColor(value)}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };
  ```

- Create optimization suggestions component:
  ```typescript
  const OptimizationSuggestions: React.FC<{versionId: number}> = ({versionId}) => {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    const loadSuggestions = () => {
      setIsLoading(true);
      api.schedules.getSuggestions(versionId)
        .then(data => {
          setSuggestions(data.suggestions);
          setIsLoading(false);
        })
        .catch(err => {
          console.error(err);
          setIsLoading(false);
        });
    };
    
    useEffect(() => {
      loadSuggestions();
    }, [versionId]);
    
    const applySuggestion = async (suggestionId: string) => {
      await api.schedules.applySuggestion(suggestionId);
      // Handle version update/reload
    };
    
    return (
      <Card>
        <CardHeader>
          <CardTitle>Optimization Suggestions</CardTitle>
          <CardDescription>
            AI-powered suggestions to improve your schedule
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Spinner />
          ) : suggestions.length === 0 ? (
            <EmptyState message="No optimization suggestions available" />
          ) : (
            <ul className="space-y-3">
              {suggestions.map(suggestion => (
                <SuggestionItem
                  key={suggestion.id}
                  suggestion={suggestion}
                  onApply={() => applySuggestion(suggestion.id)}
                />
              ))}
            </ul>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={loadSuggestions} variant="outline">
            Refresh Suggestions
          </Button>
        </CardFooter>
      </Card>
    );
  };
  
  const SuggestionItem: React.FC<{
    suggestion: Suggestion;
    onApply: () => void;
  }> = ({suggestion, onApply}) => {
    return (
      <li className="suggestion-item">
        <div className="flex items-center gap-3">
          <div className="suggestion-impact" 
               style={{background: getImpactColor(suggestion.impact_score)}} />
          <div className="flex-1">
            <h4 className="font-medium">{suggestion.description}</h4>
            <p className="text-sm text-muted-foreground">
              Impact: {(suggestion.impact_score * 100).toFixed(1)}%
            </p>
          </div>
          <Button onClick={onApply} size="sm">Apply</Button>
        </div>
      </li>
    );
  };
  ```

## Implementation Steps
1. Implement schedule quality evaluation framework
2. Create metrics calculation for different quality aspects
3. Build suggestion generation algorithms by category
4. Implement backend API endpoints
5. Create frontend components for displaying metrics
6. Implement suggestion display and application UI
7. Add automated suggestion testing and validation

## Evaluation Metrics
- Suggestion application rate (% of suggestions accepted)
- Quality improvement after applying suggestions
- Reduction in manual edits after applying suggestions
- User satisfaction with suggestion relevance

## Dependencies
- No additional libraries required beyond existing stack

## Risks & Mitigations
- **Risk**: Poor quality suggestions could reduce user trust
  - **Mitigation**: Implement suggestion impact simulation and validation
- **Risk**: Performance impact from complex suggestion generation
  - **Mitigation**: Implement background processing and caching
- **Risk**: Suggestions may conflict with business rules
  - **Mitigation**: Add business rule validation to suggestion pipeline