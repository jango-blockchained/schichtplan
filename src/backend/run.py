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
if str(current_dir) not in sys.path:
    sys.path.append(str(current_dir))

from app import create_app
from werkzeug.serving import is_running_from_reloader


def get_process_on_port(port):
    """Return process ID using the given port."""
    try:
        result = subprocess.run(
            ["lsof", "-i", f":{port}", "-t"], capture_output=True, text=True
        )
        if result.stdout:
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
    parser = argparse.ArgumentParser(description="Run the Schichtplan backend server")
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("FLASK_PORT", 5000)),
        help="Port to run the server on",
    )
    parser.add_argument(
        "--host",
        type=str,
        default=os.environ.get("FLASK_HOST", "0.0.0.0"),
        help="Host to bind the server to",
    )
    parser.add_argument(
        "--kill", action="store_true", help="Kill any process using the specified port"
    )
    parser.add_argument(
        "--auto-port",
        action="store_true",
        help="Automatically find a free port if the specified port is in use",
    )
    args = parser.parse_args()

    port = args.port
    host = args.host

    # Only try to clean up port if we're not the reloader
    if not is_running_from_reloader():
        try:
            # Check if port is in use
            if get_process_on_port(port):
                if args.kill:
                    # Try to kill the process
                    if not kill_process_on_port(port):
                        print(f"Failed to kill process on port {port}")
                        if not args.auto_port:
                            exit(1)
                elif args.auto_port:
                    # Try to find a free port
                    try:
                        new_port = find_free_port(port)
                        if new_port != port:
                            print(
                                f"Port {port} is in use, using port {new_port} instead"
                            )
                            port = new_port
                    except RuntimeError as e:
                        print(e)
                        exit(1)
                else:
                    # Wait for port to become available
                    try:
                        wait_for_port(port, host)
                    except TimeoutError as e:
                        print(e)
                        print("\nTry one of the following options:")
                        print(
                            f"1. Kill the process using port {port}: python run.py --kill"
                        )
                        print("2. Use a different port: python run.py --port 5001")
                        print(
                            "3. Automatically find a free port: python run.py --auto-port"
                        )
                        exit(1)
        except Exception as e:
            print(f"Error checking port: {e}")
            exit(1)

    app, socketio = create_app()
    print(f"Starting server on {host}:{port}")
    socketio.run(app, debug=True, host=host, port=port)
