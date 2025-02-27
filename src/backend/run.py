import os
import socket
import time
from app import create_app
from werkzeug.serving import is_running_from_reloader


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
    app = create_app()
    port = int(os.environ.get("FLASK_PORT", 5000))
    host = os.environ.get("FLASK_HOST", "0.0.0.0")

    # Only try to clean up port if we're not the reloader
    if not is_running_from_reloader():
        try:
            wait_for_port(port, host)
        except TimeoutError as e:
            print(e)
            exit(1)

    app.run(debug=True, host=host, port=port)
