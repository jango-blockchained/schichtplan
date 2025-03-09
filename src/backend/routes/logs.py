from flask import Blueprint, request, jsonify, current_app
from datetime import datetime, timedelta
import json
from typing import List, Dict, Any, Optional, cast

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
        logger = current_app.config["logger"]

        for log in logs:
            if log["level"] == "error":
                logger.error_logger.error(json.dumps(log))
            elif log["level"] == "warning":
                logger.app_logger.warning(json.dumps(log))
            else:
                logger.user_logger.info(json.dumps(log))
        return jsonify({"status": "success"})
    except Exception as e:
        current_app.logger.error(f"Error saving logs: {str(e)}")
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
        logger = current_app.config["logger"]

        def read_log_file(filename: str) -> List[Dict[str, Any]]:
            filepath = logger.logs_dir / filename
            current_app.logger.debug(f"Attempting to read log file: {filepath}")

            if not filepath.exists():
                current_app.logger.warning(f"Log file not found: {filepath}")
                return []

            logs: List[Dict[str, Any]] = []
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    for line in f:
                        try:
                            log_entry = json.loads(line.strip())
                            log_entry["source_file"] = filename
                            logs.append(log_entry)
                        except json.JSONDecodeError:
                            current_app.logger.warning(
                                f"Failed to parse log entry: {line.strip()}"
                            )
                            continue

            except Exception as e:
                current_app.logger.error(f"Error reading log file {filename}: {str(e)}")
                return []

            current_app.logger.debug(
                f"Successfully parsed {len(logs)} entries from {filename}"
            )
            return logs

        # Read logs from each file based on type
        all_logs: List[Dict[str, Any]] = []
        try:
            if log_type in ["all", "user"]:
                user_logs = read_log_file("user_actions.log")
                if level:
                    user_logs = [
                        log
                        for log in user_logs
                        if log.get("level", "").lower() == level.lower()
                    ]
                all_logs.extend(user_logs)

            if log_type in ["all", "error"]:
                error_logs = read_log_file("errors.log")
                if level:
                    error_logs = [
                        log
                        for log in error_logs
                        if log.get("level", "").lower() == level.lower()
                    ]
                all_logs.extend(error_logs)

            if log_type in ["all", "schedule"]:
                schedule_logs = read_log_file("schedule.log")
                if level:
                    schedule_logs = [
                        log
                        for log in schedule_logs
                        if log.get("level", "").lower() == level.lower()
                    ]
                all_logs.extend(schedule_logs)

            # Filter by date and sort
            logs = [
                log
                for log in all_logs
                if log.get("timestamp", "").split(" ")[0] >= start_date
            ]
            logs.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

            # Add debug information
            debug_info = {
                "logs_dir": str(logger.logs_dir),
                "files_found": [f.name for f in logger.logs_dir.glob("*.log")],
                "log_counts": {
                    "total": len(logs),
                    "user": len([l for l in logs if l.get("module") == "user"]),
                    "error": len(
                        [l for l in logs if l.get("level", "").lower() == "error"]
                    ),
                    "schedule": len([l for l in logs if l.get("module") == "schedule"]),
                },
                "raw_counts": {
                    "total": len(all_logs),
                    "filtered": len(logs),
                    "by_file": {
                        "user_actions.log": len(
                            [
                                l
                                for l in all_logs
                                if l.get("source_file") == "user_actions.log"
                            ]
                        ),
                        "errors.log": len(
                            [
                                l
                                for l in all_logs
                                if l.get("source_file") == "errors.log"
                            ]
                        ),
                        "schedule.log": len(
                            [
                                l
                                for l in all_logs
                                if l.get("source_file") == "schedule.log"
                            ]
                        ),
                    },
                },
            }

            current_app.logger.debug(
                f"Returning {len(logs)} logs with debug info: {debug_info}"
            )
            return jsonify({"status": "success", "logs": logs, "debug": debug_info})

        except Exception as e:
            current_app.logger.error(f"Error processing logs: {str(e)}")
            return jsonify(
                {
                    "status": "error",
                    "message": f"Error processing logs: {str(e)}",
                    "debug": {
                        "logs_dir": str(logger.logs_dir),
                        "files_found": [f.name for f in logger.logs_dir.glob("*.log")],
                        "error": str(e),
                    },
                }
            ), 500

    except Exception as e:
        current_app.logger.error(f"Error retrieving logs: {str(e)}")
        return jsonify(
            {"status": "error", "message": str(e), "debug": {"error": str(e)}}
        ), 500


@bp.route("/logs/stats", methods=["GET"])
def get_log_stats():
    """Get log statistics"""
    try:
        days = int(request.args.get("days", 7))
        start_date = datetime.now() - timedelta(days=days)
        logger = current_app.config["logger"]

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
            filepath = logger.logs_dir / filename
            current_app.logger.debug(f"Processing log file for stats: {filepath}")

            if not filepath.exists():
                current_app.logger.warning(f"Log file not found for stats: {filepath}")
                continue

            try:
                with open(filepath, "r", encoding="utf-8", errors="replace") as f:
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

                                # Track recent errors
                                if log.get("level") == "error":
                                    stats["recent_errors"].append(log)

                        except (json.JSONDecodeError, KeyError) as e:
                            current_app.logger.warning(
                                f"Failed to parse log entry in {filename}: {str(e)}"
                            )
                            continue

            except Exception as e:
                current_app.logger.error(
                    f"Error processing log file {filename}: {str(e)}"
                )
                continue

        # Sort and limit recent errors
        stats["recent_errors"].sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        stats["recent_errors"] = stats["recent_errors"][:10]  # Keep only 10 most recent

        return jsonify({"status": "success", "stats": stats})

    except Exception as e:
        current_app.logger.error(f"Error retrieving log stats: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@bp.route("/logs/clear", methods=["POST"])
def clear_logs():
    """Clear all log files"""
    try:
        logger = current_app.config["logger"]
        log_files = ["user_actions.log", "errors.log", "schedule.log"]
        cleared_files = []

        for filename in log_files:
            filepath = logger.logs_dir / filename
            if filepath.exists():
                # Open the file in write mode to clear its contents
                with open(filepath, "w") as f:
                    pass  # Just open and close to clear the file
                cleared_files.append(filename)
                logger.app_logger.info(f"Cleared log file: {filename}")

        # Log that logs were cleared (this will be the first entry in the cleared error log)
        logger.error_logger.info("All logs were cleared by admin request")

        return jsonify(
            {
                "status": "success",
                "message": "Logs cleared successfully",
                "cleared_files": cleared_files,
            }
        )
    except Exception as e:
        current_app.logger.error(f"Error clearing logs: {str(e)}")
        return jsonify(
            {"status": "error", "message": f"Error clearing logs: {str(e)}"}
        ), 500
