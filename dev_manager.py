#!/usr/bin/env python3
"""
Schichtplan Development Manager - Professional TUI
A Textual-based terminal UI for managing all development services.
"""

import asyncio
import subprocess
from datetime import datetime
from pathlib import Path

import psutil
from textual import on
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import (
    Container,
    Horizontal,
    ScrollableContainer,
)
from textual.widgets import (
    Button,
    DataTable,
    Footer,
    Header,
    Label,
    Log,
    Static,
    TabbedContent,
    TabPane,
)


class ServiceStatus:
    """Track service status and metadata"""

    def __init__(self, name: str, port: int, command: list[str], cwd: Path = None):
        self.name = name
        self.port = port
        self.command = command
        self.cwd = cwd or Path.cwd()
        self.process: subprocess.Popen | None = None
        self.pid: int | None = None
        self.status = "STOPPED"
        self.start_time: datetime | None = None
        self.cpu_percent = 0.0
        self.memory_mb = 0.0


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
            id=f"status-{self.service.name}",
        )

        with Horizontal(classes="service-actions"):
            yield Button("▶️ Start", id=f"start-{self.service.name}", variant="success")
            yield Button("⏹️ Stop", id=f"stop-{self.service.name}", variant="error")
            yield Button(
                "🔄 Restart", id=f"restart-{self.service.name}", variant="primary"
            )

    def update_status(self, status: str):
        """Update the status label with colorful emoji"""
        self.service.status = status
        status_label = self.query_one(f"#status-{self.service.name}", Label)

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
        Binding("l", "show_logs", "Logs"),
        Binding("h", "show_health", "Health"),
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
        }

        self.service_cards: dict[str, ServiceCard] = {}
        self.monitoring_task: asyncio.Task | None = None

    def compose(self) -> ComposeResult:
        """Create child widgets"""
        yield Header(show_clock=True)

        with TabbedContent(initial="services"):
            with TabPane("Services", id="services"):
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

        # Log startup
        log_viewer = self.query_one("#log-viewer", Log)
        log_viewer.write_line(
            f"[{datetime.now().strftime('%H:%M:%S')}] Development Manager started"
        )
        log_viewer.write_line(
            f"[{datetime.now().strftime('%H:%M:%S')}] Project root: {self.project_root}"
        )

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
        """Background task to monitor service health"""
        while True:
            try:
                stats_table = self.query_one("#stats-table", DataTable)
                stats_table.clear()

                for service_id, service in self.services.items():
                    if service.process and service.process.poll() is None:
                        try:
                            proc = psutil.Process(service.pid)
                            cpu = proc.cpu_percent(interval=0.1)
                            memory = proc.memory_info().rss / (1024 * 1024)  # MB
                            uptime = (
                                datetime.now() - service.start_time
                                if service.start_time
                                else None
                            )
                            uptime_str = str(uptime).split(".")[0] if uptime else "N/A"

                            stats_table.add_row(
                                service.name,
                                str(service.pid),
                                f"{cpu:.1f}",
                                f"{memory:.1f}",
                                uptime_str,
                            )
                        except (psutil.NoSuchProcess, psutil.AccessDenied):
                            pass

                await asyncio.sleep(5)

            except Exception as e:
                log_viewer = self.query_one("#log-viewer", Log)
                log_viewer.write_line(
                    f"[{datetime.now().strftime('%H:%M:%S')}] Monitor error: {e}"
                )
                await asyncio.sleep(5)

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

    async def on_unmount(self) -> None:
        """Cleanup when exiting"""
        # Stop monitoring
        if self.monitoring_task:
            self.monitoring_task.cancel()

        # Stop all services
        for service in self.services.values():
            if service.process and service.process.poll() is None:
                try:
                    service.process.terminate()
                    service.process.wait(timeout=5)
                except:
                    service.process.kill()


def main():
    """Entry point"""
    app = DevManagerApp()
    app.run()


if __name__ == "__main__":
    main()
