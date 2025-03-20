"""
Eventlet initialization module.
This needs to be imported first before any other modules to ensure proper monkey patching.
"""

import eventlet

eventlet.monkey_patch()
print("Eventlet monkey patching completed")
