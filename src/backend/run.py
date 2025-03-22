# Import eventlet initialization first
try:
    from src.backend.eventlet_init import eventlet
except ImportError:
    try:
        import eventlet

        eventlet.monkey_patch()
        print(
            "Warning: Using fallback eventlet import. This may cause issues if not imported before other modules."
        )
    except ImportError:
        print(
            "Warning: eventlet_init.py not found. This may cause issues with the server."
        )

import os
import socket
import time
import sys
import signal
import argparse
import random
import subprocess
from pathlib import Path

# Add the current directory to the Python path
current_dir = Path(__file__).resolve().parent
parent_dir = current_dir.parent.parent  # Add parent directory to access modules
if str(current_dir) not in sys.path:
    sys.path.append(str(current_dir))
if str(parent_dir) not in sys.path:
    sys.path.append(str(parent_dir))

# Use absolute imports
from src.backend.app import create_app


def get_process_on_port(port):
    """Return process ID using the given port."""
    try:
        result = subprocess.run(
            ["lsof", "-i", f":{port}", "-t"], capture_output=True, text=True
        )
        if result.returncode == 0:
            return int(result.stdout.strip())
    except (subprocess.SubprocessError, ValueError):
        pass
    return None


def kill_process_on_port(port):
    """Kill the process using the given port."""
    pid = get_process_on_port(port)
    if pid:
        try:
            print(f"Killing process {pid} using port {port}")
            os.kill(pid, signal.SIGKILL)
            time.sleep(1)  # Give it time to die
            return True
        except OSError as e:
            print(f"Error killing process {pid}: {e}")
    return False


def find_free_port(start_port, max_attempts=10):
    """Find a free port starting from start_port."""
    port = start_port
    attempts = 0

    while attempts < max_attempts:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            sock.bind(("0.0.0.0", port))
            sock.close()
            return port  # Found a free port
        except OSError:
            attempts += 1
            port = random.randint(5001, 8000)  # Try a random port
        finally:
            sock.close()

    raise RuntimeError(f"Could not find a free port after {max_attempts} attempts")


def wait_for_port(port, host="0.0.0.0", timeout=30):
    start_time = time.time()
    while True:
        if time.time() - start_time > timeout:
            raise TimeoutError(
                f"Port {port} did not become available within {timeout} seconds"
            )

        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            sock.bind((host, port))
            sock.close()
            return  # Port is available
        except OSError:
            print(f"Port {port} is in use, waiting for it to be available...")
            time.sleep(2)
        finally:
            sock.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the Flask application")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to")
    parser.add_argument("--port", type=int, default=5000, help="Port to bind to")
    parser.add_argument("--debug", action="store_true", help="Enable debug mode")
    parser.add_argument(
        "--kill", action="store_true", help="Kill any process using the specified port"
    )
    parser.add_argument(
        "--auto-port",
        action="store_true",
        help="Automatically find a free port if the specified port is in use",
    )
    args = parser.parse_args()

    # Handle port conflicts
    if args.kill and get_process_on_port(args.port):
        kill_process_on_port(args.port)
    elif args.auto_port and get_process_on_port(args.port):
        args.port = find_free_port(args.port)

    # Wait for port to be available
    wait_for_port(args.port, args.host)

    # Create the Flask app with SocketIO
    app = create_app()

    # Run the app with eventlet's WSGI server
    print(f"Starting socketio server on {args.host}:{args.port}")
    eventlet.wsgi.server(
        eventlet.listen((args.host, args.port)),
        app.wsgi_app,
        debug=args.debug,
    )
