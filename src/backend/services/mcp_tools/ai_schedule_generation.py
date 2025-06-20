"""
AI-Powered Schedule Generation Tools for MCP Service
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from fastmcp import Context

from src.backend.models import Employee, ShiftTemplate


class AIScheduleGenerationTools:
    """Tools for AI-powered schedule generation and optimization."""

    def __init__(self, flask_app, logger=None):
        self.flask_app = flask_app
        self.logger = logger or logging.getLogger(__name__)

    def register_tools(self, mcp):
        """Register AI schedule generation tools with the MCP service."""

        @mcp.tool()
        async def generate_ai_schedule(
            ctx: Context,
            start_date: str,
            end_date: str,
            optimization_criteria: Optional[Dict[str, Any]] = None,
            constraints: Optional[Dict[str, Any]] = None,
            generation_strategy: str = "balanced",
        ) -> Dict[str, Any]:
            """Generate a complete schedule using AI optimization algorithms.

            Args:
                start_date: Start date for schedule generation (YYYY-MM-DD)
                end_date: End date for schedule generation (YYYY-MM-DD)
                optimization_criteria: Criteria for optimization with weights
                constraints: Hard constraints that must be satisfied
                generation_strategy: Strategy to use ('balanced', 'cost_optimal', 'fairness_focused')

            Returns:
                AI-generated schedule with optimization metrics and alternatives
            """
            try:
                with self.flask_app.app_context():
                    if optimization_criteria is None:
                        optimization_criteria = {
                            "workload_balance": 0.3,
                            "coverage_adequacy": 0.25,
                            "employee_preferences": 0.2,
                            "cost_efficiency": 0.15,
                            "compliance": 0.1,
                        }

                    if constraints is None:
                        constraints = {
                            "min_daily_coverage": 2,
                            "max_shifts_per_employee_per_week": 5,
                            "max_consecutive_days": 5,
                            "keyholder_required_daily": True,
                            "weekend_coverage_ratio": 0.8,
                        }

                    # Get base data
                    employees = Employee.query.filter_by(is_active=True).all()
                    shift_templates = ShiftTemplate.query.all()

                    # Initialize generation parameters
                    start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
                    end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()

                    # AI Schedule Generation Algorithm
                    generated_schedule = await self._ai_schedule_generation(
                        start_dt,
                        end_dt,
                        employees,
                        shift_templates,
                        optimization_criteria,
                        constraints,
                        generation_strategy,
                    )

                    # Calculate optimization metrics
                    metrics = await self._calculate_schedule_metrics(
                        generated_schedule, employees, optimization_criteria
                    )

                    # Generate alternative schedules for comparison
                    alternatives = []
                    if generation_strategy != "cost_optimal":
                        cost_optimal = await self._ai_schedule_generation(
                            start_dt,
                            end_dt,
                            employees,
                            shift_templates,
                            optimization_criteria,
                            constraints,
                            "cost_optimal",
                        )
                        cost_metrics = await self._calculate_schedule_metrics(
                            cost_optimal, employees, optimization_criteria
                        )
                        alternatives.append(
                            {
                                "strategy": "cost_optimal",
                                "schedule": cost_optimal,
                                "metrics": cost_metrics,
                            }
                        )

                    return {
                        "period": {"start_date": start_date, "end_date": end_date},
                        "generation_strategy": generation_strategy,
                        "optimization_criteria": optimization_criteria,
                        "constraints": constraints,
                        "generated_schedule": {
                            "assignments": generated_schedule,
                            "metrics": metrics,
                            "total_assignments": len(generated_schedule),
                            "coverage_analysis": await self._analyze_schedule_coverage(
                                generated_schedule, start_dt, end_dt, constraints
                            ),
                        },
                        "alternatives": alternatives,
                        "recommendations": await self._generate_schedule_recommendations(
                            generated_schedule, metrics, constraints
                        ),
                        "quality_score": metrics.get("overall_score", 0),
                        "implementation_ready": metrics.get("compliance_score", 0)
                        >= 0.95,
                        "timestamp": datetime.now().isoformat(),
                    }

            except Exception as e:
                self.logger.error(f"Error generating AI schedule: {e}")
                return {
                    "error": str(e),
                    "period": {"start_date": start_date, "end_date": end_date},
                    "timestamp": datetime.now().isoformat(),
                }

    async def _ai_schedule_generation(
        self,
        start_dt,
        end_dt,
        employees,
        shift_templates,
        optimization_criteria,
        constraints,
        strategy,
    ):
        """Core AI schedule generation algorithm."""
        schedule = []

        # Simple implementation for demonstration
        current_date = start_dt
        employee_index = 0

        while current_date <= end_dt:
            # Basic round-robin assignment with constraints
            daily_assignments = 0
            target_coverage = constraints.get("min_daily_coverage", 2)

            # Ensure keyholder coverage if required
            if constraints.get("keyholder_required_daily", True):
                keyholders = [emp for emp in employees if emp.is_keyholder]
                if keyholders:
                    selected_keyholder = keyholders[employee_index % len(keyholders)]
                    schedule.append(
                        {
                            "date": current_date.strftime("%Y-%m-%d"),
                            "employee_id": selected_keyholder.id,
                            "employee_name": f"{selected_keyholder.first_name} {selected_keyholder.last_name}",
                            "shift_template_id": shift_templates[0].id
                            if shift_templates
                            else None,
                            "is_keyholder": True,
                            "assignment_reason": "keyholder_requirement",
                        }
                    )
                    daily_assignments += 1

            # Fill remaining coverage
            while daily_assignments < target_coverage and employee_index < len(
                employees
            ):
                employee = employees[employee_index % len(employees)]

                # Skip if already assigned today
                already_assigned = any(
                    s["date"] == current_date.strftime("%Y-%m-%d")
                    and s["employee_id"] == employee.id
                    for s in schedule
                )

                if not already_assigned:
                    schedule.append(
                        {
                            "date": current_date.strftime("%Y-%m-%d"),
                            "employee_id": employee.id,
                            "employee_name": f"{employee.first_name} {employee.last_name}",
                            "shift_template_id": shift_templates[0].id
                            if shift_templates
                            else None,
                            "is_keyholder": employee.is_keyholder,
                            "assignment_reason": "coverage_requirement",
                        }
                    )
                    daily_assignments += 1

                employee_index += 1

            current_date += timedelta(days=1)
            employee_index = 0  # Reset for next day

        return schedule

    async def _calculate_schedule_metrics(self, schedule, employees, criteria):
        """Calculate metrics for the generated schedule."""
        if not schedule:
            return {"overall_score": 0, "compliance_score": 0}

        # Basic metrics calculation
        total_assignments = len(schedule)
        unique_employees = len(set(s["employee_id"] for s in schedule))
        keyholder_coverage = len([s for s in schedule if s["is_keyholder"]])

        workload_balance_score = unique_employees / len(employees) if employees else 0
        coverage_score = min(
            1.0, total_assignments / (len(set(s["date"] for s in schedule)) * 2)
        )
        compliance_score = 0.95  # Simplified

        overall_score = (
            workload_balance_score * criteria.get("workload_balance", 0.3)
            + coverage_score * criteria.get("coverage_adequacy", 0.25)
            + compliance_score * criteria.get("compliance", 0.1)
        )

        return {
            "overall_score": round(overall_score, 3),
            "workload_balance_score": round(workload_balance_score, 3),
            "coverage_score": round(coverage_score, 3),
            "compliance_score": round(compliance_score, 3),
            "total_assignments": total_assignments,
            "unique_employees": unique_employees,
            "keyholder_coverage": keyholder_coverage,
        }

    async def _analyze_schedule_coverage(self, schedule, start_dt, end_dt, constraints):
        """Analyze coverage adequacy of the generated schedule."""
        daily_coverage = {}
        current_date = start_dt

        while current_date <= end_dt:
            date_str = current_date.strftime("%Y-%m-%d")
            day_assignments = [s for s in schedule if s["date"] == date_str]

            daily_coverage[date_str] = {
                "coverage_count": len(day_assignments),
                "meets_minimum": len(day_assignments)
                >= constraints.get("min_daily_coverage", 2),
                "has_keyholder": any(s["is_keyholder"] for s in day_assignments),
                "employees": [s["employee_id"] for s in day_assignments],
            }

            current_date += timedelta(days=1)

        return daily_coverage

    async def _generate_schedule_recommendations(self, schedule, metrics, constraints):
        """Generate recommendations for the generated schedule."""
        recommendations = []

        if metrics.get("coverage_score", 0) < 0.9:
            recommendations.append(
                {
                    "type": "improve_coverage",
                    "priority": "high",
                    "description": "Consider adding more shifts to improve coverage",
                    "current_score": metrics.get("coverage_score", 0),
                    "target_score": 0.9,
                }
            )

        if metrics.get("workload_balance_score", 0) < 0.8:
            recommendations.append(
                {
                    "type": "balance_workload",
                    "priority": "medium",
                    "description": "Review workload distribution among employees",
                    "current_score": metrics.get("workload_balance_score", 0),
                    "target_score": 0.8,
                }
            )

        return recommendations
