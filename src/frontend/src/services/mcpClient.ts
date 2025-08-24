// Re-export MCP client service from the services folder outside src
// This keeps path aliases like '@/services/mcpClient' working for files under src/
export * from '../../services/mcpClient';
export { default } from '../../services/mcpClient';

