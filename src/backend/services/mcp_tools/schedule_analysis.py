"""
Schedule Analysis Tools for MCP Service
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastmcp import Context

from src.backend.models import Employee, Schedule


class ScheduleAnalysisTools:
    """Tools for analyzing existing schedules and providing insights."""

    def __init__(self, flask_app, logger=None):
        self.flask_app = flask_app
        self.logger = logger or logging.getLogger(__name__)

    def register_tools(self, mcp):
        """Register schedule analysis tools with the MCP service."""

        @mcp.tool()
        async def analyze_partial_schedule(
            ctx: Context,
            start_date: str,
            end_date: str,
            completion_threshold: float = 0.8,
        ) -> Dict[str, Any]:
            """Analyze partially built schedule and suggest next steps for completion.

            Args:
                start_date: Start date for analysis (YYYY-MM-DD)
                end_date: End date for analysis (YYYY-MM-DD)
                completion_threshold: Minimum completion ratio to consider acceptable (0.0-1.0)

            Returns:
                Analysis of partial schedule with completion suggestions
            """
            try:
                with self.flask_app.app_context():
                    schedules = Schedule.query.filter(
                        Schedule.date >= start_date, Schedule.date <= end_date
                    ).all()

                    # Calculate completion metrics
                    start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
                    end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
                    total_days = (end_dt - start_dt).days + 1

                    daily_analysis = {}
                    covered_days = 0

                    current_date = start_dt
                    while current_date <= end_dt:
                        day_schedules = [s for s in schedules if s.date == current_date]
                        is_covered = len(day_schedules) >= 2  # Minimum coverage

                        if is_covered:
                            covered_days += 1

                        daily_analysis[current_date.strftime("%Y-%m-%d")] = {
                            "scheduled_count": len(day_schedules),
                            "is_covered": is_covered,
                            "coverage_gap": max(0, 2 - len(day_schedules)),
                            "employees": [s.employee_id for s in day_schedules],
                        }

                        current_date += timedelta(days=1)

                    completion_ratio = (
                        covered_days / total_days if total_days > 0 else 0
                    )

                    # Generate completion suggestions
                    suggestions = []
                    if completion_ratio < completion_threshold:
                        uncovered_days = [
                            date
                            for date, data in daily_analysis.items()
                            if not data["is_covered"]
                        ]

                        suggestions.append(
                            {
                                "type": "fill_gaps",
                                "priority": "high",
                                "description": f"Fill {len(uncovered_days)} uncovered days",
                                "affected_dates": uncovered_days[:10],
                                "action": "schedule_additional_employees",
                            }
                        )

                    return {
                        "period": {"start_date": start_date, "end_date": end_date},
                        "completion_metrics": {
                            "completion_ratio": round(completion_ratio, 3),
                            "covered_days": covered_days,
                            "total_days": total_days,
                            "meets_threshold": completion_ratio >= completion_threshold,
                        },
                        "daily_analysis": daily_analysis,
                        "suggestions": suggestions,
                        "next_steps": [
                            "Focus on high-priority gaps",
                            "Consider employee availability",
                            "Balance workload distribution",
                        ],
                        "timestamp": datetime.now().isoformat(),
                    }

            except Exception as e:
                self.logger.error(f"Error analyzing partial schedule: {e}")
                return {
                    "error": str(e),
                    "period": {"start_date": start_date, "end_date": end_date},
                    "timestamp": datetime.now().isoformat(),
                }

        @mcp.tool()
        async def suggest_schedule_improvements(
            ctx: Context,
            start_date: str,
            end_date: str,
            focus_areas: Optional[List[str]] = None,
            max_suggestions: int = 10,
        ) -> Dict[str, Any]:
            """Suggest improvements for existing schedule based on analysis.

            Args:
                start_date: Start date for analysis (YYYY-MM-DD)
                end_date: End date for analysis (YYYY-MM-DD)
                focus_areas: Specific areas to focus on ['workload', 'coverage', 'fairness', 'compliance']
                max_suggestions: Maximum number of suggestions to return

            Returns:
                Prioritized list of schedule improvement suggestions
            """
            try:
                with self.flask_app.app_context():
                    if focus_areas is None:
                        focus_areas = ["workload", "coverage", "fairness", "compliance"]

                    schedules = Schedule.query.filter(
                        Schedule.date >= start_date, Schedule.date <= end_date
                    ).all()

                    employees = Employee.query.filter_by(is_active=True).all()

                    suggestions = []

                    # Workload analysis
                    if "workload" in focus_areas:
                        employee_workloads = {}
                        for employee in employees:
                            emp_schedules = [
                                s for s in schedules if s.employee_id == employee.id
                            ]
                            employee_workloads[employee.id] = len(emp_schedules)

                        if employee_workloads:
                            avg_workload = sum(employee_workloads.values()) / len(
                                employee_workloads
                            )
                            overworked = [
                                emp_id
                                for emp_id, count in employee_workloads.items()
                                if count > avg_workload * 1.3
                            ]
                            underworked = [
                                emp_id
                                for emp_id, count in employee_workloads.items()
                                if count < avg_workload * 0.7
                            ]

                            if overworked and underworked:
                                suggestions.append(
                                    {
                                        "type": "balance_workload",
                                        "priority": "medium",
                                        "description": "Rebalance workload between employees",
                                        "overworked_employees": overworked[:3],
                                        "underworked_employees": underworked[:3],
                                        "impact": "Improve fairness and reduce burnout",
                                    }
                                )

                    # Coverage analysis
                    if "coverage" in focus_areas:
                        start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
                        end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()

                        undercovered_days = []
                        current_date = start_dt
                        while current_date <= end_dt:
                            day_schedules = [
                                s for s in schedules if s.date == current_date
                            ]
                            if len(day_schedules) < 2:  # Minimum coverage
                                undercovered_days.append(
                                    current_date.strftime("%Y-%m-%d")
                                )
                            current_date += timedelta(days=1)

                        if undercovered_days:
                            suggestions.append(
                                {
                                    "type": "improve_coverage",
                                    "priority": "high",
                                    "description": f"Improve coverage for {len(undercovered_days)} days",
                                    "affected_dates": undercovered_days[:5],
                                    "impact": "Ensure minimum staffing requirements",
                                }
                            )

                    # Sort suggestions by priority
                    priority_order = {"high": 3, "medium": 2, "low": 1}
                    suggestions.sort(
                        key=lambda x: priority_order.get(x["priority"], 0), reverse=True
                    )

                    return {
                        "period": {"start_date": start_date, "end_date": end_date},
                        "focus_areas": focus_areas,
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
                        },
                        "timestamp": datetime.now().isoformat(),
                    }

            except Exception as e:
                self.logger.error(f"Error generating schedule improvements: {e}")
                return {
                    "error": str(e),
                    "period": {"start_date": start_date, "end_date": end_date},
                    "timestamp": datetime.now().isoformat(),
                }
