#!/usr/bin/env python3
"""
Schichtplan Development Manager - Professional TUI
A Textual-based terminal UI for managing all development services.
"""

import asyncio
import os
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Optional

import psutil
from textual import on
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import (
    Container,
    Horizontal,
    ScrollableContainer,
    VerticalScroll,
)
from textual.widgets import (
    Button,
    DataTable,
    Footer,
    Header,
    Input,
    Label,
    Log,
    Static,
    Switch,
    TabbedContent,
    TabPane,
)


class ServiceStatus:
    """Track service status and metadata"""

    def __init__(
        self,
        name: str,
        port: int,
        command: list[str],
        cwd: Path = None,
        requires_env: bool = False,
    ):
        self.name = name
        self.port = port
        self.command = command
        self.cwd = cwd or Path.cwd()
        self.requires_env = requires_env  # If True, check .env before starting
        self.process: subprocess.Popen | None = None
        self.pid: int | None = None
        self.status = "STOPPED"
        self.start_time: datetime | None = None
        self.cpu_percent = 0.0
        self.memory_mb = 0.0
        # Performance optimizations: cache results
        self._last_health_check: Optional[datetime] = None
        self._cached_health_status: str = "Unknown"
        self._cached_response_time: str = "N/A"


class ServiceCard(Static):
    """Widget to display service status and controls"""

    DEFAULT_CSS = """
    ServiceCard {
        height: auto;
        border: solid $primary;
        background: $surface;
        padding: 1 2;
        margin: 1;
    }
    
    ServiceCard.running {
        border: solid $success;
        background: $success 10%;
    }
    
    ServiceCard.stopped {
        border: solid $error;
        background: $error 10%;
    }
    
    ServiceCard.starting {
        border: solid $warning;
        background: $warning 10%;
    }
    
    ServiceCard .service-name {
        color: $text;
        text-style: bold;
        content-align: center middle;
    }
    
    ServiceCard .service-port {
        color: $accent;
    }
    """

    def __init__(self, service: ServiceStatus, **kwargs):
        super().__init__(**kwargs)
        self.service = service

    def compose(self) -> ComposeResult:
        yield Label(f"🚀 {self.service.name}", classes="service-name")
        yield Label(f"🔌 Port: {self.service.port}", classes="service-port")

        # Status with emoji indicator
        status_emoji = (
            "⭕"
            if self.service.status == "STOPPED"
            else "🟢"
            if self.service.status == "RUNNING"
            else "🟡"
        )
        yield Label(
            f"{status_emoji} Status: {self.service.status}",
            id=f"status-{self.id.replace('card-', '')}",
        )

        with Horizontal(classes="service-actions"):
            service_id = self.id.replace("card-", "")
            yield Button("▶️ Start", id=f"start-{service_id}", variant="success")
            yield Button("⏹️ Stop", id=f"stop-{service_id}", variant="error")
            yield Button("🔄 Restart", id=f"restart-{service_id}", variant="primary")

    def update_status(self, status: str):
        """Update the status label with colorful emoji"""
        self.service.status = status
        # Get service_id from card ID
        service_id = self.id.replace("card-", "")
        status_label = self.query_one(f"#status-{service_id}", Label)

        # Colorful status emojis
        if status == "RUNNING":
            status_emoji = "🟢"
        elif status == "STOPPED":
            status_emoji = "⭕"
        elif status == "STARTING":
            status_emoji = "🟡"
        else:
            status_emoji = "❓"

        status_label.update(f"{status_emoji} Status: {status}")

        # Update CSS class based on status
        self.remove_class("running", "stopped", "starting")
        if status == "RUNNING":
            self.add_class("running")
        elif status == "STOPPED":
            self.add_class("stopped")
        else:
            self.add_class("starting")


class DevManagerApp(App):
    """Main Textual application for development management"""

    CSS = """
    /* Services Container */
    #services-container {
        height: auto;
        width: 100%;
        background: $surface;
    }
    
    .service-grid {
        layout: grid;
        grid-size: 2;
        grid-gutter: 1;
        padding: 1;
    }
    
    /* Search Input */
    #service-search {
        margin: 1 2;
        width: 100%;
    }
    
    /* Log Viewer with colorful border */
    #log-viewer {
        height: 1fr;
        border: solid $success;
        background: $surface;
        padding: 1;
        scrollbar-gutter: stable;
    }
    
    /* Health Table */
    #health-table {
        height: 1fr;
        background: $surface;
    }
    
    /* Stats Table with accent */
    #stats-table {
        height: 1fr;
        background: $surface;
    }
    
    /* Config Panel */
    .config-title {
        text-style: bold;
        padding: 1 2;
        color: $primary;
    }
    
    .config-section {
        padding: 1 2;
        margin: 1 0;
        border: solid $primary;
        background: $surface;
    }
    
    .config-label {
        padding: 0 0 1 0;
        text-style: bold;
    }
    
    #monitor-interval-input {
        width: 20;
        margin: 1 0;
    }
    
    DataTable {
        background: $surface;
    }
    
    DataTable > .datatable--header {
        background: $primary;
        color: $text;
        text-style: bold;
    }
    
    DataTable > .datatable--cursor {
        background: $secondary;
    }
    
    .service-actions {
        height: auto;
        align: center middle;
    }
    
    Button {
        margin: 0 1;
    }
    
    Button.success {
        background: $success;
    }
    
    Button.error {
        background: $error;
    }
    
    Button.primary {
        background: $primary;
    }
    
    Button.default {
        margin: 1 0;
    }
    
    /* Tabs styling */
    TabbedContent {
        background: $surface;
    }
    
    Tabs {
        background: $panel;
    }
    
    Tab {
        background: $panel;
    }
    
    Tab.-active {
        background: $primary;
        color: $text;
        text-style: bold;
    }
    
    /* Footer with accent */
    Footer {
        background: $panel;
    }
    
    Footer > .footer--key {
        background: $primary;
    }
    """

    TITLE = "🚀 Schichtplan Development Manager"
    SUB_TITLE = "Professional Service Management TUI"

    BINDINGS = [
        Binding("q", "quit", "Quit", priority=True),
        Binding("r", "restart_all", "Restart All"),
        Binding("s", "stop_all", "Stop All"),
        Binding("a", "start_all", "Start All"),
        Binding("l", "show_logs", "Logs"),
        Binding("h", "show_health", "Health"),
        Binding("c", "show_config", "Config"),
        Binding("f", "focus_search", "Search", show=False),
        Binding("ctrl+c", "quit", "Force Quit", show=False),
    ]

    def __init__(self):
        super().__init__()
        self.project_root = Path(__file__).parent
        self.venv_python = self.project_root / "src/backend/.venv/bin/python"

        # Define services
        self.services: dict[str, ServiceStatus] = {
            "backend": ServiceStatus(
                name="Backend",
                port=5000,
                command=[str(self.venv_python), "-m", "src.backend.run", "runserver"],
                cwd=self.project_root,
            ),
            "frontend": ServiceStatus(
                name="Frontend",
                port=5173,
                command=["bun", "dev"],
                cwd=self.project_root / "src/frontend",
            ),
            "mcp": ServiceStatus(
                name="MCP Server",
                port=8001,
                command=[
                    str(self.venv_python),
                    "src/backend/mcp_server.py",
                    "--transport",
                    "sse",
                    "--port",
                    "8001",
                ],
                cwd=self.project_root,
            ),
            "conversational_ai": ServiceStatus(
                name="Conversational AI",
                port=8002,
                command=[
                    str(self.venv_python),
                    "start_conversational_ai.py",
                    "--transport",
                    "sse",
                    "--port",
                    "8002",
                ],
                cwd=self.project_root,
            ),
            "telegram_bot": ServiceStatus(
                name="Telegram Bot",
                port=0,  # No port listening, it's a polling/webhook service
                command=[
                    str(self.venv_python),
                    "start_telegram_bot.py",
                ],
                cwd=self.project_root,
                requires_env=True,  # Requires TELEGRAM_BOT_TOKEN in .env
            ),
        }

        self.service_cards: dict[str, ServiceCard] = {}
        self.monitoring_task: asyncio.Task | None = None
        self.log_reading_task: asyncio.Task | None = None
        
        # Performance optimization: cache and debouncing
        self._service_filter: str = ""
        self._last_monitor_update: datetime = datetime.now()
        self._monitor_interval: float = 10.0  # Increased from 5s to reduce CPU usage

    def compose(self) -> ComposeResult:
        """Create child widgets"""
        yield Header(show_clock=True)

        with TabbedContent(initial="services"):
            with TabPane("Services", id="services"):
                with VerticalScroll():
                    # Search bar
                    yield Input(
                        placeholder="🔍 Search services...",
                        id="service-search",
                    )
                    with ScrollableContainer(id="services-container"):
                        with Container(classes="service-grid"):
                            for service_id, service in self.services.items():
                                card = ServiceCard(service, id=f"card-{service_id}")
                                self.service_cards[service_id] = card
                                yield card

            with TabPane("Logs", id="logs"):
                yield Log(id="log-viewer", auto_scroll=True)

            with TabPane("Health", id="health"):
                yield DataTable(id="health-table")

            with TabPane("Stats", id="stats"):
                yield DataTable(id="stats-table")
                
            with TabPane("Config", id="config"):
                with VerticalScroll():
                    yield Label("⚙️ Configuration", classes="config-title")
                    with Container(classes="config-section"):
                        yield Label("Monitor Interval (seconds):", classes="config-label")
                        yield Input(
                            value=str(self._monitor_interval),
                            id="monitor-interval-input",
                            type="number",
                        )
                        yield Button("Apply", id="apply-monitor-interval", variant="primary")
                    
                    with Container(classes="config-section"):
                        yield Label("Auto-refresh Logs:", classes="config-label")
                        yield Switch(value=True, id="auto-refresh-logs")
                    
                    with Container(classes="config-section"):
                        yield Label("Quick Actions:", classes="config-label")
                        yield Button("📂 Open Project Folder", id="open-folder", variant="default")
                        yield Button("🌐 Open Backend (localhost:5000)", id="open-backend", variant="default")
                        yield Button("🌐 Open Frontend (localhost:5173)", id="open-frontend", variant="default")

        yield Footer()

    async def on_mount(self) -> None:
        """Initialize the application"""
        # Setup health table
        health_table = self.query_one("#health-table", DataTable)
        health_table.add_columns(
            "Service", "Status", "Port", "Response Time", "Last Check"
        )

        # Setup stats table
        stats_table = self.query_one("#stats-table", DataTable)
        stats_table.add_columns("Service", "PID", "CPU %", "Memory (MB)", "Uptime")

        # Start monitoring
        self.monitoring_task = asyncio.create_task(self.monitor_services())

        # Start log reading
        self.log_reading_task = asyncio.create_task(self.read_service_logs())

        # Log startup
        log_viewer = self.query_one("#log-viewer", Log)
        log_viewer.write_line(
            f"[{datetime.now().strftime('%H:%M:%S')}] Development Manager started"
        )
        log_viewer.write_line(
            f"[{datetime.now().strftime('%H:%M:%S')}] Project root: {self.project_root}"
        )

    async def read_service_logs(self) -> None:
        """Background task to read and display service logs and
        stdout/stderr. Optimized with buffering."""
        log_viewer = self.query_one("#log-viewer", Log)

        # Track file positions for log files
        log_files = {
            "mcp": self.project_root / "mcp_server.log",
            "backend": (self.project_root / "instance" / "logs" / "app.log"),
            "telegram": (self.project_root / "instance" / "logs" / "telegram.log"),
        }
        file_positions = {name: 0 for name in log_files}
        
        # Buffer for batch writing
        log_buffer = []
        buffer_size = 20

        while True:
            try:
                # Check if auto-refresh is enabled
                auto_refresh_switch = self.query_one("#auto-refresh-logs", Switch)
                if not auto_refresh_switch.value:
                    await asyncio.sleep(2)
                    continue

                # Read service stdout/stderr
                for service_id, service in self.services.items():
                    if service.process and service.process.poll() is None:
                        # Try to read available stdout
                        try:
                            import select

                            ready, _, _ = select.select(
                                [service.process.stdout], [], [], 0.05
                            )
                            if ready:
                                line = service.process.stdout.readline()
                                if line:
                                    line = line.rstrip()
                                    log_buffer.append(f"[{service.name}] {line}")
                        except (AttributeError, OSError):
                            pass

                # Read log files with buffering
                for name, log_path in log_files.items():
                    if log_path.exists():
                        try:
                            with open(log_path) as f:
                                f.seek(file_positions.get(name, 0))
                                new_lines = f.readlines()
                                for line in new_lines[-50:]:  # Limit to last 50 lines per read
                                    log_buffer.append(f"[{name.upper()}] {line.rstrip()}")
                                file_positions[name] = f.tell()
                        except OSError:
                            pass

                # Flush buffer
                if log_buffer:
                    for line in log_buffer[:buffer_size]:
                        log_viewer.write_line(line)
                    log_buffer = log_buffer[buffer_size:]

                await asyncio.sleep(1.0)  # Increased from 0.5s to reduce CPU

            except Exception as e:
                try:
                    log_viewer.write_line(f"[LOG_READER] Error: {e}")
                except Exception:
                    pass
                await asyncio.sleep(1)

    @on(Button.Pressed, "#start-*")
    async def on_start_service(self, event: Button.Pressed) -> None:
        """Handle start button press"""
        service_id = event.button.id.replace("start-", "")
        await self.start_service(service_id)

    @on(Button.Pressed, "#stop-*")
    async def on_stop_service(self, event: Button.Pressed) -> None:
        """Handle stop button press"""
        service_id = event.button.id.replace("stop-", "")
        await self.stop_service(service_id)

    @on(Button.Pressed, "#restart-*")
    async def on_restart_service(self, event: Button.Pressed) -> None:
        """Handle restart button press"""
        service_id = event.button.id.replace("restart-", "")
        await self.restart_service(service_id)
    
    @on(Button.Pressed, "#apply-monitor-interval")
    async def on_apply_monitor_interval(self, event: Button.Pressed) -> None:
        """Handle monitor interval update"""
        try:
            input_widget = self.query_one("#monitor-interval-input", Input)
            new_interval = float(input_widget.value)
            if 1 <= new_interval <= 60:
                self._monitor_interval = new_interval
                log_viewer = self.query_one("#log-viewer", Log)
                log_viewer.write_line(
                    f"[{datetime.now().strftime('%H:%M:%S')}] Monitor interval updated to {new_interval}s"
                )
        except ValueError:
            pass
    
    @on(Button.Pressed, "#open-folder")
    async def on_open_folder(self, event: Button.Pressed) -> None:
        """Open project folder in file manager"""
        log_viewer = self.query_one("#log-viewer", Log)
        try:
            import platform
            system = platform.system()
            if system == "Darwin":  # macOS
                subprocess.Popen(["open", str(self.project_root)])
            elif system == "Windows":
                subprocess.Popen(["explorer", str(self.project_root)])
            else:  # Linux
                subprocess.Popen(["xdg-open", str(self.project_root)])
            log_viewer.write_line(
                f"[{datetime.now().strftime('%H:%M:%S')}] Opened project folder"
            )
        except Exception as e:
            log_viewer.write_line(
                f"[{datetime.now().strftime('%H:%M:%S')}] Failed to open folder: {e}"
            )
    
    @on(Button.Pressed, "#open-backend")
    async def on_open_backend(self, event: Button.Pressed) -> None:
        """Open backend in browser"""
        await self._open_url("http://localhost:5000")
    
    @on(Button.Pressed, "#open-frontend")
    async def on_open_frontend(self, event: Button.Pressed) -> None:
        """Open frontend in browser"""
        await self._open_url("http://localhost:5173")
    
    async def _open_url(self, url: str):
        """Open URL in default browser"""
        log_viewer = self.query_one("#log-viewer", Log)
        try:
            import webbrowser
            webbrowser.open(url)
            log_viewer.write_line(
                f"[{datetime.now().strftime('%H:%M:%S')}] Opened {url} in browser"
            )
        except Exception as e:
            log_viewer.write_line(
                f"[{datetime.now().strftime('%H:%M:%S')}] Failed to open URL: {e}"
            )
    
    @on(Input.Changed, "#service-search")
    def on_search_changed(self, event: Input.Changed) -> None:
        """Filter services based on search input"""
        search_term = event.value.lower()
        for service_id, card in self.service_cards.items():
            service = self.services[service_id]
            if search_term in service.name.lower() or search_term in service_id:
                card.display = True
            else:
                card.display = False

    async def start_service(self, service_id: str) -> None:
        """Start a service"""
        service = self.services[service_id]
        card = self.service_cards[service_id]
        log_viewer = self.query_one("#log-viewer", Log)

        if service.process and service.process.poll() is None:
            log_viewer.write_line(
                f"[{datetime.now().strftime('%H:%M:%S')}] {service.name} is already running"
            )
            return
        
        # Check if service requires environment variables
        if service.requires_env:
            env_file = self.project_root / ".env"
            if not env_file.exists():
                log_viewer.write_line(
                    f"[{datetime.now().strftime('%H:%M:%S')}] ⚠️  {service.name} requires .env file. Please configure it first."
                )
                card.update_status("STOPPED")
                return
            
            # Check for required env vars for Telegram bot
            if service_id == "telegram_bot":
                from dotenv import dotenv_values
                env_vars = dotenv_values(env_file)
                if not env_vars.get("TELEGRAM_BOT_TOKEN"):
                    log_viewer.write_line(
                        f"[{datetime.now().strftime('%H:%M:%S')}] ⚠️  TELEGRAM_BOT_TOKEN not set in .env"
                    )
                    card.update_status("STOPPED")
                    return
                if env_vars.get("ENABLE_TELEGRAM_BOT", "false").lower() != "true":
                    log_viewer.write_line(
                        f"[{datetime.now().strftime('%H:%M:%S')}] ⚠️  ENABLE_TELEGRAM_BOT not set to true in .env"
                    )
                    card.update_status("STOPPED")
                    return

        try:
            card.update_status("STARTING")
            log_viewer.write_line(
                f"[{datetime.now().strftime('%H:%M:%S')}] Starting {service.name}..."
            )

            # Set up environment
            env = {
                **subprocess.os.environ,
                "PYTHONPATH": str(self.project_root),
                "FLASK_ENV": "development",
            }

            # Start process
            service.process = subprocess.Popen(
                service.command,
                cwd=service.cwd,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
            )

            service.pid = service.process.pid
            service.start_time = datetime.now()

            # Wait a moment for startup
            await asyncio.sleep(2)

            # Check if still running
            if service.process.poll() is None:
                card.update_status("RUNNING")
                log_viewer.write_line(
                    f"[{datetime.now().strftime('%H:%M:%S')}] ✓ {service.name} started successfully (PID: {service.pid})"
                )
            else:
                card.update_status("STOPPED")
                log_viewer.write_line(
                    f"[{datetime.now().strftime('%H:%M:%S')}] ✗ {service.name} failed to start"
                )

        except Exception as e:
            card.update_status("STOPPED")
            log_viewer.write_line(
                f"[{datetime.now().strftime('%H:%M:%S')}] ✗ Error starting {service.name}: {e}"
            )

    async def stop_service(self, service_id: str) -> None:
        """Stop a service"""
        service = self.services[service_id]
        card = self.service_cards[service_id]
        log_viewer = self.query_one("#log-viewer", Log)

        if not service.process or service.process.poll() is not None:
            log_viewer.write_line(
                f"[{datetime.now().strftime('%H:%M:%S')}] {service.name} is not running"
            )
            card.update_status("STOPPED")
            return

        try:
            log_viewer.write_line(
                f"[{datetime.now().strftime('%H:%M:%S')}] Stopping {service.name}..."
            )

            # Try graceful shutdown first
            service.process.terminate()

            try:
                service.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                # Force kill if needed
                service.process.kill()
                service.process.wait()

            service.process = None
            service.pid = None
            card.update_status("STOPPED")
            log_viewer.write_line(
                f"[{datetime.now().strftime('%H:%M:%S')}] ✓ {service.name} stopped"
            )

        except Exception as e:
            log_viewer.write_line(
                f"[{datetime.now().strftime('%H:%M:%S')}] ✗ Error stopping {service.name}: {e}"
            )

    async def restart_service(self, service_id: str) -> None:
        """Restart a service"""
        await self.stop_service(service_id)
        await asyncio.sleep(1)
        await self.start_service(service_id)

    async def monitor_services(self) -> None:
        """Background task to monitor service health - Optimized version"""
        while True:
            try:
                stats_table = self.query_one("#stats-table", DataTable)
                stats_table.clear()

                health_table = self.query_one("#health-table", DataTable)
                health_table.clear()

                for service_id, service in self.services.items():
                    # Check if service is running
                    is_running = service.process and service.process.poll() is None

                    if is_running:
                        try:
                            proc = psutil.Process(service.pid)
                            cpu = proc.cpu_percent(interval=0.05)  # Reduced from 0.1
                            memory = proc.memory_info().rss / (1024 * 1024)  # MB
                            uptime = (
                                datetime.now() - service.start_time
                                if service.start_time
                                else None
                            )
                            uptime_str = str(uptime).split(".")[0] if uptime else "N/A"

                            # Update stats table
                            stats_table.add_row(
                                service.name,
                                str(service.pid),
                                f"{cpu:.1f}",
                                f"{memory:.1f}",
                                uptime_str,
                            )

                            # Optimize health check with caching
                            response_time = "N/A"
                            status_emoji = "🟢"
                            status_text = "Running"
                            
                            # Only check port health if service has a port
                            if service.port > 0:
                                # Use cached result if recent (within 30s)
                                now = datetime.now()
                                cache_valid = (
                                    service._last_health_check and
                                    (now - service._last_health_check).seconds < 30
                                )
                                
                                if cache_valid:
                                    status_text = service._cached_health_status
                                    response_time = service._cached_response_time
                                    status_emoji = "🟢" if "Healthy" in status_text else "🟡"
                                else:
                                    # Perform health check
                                    try:
                                        import socket
                                        start = now
                                        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                                        sock.settimeout(0.5)  # Reduced from 1s
                                        result = sock.connect_ex(("localhost", service.port))
                                        sock.close()

                                        if result == 0:
                                            response_time = f"{(datetime.now() - start).total_seconds() * 1000:.0f}ms"
                                            status_text = "✓ Healthy"
                                        else:
                                            status_emoji = "🟡"
                                            status_text = "Starting"
                                    except Exception:
                                        status_emoji = "🟡"
                                        status_text = "No Response"
                                    
                                    # Cache the result
                                    service._last_health_check = now
                                    service._cached_health_status = status_text
                                    service._cached_response_time = response_time
                            else:
                                # No port to check (e.g., Telegram bot)
                                status_text = "Running (no port)"
                                status_emoji = "🟢"

                            health_table.add_row(
                                f"{status_emoji} {service.name}",
                                status_text,
                                str(service.port) if service.port > 0 else "N/A",
                                response_time,
                                datetime.now().strftime("%H:%M:%S"),
                            )

                        except (psutil.NoSuchProcess, psutil.AccessDenied):
                            # Process exists but can't access it
                            health_table.add_row(
                                f"⚠️ {service.name}",
                                "Access Denied",
                                str(service.port) if service.port > 0 else "N/A",
                                "N/A",
                                datetime.now().strftime("%H:%M:%S"),
                            )
                    else:
                        # Service is not running
                        health_table.add_row(
                            f"⭕ {service.name}",
                            "Stopped",
                            str(service.port) if service.port > 0 else "N/A",
                            "N/A",
                            datetime.now().strftime("%H:%M:%S"),
                        )

                # Use dynamic interval based on config
                await asyncio.sleep(self._monitor_interval)

            except Exception as e:
                log_viewer = self.query_one("#log-viewer", Log)
                log_viewer.write_line(
                    f"[{datetime.now().strftime('%H:%M:%S')}] Monitor error: {e}"
                )
                await asyncio.sleep(self._monitor_interval)

    async def action_start_all(self) -> None:
        """Start all services"""
        log_viewer = self.query_one("#log-viewer", Log)
        log_viewer.write_line(
            f"[{datetime.now().strftime('%H:%M:%S')}] Starting all services..."
        )

        for service_id in self.services.keys():
            service = self.services[service_id]
            # Skip if already running
            if not (service.process and service.process.poll() is None):
                await self.start_service(service_id)
                await asyncio.sleep(0.5)  # Small delay between starts

    async def action_restart_all(self) -> None:
        """Restart all services"""
        log_viewer = self.query_one("#log-viewer", Log)
        log_viewer.write_line(
            f"[{datetime.now().strftime('%H:%M:%S')}] Restarting all services..."
        )

        for service_id in self.services.keys():
            await self.restart_service(service_id)

    async def action_stop_all(self) -> None:
        """Stop all services"""
        log_viewer = self.query_one("#log-viewer", Log)
        log_viewer.write_line(
            f"[{datetime.now().strftime('%H:%M:%S')}] Stopping all services..."
        )

        for service_id in self.services.keys():
            await self.stop_service(service_id)

    async def action_show_logs(self) -> None:
        """Switch to logs tab"""
        tabs = self.query_one(TabbedContent)
        tabs.active = "logs"

    async def action_show_health(self) -> None:
        """Switch to health tab"""
        tabs = self.query_one(TabbedContent)
        tabs.active = "health"
    
    async def action_show_config(self) -> None:
        """Switch to config tab"""
        tabs = self.query_one(TabbedContent)
        tabs.active = "config"
    
    async def action_focus_search(self) -> None:
        """Focus the search input"""
        search_input = self.query_one("#service-search", Input)
        search_input.focus()

    async def on_unmount(self) -> None:
        """Cleanup when exiting"""
        # Stop monitoring
        if self.monitoring_task:
            self.monitoring_task.cancel()

        # Stop log reading
        if self.log_reading_task:
            self.log_reading_task.cancel()

        # Stop all services
        for service in self.services.values():
            if service.process and service.process.poll() is None:
                try:
                    service.process.terminate()
                    service.process.wait(timeout=5)
                except Exception:
                    service.process.kill()


def main():
    """Entry point"""
    app = DevManagerApp()
    app.run()


if __name__ == "__main__":
    main()
