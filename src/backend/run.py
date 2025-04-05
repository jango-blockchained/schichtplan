import os
import socket
import time
import signal
import argparse
import random
import subprocess
import sys

# Add the parent directory to the path for relative imports
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(os.path.dirname(current_dir))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

# Try module-first approach
try:
    from src.backend.app import create_app
except ImportError:
    # Fall back to direct import for standalone use
    try:
        from app import create_app
    except ImportError:
        # Last resort for when run as a script
        print("ERROR: Cannot import app. Please run as module with:")
        print("python -m src.backend.run")
        print("Or with PYTHONPATH set:")
        print("PYTHONPATH=/path/to/schichtplan python src/backend/run.py")
        sys.exit(1)

from werkzeug.serving import is_running_from_reloader


def get_process_on_port(port):
    """Return process ID using the given port."""
    try:
        result = subprocess.run(
            ["lsof", "-i", f":{port}", "-t"], 
            # Capture output, don't check exit code
            capture_output=True, text=True, check=False 
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
            # Shortened message
            raise TimeoutError(f"Port {port} unavailable after {timeout}s") 

        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            sock.bind((host, port))
            sock.close()
            return  # Port is available
        except OSError:
            print(f"Port {port} is in use, waiting...")
            time.sleep(2)
        finally:
            sock.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Run the Schichtplan backend server" # Shortened line
    )
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
        "--kill", action="store_true", 
        help="Kill process using the specified port" # Shortened line
    )
    parser.add_argument(
        "--auto-port",
        action="store_true",
        help="Automatically find free port if specified port is in use",
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
                        # Shortened line
                        print(f"Failed kill on port {port}") 
                        if not args.auto_port:
                            exit(1)
                elif args.auto_port:
                    # Try to find a free port
                    try:
                        new_port = find_free_port(port)
                        if new_port != port:
                            print(
                                f"Port {port} is in use, "
                                f"using port {new_port} instead"
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
                            f"1. Kill process on port {port}: "
                            f"python -m src.backend.run --kill"
                        )
                        print(
                            "2. Use different port: "
                            "python -m src.backend.run --port 5001"
                        )
                        print(
                            "3. Auto find free port: "
                            "python -m src.backend.run --auto-port"
                        )
                        exit(1)
        except Exception as e:
            print(f"Error checking port: {e}")
            exit(1)

    app = create_app()
    print(f"Starting server on {host}:{port}")
    app.run(debug=True, host=host, port=port)
