from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
import json
import os
from utils.logger import logger

bp = Blueprint('logs', __name__)

@bp.route('/api/logs', methods=['POST'])
def save_logs():
    """Save logs from frontend"""
    try:
        logs = request.json.get('logs', [])
        for log in logs:
            if log['level'] == 'error':
                logger.error_logger.error(json.dumps(log))
            elif log['level'] == 'warning':
                logger.app_logger.warning(json.dumps(log))
            else:
                logger.user_logger.info(json.dumps(log))
        return jsonify({'status': 'success'})
    except Exception as e:
        logger.error_logger.error(f"Error saving logs: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@bp.route('/api/logs', methods=['GET'])
def get_logs():
    """Get logs with filtering"""
    try:
        log_type = request.args.get('type', 'all')  # all, user, error, schedule
        days = int(request.args.get('days', 7))
        level = request.args.get('level', None)  # info, warning, error, debug
        
        logs = []
        start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
        
        def read_log_file(filename):
            if not os.path.exists(filename):
                return []
            
            with open(filename, 'r') as f:
                return [json.loads(line) for line in f if line.strip()]
        
        if log_type in ['all', 'user']:
            user_logs = read_log_file('logs/user_actions.log')
            if level:
                user_logs = [log for log in user_logs if log.get('level') == level]
            logs.extend(user_logs)
            
        if log_type in ['all', 'error']:
            error_logs = read_log_file('logs/errors.log')
            logs.extend(error_logs)
            
        if log_type in ['all', 'schedule']:
            schedule_logs = read_log_file('logs/schedule.log')
            if level:
                schedule_logs = [log for log in schedule_logs if log.get('level') == level]
            logs.extend(schedule_logs)
            
        # Filter by date and sort
        logs = [
            log for log in logs 
            if log.get('timestamp', '').split('T')[0] >= start_date
        ]
        logs.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        
        return jsonify({
            'status': 'success',
            'logs': logs
        })
        
    except Exception as e:
        logger.error_logger.error(f"Error retrieving logs: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@bp.route('/api/logs/stats', methods=['GET'])
def get_log_stats():
    """Get log statistics"""
    try:
        days = int(request.args.get('days', 7))
        start_date = datetime.now() - timedelta(days=days)
        
        stats = {
            'total_logs': 0,
            'errors': 0,
            'warnings': 0,
            'user_actions': 0,
            'schedule_operations': 0,
            'by_date': {},
            'by_module': {},
            'by_action': {},
            'recent_errors': []
        }
        
        # Read all log files
        log_files = {
            'user': 'logs/user_actions.log',
            'error': 'logs/errors.log',
            'schedule': 'logs/schedule.log'
        }
        
        for log_type, filename in log_files.items():
            if not os.path.exists(filename):
                continue
                
            with open(filename, 'r') as f:
                for line in f:
                    try:
                        log = json.loads(line.strip())
                        log_date = datetime.fromisoformat(log['timestamp'].replace('Z', '+00:00'))
                        
                        if log_date >= start_date:
                            stats['total_logs'] += 1
                            
                            # Count by level
                            if log.get('level') == 'error':
                                stats['errors'] += 1
                            elif log.get('level') == 'warning':
                                stats['warnings'] += 1
                                
                            # Count by type
                            if log_type == 'user':
                                stats['user_actions'] += 1
                            elif log_type == 'schedule':
                                stats['schedule_operations'] += 1
                                
                            # Group by date
                            date_key = log_date.strftime('%Y-%m-%d')
                            stats['by_date'][date_key] = stats['by_date'].get(date_key, 0) + 1
                            
                            # Group by module
                            if 'module' in log:
                                stats['by_module'][log['module']] = stats['by_module'].get(log['module'], 0) + 1
                                
                            # Group by action
                            if 'action' in log:
                                stats['by_action'][log['action']] = stats['by_action'].get(log['action'], 0) + 1
                                
                            # Collect recent errors
                            if log.get('level') == 'error' and len(stats['recent_errors']) < 10:
                                stats['recent_errors'].append(log)
                                
                    except json.JSONDecodeError:
                        continue
        
        # Sort recent errors by timestamp
        stats['recent_errors'].sort(key=lambda x: x['timestamp'], reverse=True)
        
        return jsonify({
            'status': 'success',
            'stats': stats
        })
        
    except Exception as e:
        logger.error_logger.error(f"Error retrieving log stats: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500 