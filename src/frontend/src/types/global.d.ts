interface Window {
  mcp_getConsoleLogs: (dummy: string) => Promise<any[]>;
  mcp_getConsoleErrors: (dummy: string) => Promise<any[]>;
  mcp_getNetworkLogs: (dummy: string) => Promise<any[]>;
  mcp_getNetworkErrors: (dummy: string) => Promise<any[]>;
  mcp_wipeLogs: (dummy: string) => Promise<void>;
  mcp_takeScreenshot: (dummy: string) => Promise<string>;
  mcp_getSelectedElement: (dummy: string) => Promise<any>;
}
