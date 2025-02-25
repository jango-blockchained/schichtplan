import os
from src.backend.app import create_app
from werkzeug.serving import is_running_from_reloader

if __name__ == '__main__':
    app = create_app()
    # Only try to clean up port if we're not the reloader
    if not is_running_from_reloader():
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            # Try to bind to the port
            sock.bind(('0.0.0.0', 5000))
            sock.close()
        except OSError:
            # Port is in use, wait a moment and try again
            print("Port 5000 is in use, waiting for it to be available...")
            import time
            time.sleep(2)
    
    app.run(debug=True, host='0.0.0.0', port=5000) 