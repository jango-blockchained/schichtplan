#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Type definitions
interface MCPResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeGroup: string;
  contractedHours: number;
  isKeyholder: boolean;
}

interface Shift {
  id: number;
  shiftType: string;
  startTime: string;
  endTime: string;
  employeeId?: string;
}

interface Schedule {
  id: number;
  startDate: string;
  endDate: string;
  isPublished: boolean;
  shifts: Shift[];
}

interface Settings {
  id: number;
  key: string;
  value: string;
}

interface Absence {
  id: number;
  employeeId: string;
  startDate: string;
  endDate: string;
  reason: string;
}

// Mock database
const db = {
  employees: new Map<string, Employee>(),
  shifts: new Map<number, Shift>(),
  schedules: new Map<number, Schedule>(),
  settings: new Map<number, Settings>(),
  absences: new Map<number, Absence>()
};

// Display banner
function displayBanner() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   Shift-MCP Server                                            ║
║   Model Context Protocol Server for Shift Planning            ║
║                                                               ║
║   Version: 1.0.0                                              ║
║   Running with Node.js runtime                                ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);
}

// Create the MCP server
const server = new McpServer({
  name: "shift-mcp",
  version: "1.0.0",
});

// Port for browser tools
const PORT = 4025;

// ===== RESOURCE HANDLERS =====

// Employee resources
async function getEmployees(): Promise<MCPResponse<Employee[]>> {
  return {
    success: true,
    data: Array.from(db.employees.values())
  };
}

async function getEmployee(params: { employeeId: string }): Promise<MCPResponse<Employee>> {
  const employee = db.employees.get(params.employeeId);
  if (!employee) {
    return {
      success: false,
      error: `Employee with ID ${params.employeeId} not found`
    };
  }
  return {
    success: true,
    data: employee
  };
}

// Shift resources
async function getShifts(): Promise<MCPResponse<Shift[]>> {
  return {
    success: true,
    data: Array.from(db.shifts.values())
  };
}

async function getShift(params: { shiftId: number }): Promise<MCPResponse<Shift>> {
  const shift = db.shifts.get(params.shiftId);
  if (!shift) {
    return {
      success: false,
      error: `Shift with ID ${params.shiftId} not found`
    };
  }
  return {
    success: true,
    data: shift
  };
}

// Schedule resources
async function getSchedules(): Promise<MCPResponse<Schedule[]>> {
  return {
    success: true,
    data: Array.from(db.schedules.values())
  };
}

async function getCurrentSchedule(): Promise<MCPResponse<Schedule>> {
  // In a real implementation, you would query for the current active schedule
  const schedules = Array.from(db.schedules.values());
  const currentSchedule = schedules[schedules.length - 1];

  if (!currentSchedule) {
    return {
      success: false,
      error: 'No current schedule found'
    };
  }

  return {
    success: true,
    data: currentSchedule
  };
}

// Settings resources
async function getSettings(): Promise<MCPResponse<Settings[]>> {
  return {
    success: true,
    data: Array.from(db.settings.values())
  };
}

// System info resource
async function getSystemInfo(): Promise<MCPResponse<any>> {
  return {
    success: true,
    data: {
      version: '1.0.0',
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime()
    }
  };
}

// ===== TOOL HANDLERS =====

// Employee tools
async function createEmployee(params: {
  firstName: string;
  lastName: string;
  employeeGroup: string;
  contractedHours: number;
  isKeyholder?: boolean;
}): Promise<MCPResponse<Employee>> {
  try {
    const id = `emp_${Date.now()}`;
    const employee: Employee = {
      id,
      firstName: params.firstName,
      lastName: params.lastName,
      employeeGroup: params.employeeGroup,
      contractedHours: params.contractedHours,
      isKeyholder: params.isKeyholder || false
    };

    db.employees.set(id, employee);
    return {
      success: true,
      data: employee
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create employee'
    };
  }
}

async function updateEmployee(params: {
  employeeId: string;
  updates: Partial<Omit<Employee, 'id'>>;
}): Promise<MCPResponse<Employee>> {
  try {
    const employee = db.employees.get(params.employeeId);
    if (!employee) {
      return {
        success: false,
        error: `Employee with ID ${params.employeeId} not found`
      };
    }

    const updatedEmployee = {
      ...employee,
      ...params.updates
    };

    db.employees.set(params.employeeId, updatedEmployee);
    return {
      success: true,
      data: updatedEmployee
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update employee'
    };
  }
}

// Schedule tools
async function generateSchedule(params: {
  startDate: string;
  endDate: string;
}): Promise<MCPResponse<Schedule>> {
  try {
    const id = Date.now();
    const schedule: Schedule = {
      id,
      startDate: params.startDate,
      endDate: params.endDate,
      isPublished: false,
      shifts: []
    };

    db.schedules.set(id, schedule);
    return {
      success: true,
      data: schedule
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate schedule'
    };
  }
}

async function publishSchedule(params: {
  scheduleId: number;
}): Promise<MCPResponse<Schedule>> {
  try {
    const schedule = db.schedules.get(params.scheduleId);
    if (!schedule) {
      return {
        success: false,
        error: `Schedule with ID ${params.scheduleId} not found`
      };
    }

    const updatedSchedule = {
      ...schedule,
      isPublished: true
    };

    db.schedules.set(params.scheduleId, updatedSchedule);
    return {
      success: true,
      data: updatedSchedule
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to publish schedule'
    };
  }
}

// Settings tools
async function updateSettings(params: {
  key: string;
  value: string;
}): Promise<MCPResponse<Settings>> {
  try {
    const id = Date.now();
    const setting: Settings = {
      id,
      key: params.key,
      value: params.value
    };

    db.settings.set(id, setting);
    return {
      success: true,
      data: setting
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update settings'
    };
  }
}

// Export tools
async function exportSchedulePDF(params: {
  scheduleId: number;
}): Promise<MCPResponse<string>> {
  // This would be implemented with actual PDF generation
  return {
    success: true,
    data: `Schedule ${params.scheduleId} exported as PDF`
  };
}

async function exportEmployeeSchedulePDF(params: {
  employeeId: string;
  startDate: string;
  endDate: string;
}): Promise<MCPResponse<string>> {
  // This would be implemented with actual PDF generation
  return {
    success: true,
    data: `Employee ${params.employeeId} schedule exported as PDF`
  };
}

// Browser tools
server.tool("getConsoleLogs", "Check our browser logs", async () => {
  const response = await fetch(`http://127.0.0.1:${PORT}/console-logs`);
  const json = await response.json();
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(json, null, 2),
      },
    ],
  };
});

server.tool("getConsoleErrors", "Check our browsers console errors", async () => {
  const response = await fetch(`http://127.0.0.1:${PORT}/console-errors`);
  const json = await response.json();
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(json, null, 2),
      },
    ],
  };
});

server.tool("getNetworkErrorLogs", "Check our network ERROR logs", async () => {
  const response = await fetch(`http://127.0.0.1:${PORT}/network-errors`);
  const json = await response.json();
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(json, null, 2),
      },
    ],
  };
});

server.tool("getNetworkSuccessLogs", "Check our network SUCCESS logs", async () => {
  const response = await fetch(`http://127.0.0.1:${PORT}/all-xhr`);
  const json = await response.json();
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(json, null, 2),
      },
    ],
  };
});

server.tool("takeScreenshot", "Take a screenshot of the current browser tab", async () => {
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/capture-screenshot`, {
      method: "POST",
    });

    const result = await response.json();

    if (response.ok) {
      return {
        content: [
          {
            type: "text",
            text: "Successfully saved screenshot",
          },
        ],
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: `Error taking screenshot: ${result.error}`,
          },
        ],
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Failed to take screenshot: ${errorMessage}`,
        },
      ],
    };
  }
});

server.tool("getSelectedElement", "Get the selected element from the browser", async () => {
  const response = await fetch(`http://127.0.0.1:${PORT}/selected-element`);
  const json = await response.json();
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(json, null, 2),
      },
    ],
  };
});

server.tool("wipeLogs", "Wipe all browser logs from memory", async () => {
  const response = await fetch(`http://127.0.0.1:${PORT}/wipelogs`, {
    method: "POST",
  });
  const json = await response.json();
  return {
    content: [
      {
        type: "text",
        text: json.message,
      },
    ],
  };
});

// Register shift planning tools
server.tool("createEmployee", "Create a new employee", async (extra) => {
  // Default values
  const firstName = "New";
  const lastName = "Employee";
  const employeeGroup = "Staff";
  const contractedHours = 40;
  const isKeyholder = false;

  const result = await createEmployee({ firstName, lastName, employeeGroup, contractedHours, isKeyholder });
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

server.tool("updateEmployee", "Update an existing employee", async (extra) => {
  // Default values
  const employeeId = "";
  const updates = {};

  const result = await updateEmployee({ employeeId, updates });
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

server.tool("generateSchedule", "Generate a new schedule", async (extra) => {
  // Default values
  const startDate = new Date().toISOString().split('T')[0];
  const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const result = await generateSchedule({ startDate, endDate });
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

server.tool("publishSchedule", "Publish a schedule", async (extra) => {
  // Default value
  const scheduleId = 0;

  const result = await publishSchedule({ scheduleId });
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

server.tool("updateSettings", "Update system settings", async (extra) => {
  // Default values
  const key = "setting";
  const value = "value";

  const result = await updateSettings({ key, value });
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

server.tool("exportSchedulePDF", "Export schedule as PDF", async (extra) => {
  // Since we don't have access to params directly, we'll use a default value
  const scheduleId = 0; // Default value
  const result = await exportSchedulePDF({ scheduleId });
  return {
    content: [
      {
        type: "text",
        text: result.data || "Failed to export schedule",
      },
    ],
  };
});

server.tool("exportEmployeeSchedulePDF", "Export employee schedule as PDF", async (extra) => {
  // Since we don't have access to params directly, we'll use default values
  const employeeId = "";
  const startDate = new Date().toISOString().split('T')[0];
  const endDate = new Date().toISOString().split('T')[0];
  const result = await exportEmployeeSchedulePDF({ employeeId, startDate, endDate });
  return {
    content: [
      {
        type: "text",
        text: result.data || "Failed to export employee schedule",
      },
    ],
  };
});

// Register resources
server.resource("employees", "/resources/employees", async (uri) => {
  const result = await getEmployees();
  return {
    contents: [
      {
        uri: uri.toString(),
        text: JSON.stringify(result.data),
        mimeType: "application/json"
      }
    ]
  };
});

server.resource("employee", "/resources/employee", async (uri, extra) => {
  const params = Object.fromEntries(uri.searchParams);
  const result = await getEmployee({ employeeId: params.id as string });
  return {
    contents: [
      {
        uri: uri.toString(),
        text: JSON.stringify(result.data),
        mimeType: "application/json"
      }
    ]
  };
});

server.resource("shifts", "/resources/shifts", async (uri) => {
  const result = await getShifts();
  return {
    contents: [
      {
        uri: uri.toString(),
        text: JSON.stringify(result.data),
        mimeType: "application/json"
      }
    ]
  };
});

server.resource("shift", "/resources/shift", async (uri, extra) => {
  const params = Object.fromEntries(uri.searchParams);
  const result = await getShift({ shiftId: parseInt(params.id as string) });
  return {
    contents: [
      {
        uri: uri.toString(),
        text: JSON.stringify(result.data),
        mimeType: "application/json"
      }
    ]
  };
});

server.resource("schedules", "/resources/schedules", async (uri) => {
  const result = await getSchedules();
  return {
    contents: [
      {
        uri: uri.toString(),
        text: JSON.stringify(result.data),
        mimeType: "application/json"
      }
    ]
  };
});

server.resource("currentSchedule", "/resources/currentSchedule", async (uri) => {
  const result = await getCurrentSchedule();
  return {
    contents: [
      {
        uri: uri.toString(),
        text: JSON.stringify(result.data),
        mimeType: "application/json"
      }
    ]
  };
});

server.resource("settings", "/resources/settings", async (uri) => {
  const result = await getSettings();
  return {
    contents: [
      {
        uri: uri.toString(),
        text: JSON.stringify(result.data),
        mimeType: "application/json"
      }
    ]
  };
});

server.resource("systemInfo", "/resources/systemInfo", async (uri) => {
  const result = await getSystemInfo();
  return {
    contents: [
      {
        uri: uri.toString(),
        text: JSON.stringify(result.data),
        mimeType: "application/json"
      }
    ]
  };
});

// Display banner
displayBanner();

// Start receiving messages on stdio
(async () => {
  try {
    const transport = new StdioServerTransport();

    // Ensure stdout is only used for JSON messages
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: any, encoding?: any, callback?: any) => {
      // Only allow JSON messages to pass through
      if (typeof chunk === "string" && !chunk.startsWith("{")) {
        return true; // Silently skip non-JSON messages
      }
      return originalStdoutWrite(chunk, encoding, callback);
    };

    await server.connect(transport);
    console.log("MCP server started successfully");
    console.log("Listening for requests...");
  } catch (error) {
    console.error("Failed to initialize MCP server:", error);
    process.exit(1);
  }

  // Handle process signals
  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));
})();

// Handle uncaught errors
process.on('uncaughtException', (error: Error) => {
  console.error(error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  console.error(reason instanceof Error ? reason.message : 'Unhandled promise rejection');
  process.exit(1);
});
