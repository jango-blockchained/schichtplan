#!/usr/bin/env python
import os
import socket
import time
import sys
import signal
import argparse
import random
import subprocess
from pathlib import Path
import click

# Function to check and activate virtualenv
def ensure_virtualenv():
    """Make sure we're running in the virtualenv with all dependencies."""
    venv_path = Path(__file__).resolve().parent / '.venv'
    if not venv_path.exists():
        print(f"Virtual environment not found at {venv_path}")
        return False
    
    # Check if we're already in a virtualenv
    if os.environ.get('VIRTUAL_ENV'):
        print(f"Already in virtualenv: {os.environ.get('VIRTUAL_ENV')}")
        return True
    
    # Determine the activate script based on shell
    activate_script = venv_path / 'bin' / 'activate'
    if not activate_script.exists():
        print(f"Activate script not found at {activate_script}")
        return False
    
    print(f"Activating virtualenv at {venv_path}")
    # We can't directly source in Python, so we'll run a new Python process with the virtualenv activated
    cmd = f"source {activate_script} && exec python3 {' '.join(sys.argv)}"
    os.execvp('bash', ['bash', '-c', cmd])
    # If we get here, the exec failed
    return False

# Check virtualenv first if not running in a virtualenv already
if not os.environ.get('VIRTUAL_ENV') and __name__ == '__main__':
    ensure_virtualenv()

# Add the current directory to the Python path
current_dir = Path(__file__).resolve().parent
if str(current_dir) not in sys.path:
    sys.path.append(str(current_dir))

# Add the parent directory (src/backend) to Python path
src_backend_dir = os.path.abspath(os.path.join(current_dir, ".."))
if str(src_backend_dir) not in sys.path:
    sys.path.append(str(src_backend_dir))

# Change from relative import to absolute import
from src.backend.app import create_app
from src.backend.config import Config

from werkzeug.serving import is_running_from_reloader

# Attempt to load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

# Determine the environment
env = os.environ.get('FLASK_ENV', 'development')

# Configure the app based on the environment
if env == 'production':
    # Use a ProductionConfig class if defined, or just the base Config
    # from src.backend.config import ProductionConfig as CurrentConfig
    CurrentConfig = Config # Using base Config for now
elif env == 'testing':
    # from src.backend.config import TestingConfig as CurrentConfig
    CurrentConfig = Config # Using base Config for now
else: # development or other
    CurrentConfig = Config

app = create_app(CurrentConfig)

# Explicitly push an application context for startup tasks
with app.app_context():
    # Any startup code that requires app context (like resource loading)
    # can be placed or triggered here.
    # For now, just ensuring the context is pushed before running the app.
    print(f"Debug: App context pushed in run.py for app ID {id(app)}")

# Use Click to define a command group for the app
@click.group()
def cli():
    "A command line interface for the Schichtplan application."
    pass

# Integrate Flask-Migrate commands
# No need to manually add migrate commands if using Migrate(app, db) directly

# Example custom command (optional)
@cli.command()
@click.option('--port', default=5000, type=int, help='Port to listen on.')
@click.option('--debug', is_flag=True, help='Enable debug mode.')
def runserver(port, debug):
    "Run the Flask development server."
    app.run(debug=debug, port=port)

# Add the default runserver command if __name__ == '__main__'
if __name__ == '__main__':
    # The app context is already pushed above, 
    # so startup code requiring context will run before cli().
    # We can still call cli() to enable command line interface, 
    # but the main startup logic for resource loading etc. 
    # benefits from the context pushed before cli().
    
    # If you prefer running with 'flask run', remove this __main__ block 
    # and use 'export FLASK_APP=run.py && flask run'.
    # If you use 'flask run', Flask handles context pushing.
    # Since we are running run.py directly, we push context manually.
    
    # Check if we are running with gunicorn or similar production server
    # This check might be needed if resource loading during startup is only problematic 
    # in development server scenarios run directly via run.py
    # import sys
    # if 'gunicorn' not in sys.argv[0]:
    #     with app.app_context():
    #         # Startup tasks for development server run
    #         pass # Resource loading should happen naturally during imports/init

    # Running via click's cli() will handle command parsing, 
    # including the runserver command defined above.
    # The app context pushed above is available for any code that runs 
    # as a result of imports before cli() or within commands if they don't manage their own context.
    
    # For typical Flask development server run via 'python run.py', 
    # resource loading might happen when modules are imported. 
    # Pushing the context here should cover that.
    cli() # This will run the click CLI, including the runserver command

# If running with gunicorn or other WSGI server, they will import 'app'
# and should handle the application context for requests.
# The explicit push above handles context for code running at import time of run.py

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


def kill_port_with_npx(port):
    """Kill the process using the given port with npx kill-port."""
    try:
        print(f"Killing port {port} with npx kill-port...")
        result = subprocess.run(["npx", "-y", "kill-port", str(port)], capture_output=True, text=True, timeout=30)
        print(result.stdout)
        if result.returncode == 0:
            time.sleep(1)
            return True
        else:
            print(f"npx kill-port failed: {result.stderr}")
            return False
    except Exception as e:
        print(f"Error running npx kill-port: {e}")
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
            # Check if port is in use (skip lsof, just kill if --kill)
            if args.kill:
                if not kill_port_with_npx(port):
                    print(f"Failed to kill process on port {port} with npx kill-port")
                    if not args.auto_port:
                        exit(1)
            # Optionally, add auto-port logic here if needed
        except Exception as e:
            print(f"Error checking port: {e}")
            exit(1)

    print(">>> Before create_app()")
    app = create_app()
    print(">>> After create_app()")
    print(f"Starting server on {host}:{port}")
    app.run(debug=True, host=host, port=port)
    print(">>> After app.run()")
