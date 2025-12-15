#!/usr/bin/env node

/**
 * Crownpeak DQM MCP Server - HTTP Entry Point
 */

import express from 'express';
import { DQMClient } from './dqmClient.js';
import { loadConfig, validateConfig } from './config.js';
import { handleToolCall, allTools } from './tools.js';

const app = express();
app.use(express.json());

// Load configuration
let client: DQMClient;

try {
  const config = loadConfig();
  validateConfig(config);
  client = new DQMClient(config);
  console.log('✓ Configuration loaded successfully');
  console.log(`  Base URL: ${config.baseUrl}`);
  console.log(`  Destructive tools: ${config.enableDestructiveTools ? 'enabled' : 'disabled'}`);
} catch (error) {
  console.error('Failed to load configuration:', error);
  process.exit(1);
}

// Health check endpoint
app.get('/healthz', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint (alternative)
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Crownpeak DQM MCP Server',
    version: '1.0.0',
    description: 'MCP Server for Crownpeak DQM CMS API',
    endpoints: {
      health: '/healthz',
      tools: '/tools',
      call: '/call',
    },
  });
});

// List available tools
app.get('/tools', (_req, res) => {
  res.json({
    tools: allTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(tool.inputSchema.shape).map(([key, value]) => [
            key,
            {
              type: getZodType(value),
              description: (value as any)._def?.description,
            },
          ])
        ),
        required: Object.entries(tool.inputSchema.shape)
          .filter(([_, value]) => !(value as any).isOptional())
          .map(([key]) => key),
      },
    })),
  });
});

// Call a tool
app.post('/call', async (req, res) => {
  const { tool, arguments: args } = req.body;

  if (!tool) {
    return res.status(400).json({
      error: 'Missing required field: tool',
    });
  }

  try {
    const result = await handleToolCall(tool, args || {}, client);
    return res.json({
      success: true,
      result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const statusCode = (error as any).statusCode || 500;

    return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
      success: false,
      error: errorMessage,
      details: (error as any).details,
    });
  }
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// Start server
const port = parseInt(process.env.PORT || '3000', 10);

app.listen(port, '0.0.0.0', () => {
  console.log(`✓ Crownpeak DQM MCP Server listening on port ${port}`);
  console.log(`  Health check: http://localhost:${port}/healthz`);
  console.log(`  Tools list: http://localhost:${port}/tools`);
  console.log(`  Call tool: POST http://localhost:${port}/call`);
});

/**
 * Helper to get Zod type as JSON Schema type
 */
function getZodType(zodType: any): string {
  const typeName = zodType._def?.typeName;

  if (typeName === 'ZodString') return 'string';
  if (typeName === 'ZodNumber') return 'number';
  if (typeName === 'ZodBoolean') return 'boolean';
  if (typeName === 'ZodArray') return 'array';
  if (typeName === 'ZodObject') return 'object';
  if (typeName === 'ZodRecord') return 'object';
  if (typeName === 'ZodOptional') return getZodType(zodType._def.innerType);

  return 'string';
}
