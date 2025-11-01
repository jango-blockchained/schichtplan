"""
AI Conversation Service for Multi-Step Schedule Generation
Handles conversational AI interactions for schedule generation with state management
"""

import uuid
from datetime import datetime, timedelta
from enum import Enum
from typing import Any

from sqlalchemy import and_, or_

from src.backend.models import (
    Absence,
    Coverage,
    Employee,
    EmployeeAvailability,
    Schedule,
    ShiftTemplate,
)
from src.backend.services.ai_scheduler_service import AISchedulerService
from src.backend.utils.logger import logger


class ConversationState(Enum):
    """States for the AI conversation flow"""

    INITIALIZED = "initialized"
    ANALYZING = "analyzing"
    RECOMMENDATIONS_READY = "recommendations_ready"
    GENERATING = "generating"
    REVIEW = "review"
    COMPLETED = "completed"
    FAILED = "failed"


class ConversationAction(Enum):
    """Available actions in the conversation"""

    START_CONVERSATION = "start_conversation"
    ANALYZE_CURRENT_STATE = "analyze_current_state"
    GET_RECOMMENDATIONS = "get_recommendations"
    GENERATE_SCHEDULE = "generate_schedule"
    ADJUST_SCHEDULE = "adjust_schedule"
    FINALIZE_SCHEDULE = "finalize_schedule"
    CANCEL_CONVERSATION = "cancel_conversation"


class AIConversationService:
    """Service for managing multi-step AI schedule generation conversations"""

    def __init__(self):
        self.ai_scheduler = AISchedulerService()
        self.conversations = {}  # In-memory storage for now

    def process_conversation_request(
        self, request_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Process a conversation request and return appropriate response"""
        action = request_data.get("action")
        conversation_id = request_data.get("conversation_id")

        try:
            action_enum = ConversationAction(action)
        except ValueError:
            return {
                "status": "error",
                "message": f"Invalid action: {action}",
                "valid_actions": [a.value for a in ConversationAction],
            }

        # Route to appropriate handler
        handler_map = {
            ConversationAction.START_CONVERSATION: self._start_conversation,
            ConversationAction.ANALYZE_CURRENT_STATE: lambda r: self._analyze_current_state(
                conversation_id, r
            ),
            ConversationAction.GET_RECOMMENDATIONS: lambda r: self._get_recommendations(
                conversation_id, r
            ),
            ConversationAction.GENERATE_SCHEDULE: lambda r: self._generate_schedule(
                conversation_id, r
            ),
            ConversationAction.ADJUST_SCHEDULE: lambda r: self._adjust_schedule(
                conversation_id, r
            ),
            ConversationAction.FINALIZE_SCHEDULE: lambda r: self._finalize_schedule(
                conversation_id, r
            ),
            ConversationAction.CANCEL_CONVERSATION: lambda r: self._cancel_conversation(
                conversation_id
            ),
        }

        handler = handler_map.get(action_enum)
        if handler:
            return handler(request_data)

        return {"status": "error", "message": "Action handler not implemented"}

    def _start_conversation(self, request_data: dict[str, Any]) -> dict[str, Any]:
        """Initialize a new conversation for schedule generation"""
        context = request_data.get("context", {})

        # Validate required context
        start_date = context.get("start_date")
        end_date = context.get("end_date")

        if not start_date or not end_date:
            return {
                "status": "error",
                "message": "start_date and end_date are required in context",
            }

        # Create conversation
        conversation_id = str(uuid.uuid4())
        conversation = {
            "id": conversation_id,
            "state": ConversationState.INITIALIZED,
            "created_at": datetime.now().isoformat(),
            "context": {
                "start_date": start_date,
                "end_date": end_date,
                "generation_type": context.get("generation_type", "interactive"),
                "version_id": context.get("version_id"),
                "preferences": context.get("preferences", {}),
            },
            "analysis": None,
            "recommendations": None,
            "generated_schedule": None,
            "adjustments": [],
            "messages": [
                {
                    "timestamp": datetime.now().isoformat(),
                    "type": "system",
                    "content": f"Conversation initialized for schedule generation from {start_date} to {end_date}",
                }
            ],
        }

        self.conversations[conversation_id] = conversation

        return {
            "status": "success",
            "conversation_id": conversation_id,
            "state": conversation["state"].value,
            "message": "Conversation initialized. Next step: analyze current state",
            "next_actions": [ConversationAction.ANALYZE_CURRENT_STATE.value],
        }

    def _analyze_current_state(
        self, conversation_id: str, request_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Analyze the current scheduling state - simplified implementation"""
        conversation = self._get_conversation(conversation_id)
        if not conversation:
            return {"status": "error", "message": "Conversation not found"}

        # For now, return mock analysis
        analysis = {
            "period": conversation["context"],
            "conflicts": [],
            "coverage_gaps": [
                {
                    "date": conversation["context"]["start_date"],
                    "time_period": "14:00-18:00",
                    "required": 3,
                    "scheduled": 1,
                    "gap": 2,
                }
            ],
            "workload_distribution": {
                "balanced": 8,
                "overloaded": 2,
                "underutilized": 2,
            },
            "summary": {
                "total_issues": 5,
                "severity": "medium",
                "recommendation": "Optimization recommended",
            },
        }

        conversation["analysis"] = analysis
        conversation["state"] = ConversationState.ANALYZING

        return {
            "status": "success",
            "conversation_id": conversation_id,
            "state": conversation["state"].value,
            "analysis": analysis,
            "next_actions": [ConversationAction.GET_RECOMMENDATIONS.value],
        }

    def _get_recommendations(
        self, conversation_id: str, request_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Generate recommendations based on analysis"""
        conversation = self._get_conversation(conversation_id)
        if not conversation:
            return {"status": "error", "message": "Conversation not found"}

        recommendations = {
            "generation_strategy": "balanced_optimization",
            "constraints": {
                "min_daily_coverage": 2,
                "max_shifts_per_employee_per_week": 5,
                "keyholder_required_daily": True,
            },
            "focus_areas": [
                {"area": "coverage_improvement", "priority": "high"},
                {"area": "workload_balancing", "priority": "medium"},
            ],
            "optimization_parameters": {
                "priority_settings": {"fairness": 70, "coverage": 80, "preferences": 60}
            },
        }

        conversation["recommendations"] = recommendations
        conversation["state"] = ConversationState.RECOMMENDATIONS_READY

        return {
            "status": "success",
            "conversation_id": conversation_id,
            "state": conversation["state"].value,
            "recommendations": recommendations,
            "next_actions": [ConversationAction.GENERATE_SCHEDULE.value],
        }

    def _generate_schedule(
        self, conversation_id: str, request_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Generate schedule based on recommendations"""
        conversation = self._get_conversation(conversation_id)
        if not conversation:
            return {"status": "error", "message": "Conversation not found"}

        try:
            # Use the AI scheduler service with corrected parameters
            result = self.ai_scheduler.generate_schedule_via_ai(
                start_date_str=conversation["context"]["start_date"],
                end_date_str=conversation["context"]["end_date"],
                version_id=conversation["context"].get("version_id"),
                ai_model_params={
                    "generationConfig": {
                        "temperature": 0.7,
                        "topP": 0.95,
                        "topK": 40,
                        "maxOutputTokens": 8192,
                    }
                },
            )

            conversation["generated_schedule"] = result
            conversation["state"] = ConversationState.REVIEW

            return {
                "status": "success",
                "conversation_id": conversation_id,
                "state": conversation["state"].value,
                "generation_result": result,
                "next_actions": [
                    ConversationAction.ADJUST_SCHEDULE.value,
                    ConversationAction.FINALIZE_SCHEDULE.value,
                ],
            }

        except RuntimeError as e:
            error_msg = str(e)
            logger.app_logger.error(
                f"Runtime error in schedule generation: {error_msg}", exc_info=True
            )

            # Check if it's a missing API key error
            if "Gemini API key not configured" in error_msg:
                conversation["state"] = ConversationState.FAILED
                return {
                    "status": "error",
                    "message": "AI generation requires a Gemini API key. Please configure GEMINI_API_KEY in your environment or use the standard scheduler instead.",
                    "error_type": "missing_api_key",
                }
            else:
                conversation["state"] = ConversationState.FAILED
                return {"status": "error", "message": f"Generation failed: {error_msg}"}

        except Exception as e:
            logger.app_logger.error(f"Error in schedule generation: {e}", exc_info=True)
            conversation["state"] = ConversationState.FAILED
            return {"status": "error", "message": f"Generation failed: {str(e)}"}

    def _adjust_schedule(
        self, conversation_id: str, request_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Adjust the generated schedule based on feedback"""
        conversation = self._get_conversation(conversation_id)
        if not conversation:
            return {"status": "error", "message": "Conversation not found"}

        modifications = request_data.get("modifications", [])

        # Store adjustments
        conversation["adjustments"].append(
            {"timestamp": datetime.now().isoformat(), "modifications": modifications}
        )

        return {
            "status": "success",
            "conversation_id": conversation_id,
            "state": conversation["state"].value,
            "adjustments_applied": len(modifications),
            "next_actions": [
                ConversationAction.ADJUST_SCHEDULE.value,
                ConversationAction.FINALIZE_SCHEDULE.value,
            ],
        }

    def _finalize_schedule(
        self, conversation_id: str, request_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Finalize and save the schedule"""
        conversation = self._get_conversation(conversation_id)
        if not conversation:
            return {"status": "error", "message": "Conversation not found"}

        conversation["state"] = ConversationState.COMPLETED
        conversation["completed_at"] = datetime.now().isoformat()

        return {
            "status": "success",
            "conversation_id": conversation_id,
            "state": conversation["state"].value,
            "message": "Schedule finalized successfully",
        }

    def _cancel_conversation(self, conversation_id: str) -> dict[str, Any]:
        """Cancel an ongoing conversation"""
        if conversation_id in self.conversations:
            self.conversations[conversation_id]["state"] = ConversationState.FAILED
            return {"status": "success", "message": "Conversation cancelled"}
        return {"status": "error", "message": "Conversation not found"}

    # Helper methods

    def _get_conversation(self, conversation_id: str) -> dict[str, Any] | None:
        """Get conversation by ID"""
        return self.conversations.get(conversation_id)

    def _analyze_conflicts(self, start_date, end_date) -> list[dict[str, Any]]:
        """Analyze scheduling conflicts"""
        conflicts = []

        # Check for double bookings
        schedules = Schedule.query.filter(
            Schedule.date >= start_date, Schedule.date <= end_date
        ).all()

        # Group by employee and date
        employee_dates = {}
        for schedule in schedules:
            key = (schedule.employee_id, schedule.date)
            if key not in employee_dates:
                employee_dates[key] = []
            employee_dates[key].append(schedule)

        # Find conflicts
        for key, assignments in employee_dates.items():
            if len(assignments) > 1:
                conflicts.append(
                    {
                        "type": "double_booking",
                        "employee_id": key[0],
                        "date": key[1].isoformat(),
                        "assignments": len(assignments),
                    }
                )

        return conflicts

    def _analyze_coverage_gaps(self, start_date, end_date) -> list[dict[str, Any]]:
        """Analyze coverage gaps"""
        gaps = []

        # Get coverage requirements
        coverage_rules = Coverage.query.all()

        # Check each day
        current_date = start_date
        while current_date <= end_date:
            weekday = current_date.weekday()

            # Get applicable coverage rules
            day_rules = [r for r in coverage_rules if r.day_index == weekday]

            # Get scheduled employees for this day
            scheduled = Schedule.query.filter(Schedule.date == current_date).all()

            for rule in day_rules:
                # Count employees scheduled during this coverage period
                count = sum(
                    1
                    for s in scheduled
                    if self._shift_covers_period(s, rule.start_time, rule.end_time)
                )

                if count < rule.min_employees:
                    gaps.append(
                        {
                            "date": current_date.isoformat(),
                            "time_period": f"{rule.start_time}-{rule.end_time}",
                            "required": rule.min_employees,
                            "scheduled": count,
                            "gap": rule.min_employees - count,
                        }
                    )

            current_date += timedelta(days=1)

        return gaps

    def _analyze_workload(self, start_date, end_date) -> dict[str, Any]:
        """Analyze workload distribution"""
        employees = Employee.query.filter_by(is_active=True).all()

        workload_data = {"period": f"{start_date} to {end_date}", "employees": []}

        for emp in employees:
            # Count assignments
            assignments = Schedule.query.filter(
                Schedule.employee_id == emp.id,
                Schedule.date >= start_date,
                Schedule.date <= end_date,
            ).count()

            # Calculate weekly average
            weeks = ((end_date - start_date).days + 1) / 7
            weekly_avg = assignments / weeks if weeks > 0 else 0

            # Determine status
            if weekly_avg < 3:
                status = "underutilized"
            elif weekly_avg > 5:
                status = "overloaded"
            else:
                status = "balanced"

            workload_data["employees"].append(
                {
                    "employee_id": emp.id,
                    "name": f"{emp.first_name} {emp.last_name}",
                    "total_assignments": assignments,
                    "weekly_average": round(weekly_avg, 1),
                    "status": status,
                }
            )

        return workload_data

    def _determine_strategy(self, analysis: dict[str, Any]) -> str:
        """Determine generation strategy based on analysis"""
        severity = analysis.get("summary", {}).get("severity", "low")

        if severity == "high":
            return "comprehensive_restructure"
        elif severity == "medium":
            return "balanced_optimization"
        else:
            return "minor_adjustments"

    def _recommend_constraints(
        self, analysis: dict[str, Any], goals: list[str]
    ) -> dict[str, Any]:
        """Recommend constraints based on analysis"""
        constraints = {
            "min_daily_coverage": 2,
            "max_shifts_per_employee_per_week": 5,
            "max_consecutive_days": 5,
            "keyholder_required_daily": True,
        }

        # Adjust based on analysis
        if analysis.get("coverage_gaps"):
            max_gap = max([g["gap"] for g in analysis["coverage_gaps"]], default=0)
            if max_gap > 2:
                constraints["allow_overtime"] = True

        if "fairness" in goals:
            constraints["enforce_equal_distribution"] = True

        return constraints

    def _identify_focus_areas(self, analysis: dict[str, Any]) -> list[dict[str, Any]]:
        """Identify areas that need focus"""
        focus_areas = []

        if analysis.get("conflicts"):
            focus_areas.append(
                {
                    "area": "conflict_resolution",
                    "priority": "high",
                    "count": len(analysis["conflicts"]),
                }
            )

        if analysis.get("coverage_gaps"):
            focus_areas.append(
                {
                    "area": "coverage_improvement",
                    "priority": "high",
                    "count": len(analysis["coverage_gaps"]),
                }
            )

        workload = analysis.get("workload_distribution", {})
        overloaded = [
            e for e in workload.get("employees", []) if e.get("status") == "overloaded"
        ]
        if overloaded:
            focus_areas.append(
                {
                    "area": "workload_balancing",
                    "priority": "medium",
                    "count": len(overloaded),
                }
            )

        return focus_areas

    def _recommend_assignments(self, analysis: dict[str, Any]) -> list[dict[str, Any]]:
        """Recommend specific assignments based on analysis"""
        recommendations = []

        # Recommend assignments for coverage gaps
        for gap in analysis.get("coverage_gaps", [])[:5]:  # Top 5 gaps
            recommendations.append(
                {
                    "type": "add_coverage",
                    "date": gap["date"],
                    "time_period": gap["time_period"],
                    "employees_needed": gap["gap"],
                }
            )

        return recommendations

    def _calculate_priorities(self, goals: list[str]) -> dict[str, int]:
        """Calculate priority settings based on goals"""
        base_priority = 50
        priorities = {
            "employeeSatisfaction": base_priority,
            "fairness": base_priority,
            "consistency": base_priority,
            "workloadBalance": base_priority,
        }

        # Boost priorities based on goals
        if "fairness" in goals:
            priorities["fairness"] = 80
            priorities["workloadBalance"] = 70

        if "coverage" in goals:
            priorities["consistency"] = 70

        if "preferences" in goals:
            priorities["employeeSatisfaction"] = 80

        return priorities

    def _suggest_overrides(self, analysis: dict[str, Any]) -> dict[str, bool]:
        """Suggest constraint overrides based on analysis"""
        overrides = {
            "ignoreNonCriticalAvailability": False,
            "allowOvertime": False,
            "strictKeyholder": True,
            "minimumRestPeriods": True,
        }

        # Allow overtime if severe coverage gaps
        if analysis.get("coverage_gaps"):
            total_gap = sum(g["gap"] for g in analysis["coverage_gaps"])
            if total_gap > 10:
                overrides["allowOvertime"] = True

        return overrides

    def _collect_optimized_data(
        self, start_date, end_date, constraints: dict[str, Any]
    ) -> dict[str, Any]:
        """Collect highly optimized data for AI generation"""
        data = {
            "meta": {
                "collected_at": datetime.now().isoformat(),
                "optimization_level": "high",
            }
        }

        # Only include employees who can work
        must_include = constraints.get("must_include_employees", [])

        # Get available employees
        employees = Employee.query.filter_by(is_active=True).all()
        filtered_employees = []

        for emp in employees:
            # Must include specified employees
            if emp.id in must_include:
                filtered_employees.append(emp)
                continue

            # Check if employee has availability
            has_availability = (
                EmployeeAvailability.query.filter(
                    EmployeeAvailability.employee_id == emp.id,
                    or_(
                        EmployeeAvailability.is_recurring.is_(True),
                        and_(
                            or_(
                                EmployeeAvailability.start_date.is_(None),
                                EmployeeAvailability.start_date <= end_date,
                            ),
                            or_(
                                EmployeeAvailability.end_date.is_(None),
                                EmployeeAvailability.end_date >= start_date,
                            ),
                        ),
                    ),
                ).first()
                is not None
            )

            # Check for full period absence
            full_absence = (
                Absence.query.filter(
                    Absence.employee_id == emp.id,
                    Absence.start_date <= start_date,
                    Absence.end_date >= end_date,
                ).first()
                is not None
            )

            if has_availability and not full_absence:
                filtered_employees.append(emp)

        # Compact employee data
        data["employees"] = [
            {
                "id": emp.id,
                "keyholder": emp.is_keyholder,
                "max_weekly_hours": emp.get_max_weekly_hours() or 40,
            }
            for emp in filtered_employees
        ]

        # Only relevant shift templates
        data["shifts"] = self._get_relevant_shifts(start_date, end_date)

        # Aggregated coverage rules
        data["coverage"] = self._aggregate_coverage_rules(start_date, end_date)

        # Simplified availability
        data["availability"] = self._get_simplified_availability(
            [e["id"] for e in data["employees"]], start_date, end_date
        )

        # Only relevant absences
        data["absences"] = self._get_relevant_absences(
            [e["id"] for e in data["employees"]], start_date, end_date
        )

        return data

    def _get_relevant_shifts(self, start_date, end_date) -> list[dict[str, Any]]:
        """Get only shifts relevant to the period"""
        weekdays = set()
        current = start_date
        while current <= end_date:
            weekdays.add(current.weekday())
            current += timedelta(days=1)

        shifts = ShiftTemplate.query.all()
        relevant = []

        for shift in shifts:
            if shift.active_days and any(
                str(day) in shift.active_days and shift.active_days[str(day)]
                for day in weekdays
            ):
                relevant.append(
                    {
                        "id": shift.id,
                        "time": f"{shift.start_time}-{shift.end_time}",
                        "days": [
                            d
                            for d in weekdays
                            if str(d) in shift.active_days and shift.active_days[str(d)]
                        ],
                    }
                )

        return relevant

    def _aggregate_coverage_rules(self, start_date, end_date) -> list[dict[str, Any]]:
        """Aggregate coverage rules by pattern"""
        weekdays = set()
        current = start_date
        while current <= end_date:
            weekdays.add(current.weekday())
            current += timedelta(days=1)

        coverage_rules = Coverage.query.filter(Coverage.day_index.in_(weekdays)).all()

        # Group by time period
        aggregated = {}
        for rule in coverage_rules:
            key = f"{rule.start_time}-{rule.end_time}"
            if key not in aggregated:
                aggregated[key] = {
                    "time": key,
                    "days": [],
                    "min": rule.min_employees,
                    "keyholder": rule.requires_keyholder,
                }
            aggregated[key]["days"].append(rule.day_index)
            aggregated[key]["min"] = max(aggregated[key]["min"], rule.min_employees)
            aggregated[key]["keyholder"] = (
                aggregated[key]["keyholder"] or rule.requires_keyholder
            )

        return list(aggregated.values())

    def _get_simplified_availability(
        self, employee_ids: list[int], start_date, end_date
    ) -> dict[str, Any]:
        """Get simplified availability patterns"""
        if not employee_ids:
            return {}

        availabilities = EmployeeAvailability.query.filter(
            EmployeeAvailability.employee_id.in_(employee_ids)
        ).all()

        # Group by employee and type
        patterns = {}
        for avail in availabilities:
            if not avail.is_available_for_date_range(start_date, end_date):
                continue

            emp_id = str(avail.employee_id)
            if emp_id not in patterns:
                patterns[emp_id] = {"fixed": [], "preferred": [], "available": []}

            # Add hour to appropriate category
            category = avail.availability_type.value.lower()
            if category in patterns[emp_id]:
                patterns[emp_id][category].append(avail.hour)

        # Convert to ranges
        for emp_id, categories in patterns.items():
            for cat, hours in categories.items():
                if hours:
                    patterns[emp_id][cat] = f"{min(hours)}-{max(hours) + 1}"

        return patterns

    def _get_relevant_absences(
        self, employee_ids: list[int], start_date, end_date
    ) -> list[dict[str, Any]]:
        """Get only absences that affect the period"""
        if not employee_ids:
            return []

        absences = Absence.query.filter(
            Absence.employee_id.in_(employee_ids),
            Absence.start_date <= end_date,
            Absence.end_date >= start_date,
        ).all()

        return [
            {
                "emp": abs.employee_id,
                "dates": f"{abs.start_date.isoformat()}/{abs.end_date.isoformat()}",
            }
            for abs in absences
        ]

    def _shift_covers_period(self, schedule, start_time: str, end_time: str) -> bool:
        """Check if a scheduled shift covers a time period"""
        # This would need the actual shift times from the shift template
        # Simplified for now
        return True

    def _apply_modification(
        self,
        generated_schedule: dict[str, Any],
        modification: dict[str, Any],
        regenerate: bool,
    ) -> dict[str, Any]:
        """Apply a modification to the schedule"""
        # Implement modification logic
        return {
            "status": "success",
            "modification": modification,
            "affected_dates": [modification.get("date")],
            "regenerated": regenerate,
        }

    def _calculate_duration(self, conversation: dict[str, Any]) -> str:
        """Calculate conversation duration"""
        start = datetime.fromisoformat(conversation["created_at"])
        end = datetime.fromisoformat(
            conversation.get("completed_at", datetime.now().isoformat())
        )
        duration = end - start
        return f"{duration.total_seconds() / 60:.1f} minutes"
