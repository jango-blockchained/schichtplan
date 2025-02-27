from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
import json
import os
from typing import List, Dict, Any, Optional, cast
from utils.logger import logger, ROOT_DIR

bp = Blueprint("logs", __name__)


@bp.route("/logs", methods=["POST"])
def save_logs():
    """Save logs from frontend"""
    try:
        if not request.is_json:
            return jsonify(
                {"status": "error", "message": "Content-Type must be application/json"}
            ), 400

        request_data = cast(Dict[str, Any], request.json)
        logs = request_data.get("logs", [])

        for log in logs:
            if log["level"] == "error":
                logger.error_logger.error(json.dumps(log))
            elif log["level"] == "warning":
                logger.app_logger.warning(json.dumps(log))
            else:
                logger.user_logger.info(json.dumps(log))
        return jsonify({"status": "success"})
    except Exception as e:
        logger.error_logger.error(f"Error saving logs: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@bp.route("/logs", methods=["GET"])
def get_logs():
    """Get logs with filtering"""
    try:
        log_type: str = request.args.get("type", "all")  # all, user, error, schedule
        days: int = int(request.args.get("days", "7"))
        level: Optional[str] = request.args.get("level")  # info, warning, error, debug

        logs: List[Dict[str, Any]] = []
        start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

        def read_log_file(filename: str) -> List[Dict[str, Any]]:
            filepath = ROOT_DIR / "logs" / filename
            if not filepath.exists():
                logger.error_logger.warning(f"Log file not found: {filepath}")
                return []

            logs: List[Dict[str, Any]] = []
            current_log: List[str] = []

            with open(filepath, "r") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue

                    if line.startswith("{"):
                        # Start of a new log entry
                        if current_log:
                            try:
                                logs.append(json.loads("".join(current_log)))
                            except json.JSONDecodeError as e:
                                logger.error_logger.warning(
                                    f"Failed to parse log entry: {e}"
                                )
                        current_log = [line]
                    else:
                        # Continuation of current log entry
                        current_log.append(line)

                # Don't forget to process the last log entry
                if current_log:
                    try:
                        logs.append(json.loads("".join(current_log)))
                    except json.JSONDecodeError as e:
                        logger.error_logger.warning(
                            f"Failed to parse last log entry: {e}"
                        )

            return logs

        if log_type in ["all", "user"]:
            user_logs = read_log_file("user_actions.log")
            if level:
                user_logs = [log for log in user_logs if log.get("level") == level]
            logs.extend(user_logs)

        if log_type in ["all", "error"]:
            error_logs = read_log_file("errors.log")
            if level:  # Also filter error logs by level if specified
                error_logs = [log for log in error_logs if log.get("level") == level]
            logs.extend(error_logs)

        if log_type in ["all", "schedule"]:
            schedule_logs = read_log_file("schedule.log")
            if level:
                schedule_logs = [
                    log for log in schedule_logs if log.get("level") == level
                ]
            logs.extend(schedule_logs)

        # Filter by date and sort
        logs = [
            log for log in logs if log.get("timestamp", "").split("T")[0] >= start_date
        ]
        logs.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

        # Add debug information in development
        debug_info = {
            "logs_dir": str(ROOT_DIR / "logs"),
            "files_found": [f.name for f in (ROOT_DIR / "logs").glob("*.log")],
            "log_counts": {
                "total": len(logs),
                "user": len([l for l in logs if l.get("module") == "user"]),
                "error": len([l for l in logs if l.get("level") == "error"]),
                "schedule": len([l for l in logs if l.get("module") == "schedule"]),
            },
        }

        return jsonify({"status": "success", "logs": logs, "debug": debug_info})

    except Exception as e:
        logger.error_logger.error(f"Error retrieving logs: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@bp.route("/logs/stats", methods=["GET"])
def get_log_stats():
    """Get log statistics"""
    try:
        days = int(request.args.get("days", 7))
        start_date = datetime.now() - timedelta(days=days)

        stats = {
            "total_logs": 0,
            "errors": 0,
            "warnings": 0,
            "user_actions": 0,
            "schedule_operations": 0,
            "by_date": {},
            "by_module": {},
            "by_action": {},
            "recent_errors": [],
        }

        # Read all log files
        log_files = {
            "user": "user_actions.log",
            "error": "errors.log",
            "schedule": "schedule.log",
        }

        for log_type, filename in log_files.items():
            if not os.path.exists(filename):
                continue

            with open(filename, "r") as f:
                for line in f:
                    try:
                        log = json.loads(line.strip())
                        log_date = datetime.fromisoformat(
                            log["timestamp"].replace("Z", "+00:00")
                        )

                        if log_date >= start_date:
                            stats["total_logs"] += 1

                            # Count by level
                            if log.get("level") == "error":
                                stats["errors"] += 1
                            elif log.get("level") == "warning":
                                stats["warnings"] += 1

                            # Count by type
                            if log_type == "user":
                                stats["user_actions"] += 1
                            elif log_type == "schedule":
                                stats["schedule_operations"] += 1

                            # Group by date
                            date_key = log_date.strftime("%Y-%m-%d")
                            stats["by_date"][date_key] = (
                                stats["by_date"].get(date_key, 0) + 1
                            )

                            # Group by module
                            if "module" in log:
                                stats["by_module"][log["module"]] = (
                                    stats["by_module"].get(log["module"], 0) + 1
                                )

                            # Group by action
                            if "action" in log:
                                stats["by_action"][log["action"]] = (
                                    stats["by_action"].get(log["action"], 0) + 1
                                )

                            # Collect recent errors
                            if (
                                log.get("level") == "error"
                                and len(stats["recent_errors"]) < 10
                            ):
                                stats["recent_errors"].append(log)

                    except json.JSONDecodeError:
                        continue

        # Sort recent errors by timestamp
        stats["recent_errors"].sort(key=lambda x: x["timestamp"], reverse=True)

        return jsonify({"status": "success", "stats": stats})

    except Exception as e:
        logger.error_logger.error(f"Error retrieving log stats: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500
