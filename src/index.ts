#!/usr/bin/env node

/**
 * Crownpeak DQM MCP Server - Stdio Entry Point
 */

import { runStdioServer } from './server.js';

async function main() {
  try {
    await runStdioServer();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
