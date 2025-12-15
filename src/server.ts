/**
 * MCP Server for Crownpeak DQM CMS API
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { DQMClient } from './dqmClient.js';
import { loadConfig, validateConfig } from './config.js';
import { allTools, handleToolCall } from './tools.js';
import type { DQMConfig } from './types.js';

/**
 * Create and configure the MCP server
 */
export function createServer(config: DQMConfig): Server {
  validateConfig(config);

  const client = new DQMClient(config);
  const server = new Server(
    {
      name: 'crownpeak-dqm-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle list_tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
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
    };
  });

  // Handle call_tool request
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const result = await handleToolCall(name, args || {}, client);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorDetails = (error as any).statusCode
        ? `Status: ${(error as any).statusCode}\n`
        : '';

      return {
        content: [
          {
            type: 'text',
            text: `Error: ${errorDetails}${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Run the server with stdio transport
 */
export async function runStdioServer(): Promise<void> {
  const config = loadConfig();
  const server = createServer(config);
  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error('Crownpeak DQM MCP Server running on stdio');
  console.error(`Base URL: ${config.baseUrl}`);
  console.error(`Destructive tools: ${config.enableDestructiveTools ? 'enabled' : 'disabled'}`);
}

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
