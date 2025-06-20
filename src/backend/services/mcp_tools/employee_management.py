"""
Employee Management Tools for MCP Service
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastmcp import Context

from src.backend.models import Employee, Schedule


class EmployeeManagementTools:
    """Tools for analyzing and managing employee assignments."""

    def __init__(self, flask_app, logger=None):
        self.flask_app = flask_app
        self.logger = logger or logging.getLogger(__name__)

    def register_tools(self, mcp):
        """Register employee management tools with the MCP service."""

        @mcp.tool()
        async def analyze_employee_workload(
            ctx: Context,
            start_date: str,
            end_date: str,
            employee_id: Optional[int] = None,
            include_recommendations: bool = True,
        ) -> Dict[str, Any]:
            """Analyze employee workload distribution and provide recommendations.

            Args:
                start_date: Start date for analysis (YYYY-MM-DD)
                end_date: End date for analysis (YYYY-MM-DD)
                employee_id: Specific employee ID to analyze (optional, analyzes all if not provided)
                include_recommendations: Whether to include optimization recommendations

            Returns:
                Detailed workload analysis with recommendations
            """
            try:
                with self.flask_app.app_context():
                    schedules = Schedule.query.filter(
                        Schedule.date >= start_date, Schedule.date <= end_date
                    ).all()

                    if employee_id:
                        employees = Employee.query.filter_by(
                            id=employee_id, is_active=True
                        ).all()
                    else:
                        employees = Employee.query.filter_by(is_active=True).all()

                    workload_analysis = {}
                    recommendations = []

                    for employee in employees:
                        emp_schedules = [
                            s for s in schedules if s.employee_id == employee.id
                        ]

                        # Calculate workload metrics
                        total_shifts = len(emp_schedules)
                        start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
                        end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
                        total_days = (end_dt - start_dt).days + 1
                        weeks = total_days / 7

                        shifts_per_week = total_shifts / weeks if weeks > 0 else 0

                        # Assess workload level
                        if shifts_per_week > 4:
                            workload_level = "high"
                        elif shifts_per_week > 2:
                            workload_level = "normal"
                        else:
                            workload_level = "low"

                        workload_analysis[employee.id] = {
                            "employee": {
                                "id": employee.id,
                                "name": f"{employee.first_name} {employee.last_name}",
                                "is_keyholder": employee.is_keyholder,
                            },
                            "workload_metrics": {
                                "total_shifts": total_shifts,
                                "shifts_per_week": round(shifts_per_week, 1),
                                "schedule_dates": [
                                    s.date.strftime("%Y-%m-%d") for s in emp_schedules
                                ],
                            },
                            "workload_assessment": {
                                "level": workload_level,
                                "is_overworked": workload_level == "high",
                                "is_underutilized": workload_level == "low",
                            },
                        }  # Generate recommendations if requested
                        if include_recommendations and workload_analysis:
                            overworked = [
                                emp_id
                                for emp_id, data in workload_analysis.items()
                                if data["workload_assessment"]["level"] == "high"
                            ]
                            underworked = [
                                emp_id
                                for emp_id, data in workload_analysis.items()
                                if data["workload_assessment"]["level"] == "low"
                            ]

                        if overworked:
                            recommendations.append(
                                {
                                    "type": "reduce_workload",
                                    "priority": "high",
                                    "description": f"Consider reducing workload for {len(overworked)} employees",
                                    "affected_employees": overworked[:3],
                                    "suggestion": "Redistribute some shifts to other employees",
                                }
                            )

                        if underworked:
                            recommendations.append(
                                {
                                    "type": "increase_utilization",
                                    "priority": "medium",
                                    "description": f"Consider increasing shifts for {len(underworked)} employees",
                                    "affected_employees": underworked[:3],
                                    "suggestion": "Assign additional shifts where needed",
                                }
                            )

                    return {
                        "period": {"start_date": start_date, "end_date": end_date},
                        "analysis_scope": "single_employee"
                        if employee_id
                        else "all_employees",
                        "employee_count": len(workload_analysis),
                        "workload_analysis": workload_analysis,
                        "recommendations": recommendations,
                        "summary": {
                            "avg_shifts_per_week": round(
                                sum(
                                    data["workload_metrics"]["shifts_per_week"]
                                    for data in workload_analysis.values()
                                )
                                / len(workload_analysis),
                                1,
                            )
                            if workload_analysis
                            else 0,
                            "high_workload_employees": len(
                                [
                                    data
                                    for data in workload_analysis.values()
                                    if data["workload_assessment"]["level"] == "high"
                                ]
                            ),
                            "low_workload_employees": len(
                                [
                                    data
                                    for data in workload_analysis.values()
                                    if data["workload_assessment"]["level"] == "low"
                                ]
                            ),
                        },
                        "timestamp": datetime.now().isoformat(),
                    }

            except Exception as e:
                self.logger.error(f"Error analyzing employee workload: {e}")
                return {
                    "error": str(e),
                    "period": {"start_date": start_date, "end_date": end_date},
                    "timestamp": datetime.now().isoformat(),
                }

        @mcp.tool()
        async def suggest_employee_assignments(
            ctx: Context,
            start_date: str,
            end_date: str,
            criteria: Optional[List[str]] = None,
            max_suggestions: int = 10,
        ) -> Dict[str, Any]:
            """Suggest optimal employee assignments for open shifts with reasoning.

            Args:
                start_date: Start date for suggestions (YYYY-MM-DD)
                end_date: End date for suggestions (YYYY-MM-DD)
                criteria: Assignment criteria ['availability', 'skills', 'fairness', 'cost']
                max_suggestions: Maximum number of suggestions to return

            Returns:
                Prioritized assignment suggestions with detailed reasoning
            """
            try:
                with self.flask_app.app_context():
                    if criteria is None:
                        criteria = ["availability", "fairness", "skills"]

                    schedules = Schedule.query.filter(
                        Schedule.date >= start_date, Schedule.date <= end_date
                    ).all()

                    employees = Employee.query.filter_by(is_active=True).all()

                    suggestions = []

                    # Analyze gaps in coverage
                    start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
                    end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
                    current_date = start_dt

                    while current_date <= end_dt and len(suggestions) < max_suggestions:
                        day_schedules = [s for s in schedules if s.date == current_date]
                        scheduled_employees = {s.employee_id for s in day_schedules}

                        # Check if more coverage is needed
                        if len(day_schedules) < 3:  # Target coverage
                            available_employees = [
                                emp
                                for emp in employees
                                if emp.id not in scheduled_employees
                            ]

                            for employee in available_employees[:2]:  # Suggest top 2
                                confidence = 0.8  # Base confidence
                                priority = "medium"

                                # Adjust based on criteria
                                if "fairness" in criteria:
                                    emp_total_shifts = len(
                                        [
                                            s
                                            for s in schedules
                                            if s.employee_id == employee.id
                                        ]
                                    )
                                    if emp_total_shifts < 2:  # Low workload
                                        confidence += 0.1
                                        priority = "high"

                                if employee.is_keyholder:
                                    has_keyholder = any(
                                        s.employee and s.employee.is_keyholder
                                        for s in day_schedules
                                    )
                                    if not has_keyholder:
                                        confidence += 0.15
                                        priority = "high"

                                suggestions.append(
                                    {
                                        "date": current_date.strftime("%Y-%m-%d"),
                                        "employee": {
                                            "id": employee.id,
                                            "name": f"{employee.first_name} {employee.last_name}",
                                            "is_keyholder": employee.is_keyholder,
                                        },
                                        "priority": priority,
                                        "confidence": round(min(confidence, 1.0), 2),
                                        "reasoning": f"Good fit based on {', '.join(criteria)}",
                                        "current_coverage": len(day_schedules),
                                        "target_coverage": 3,
                                    }
                                )

                        current_date += timedelta(days=1)

                    return {
                        "period": {"start_date": start_date, "end_date": end_date},
                        "criteria": criteria,
                        "suggestions": suggestions[:max_suggestions],
                        "summary": {
                            "total_suggestions": len(suggestions),
                            "high_priority": len(
                                [s for s in suggestions if s["priority"] == "high"]
                            ),
                            "medium_priority": len(
                                [s for s in suggestions if s["priority"] == "medium"]
                            ),
                            "low_priority": len(
                                [s for s in suggestions if s["priority"] == "low"]
                            ),
                            "avg_confidence": round(
                                sum(s["confidence"] for s in suggestions)
                                / len(suggestions),
                                2,
                            )
                            if suggestions
                            else 0,
                        },
                        "timestamp": datetime.now().isoformat(),
                    }

            except Exception as e:
                self.logger.error(f"Error suggesting employee assignments: {e}")
                return {
                    "error": str(e),
                    "period": {"start_date": start_date, "end_date": end_date},
                    "timestamp": datetime.now().isoformat(),
                }
