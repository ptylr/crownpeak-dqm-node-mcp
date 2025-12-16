/**
 * Configuration management for the DQM MCP Server
 */

import type { DQMConfig } from './types.js';

/**
 * Load configuration from environment variables
 */
export function loadConfig(): DQMConfig {
  const apiKey = process.env.DQM_API_KEY;

  if (!apiKey) {
    throw new Error(
      'DQM_API_KEY environment variable is required. ' +
      'Please set it to your Crownpeak DQM API key.'
    );
  }

  const config: DQMConfig = {
    apiKey,
    baseUrl: process.env.DQM_API_BASE_URL || 'https://api.crownpeak.net/dqm-cms/v1',
    requestTimeout: parseInt(process.env.DQM_REQUEST_TIMEOUT || '30000', 10),
    enableDestructiveTools: process.env.ENABLE_DESTRUCTIVE_TOOLS === 'true',
    maxConcurrentQualityChecks: parseInt(process.env.MAX_CONCURRENT_QUALITY_CHECKS || '3', 10),
    qualityCheckMaxPolls: parseInt(process.env.QUALITY_CHECK_MAX_POLLS || '60', 10),
    qualityCheckPollInterval: parseInt(process.env.QUALITY_CHECK_POLL_INTERVAL || '2000', 10),
  };

  // Validate configuration
  if (config.requestTimeout <= 0) {
    throw new Error('DQM_REQUEST_TIMEOUT must be a positive number');
  }

  if (config.maxConcurrentQualityChecks <= 0) {
    throw new Error('MAX_CONCURRENT_QUALITY_CHECKS must be a positive number');
  }

  if (config.qualityCheckMaxPolls <= 0) {
    throw new Error('QUALITY_CHECK_MAX_POLLS must be a positive number');
  }

  if (config.qualityCheckPollInterval <= 0) {
    throw new Error('QUALITY_CHECK_POLL_INTERVAL must be a positive number');
  }

  return config;
}

/**
 * Validate that the configuration is loaded and complete
 */
export function validateConfig(config: DQMConfig): void {
  if (!config.apiKey) {
    throw new Error('API key is required');
  }

  if (!config.baseUrl) {
    throw new Error('Base URL is required');
  }

  // Ensure base URL doesn't end with a slash
  if (config.baseUrl.endsWith('/')) {
    config.baseUrl = config.baseUrl.slice(0, -1);
  }
}
