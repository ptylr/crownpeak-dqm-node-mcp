#!/usr/bin/env node

/**
 * Crownpeak DQM MCP Server - Stdio Entry Point
 */

import { runStdioServer } from './server.js';

async function main() {
  try {
    // Only load dotenv if API key is not already set
    // Claude Desktop passes env vars directly, so we don't need dotenv in that case
    if (!process.env.DQM_API_KEY) {
      // Suppress dotenv output to stdout by temporarily redirecting it to stderr
      const originalStdoutWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = (chunk: any, ...args: any[]) => {
        process.stderr.write(chunk, ...args as any);
        return true;
      };

      try {
        const dotenv = await import('dotenv');
        dotenv.config();
      } finally {
        process.stdout.write = originalStdoutWrite;
      }
    }

    await runStdioServer();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
