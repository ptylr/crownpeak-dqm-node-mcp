/**
 * Type definitions for Crownpeak DQM CMS API
 */

// Configuration
export interface DQMConfig {
  apiKey: string;
  baseUrl: string;
  requestTimeout: number;
  enableDestructiveTools: boolean;
  maxConcurrentQualityChecks: number;
  qualityCheckMaxPolls: number;
  qualityCheckPollInterval: number;
}

// Website
export interface Website {
  id: string;
  name: string;
  url: string;
  created?: string;
  updated?: string;
  status?: string;
  [key: string]: unknown;
}

export interface ListWebsitesResponse {
  websites: Website[];
  total?: number;
}

// Checkpoint
export interface Checkpoint {
  id: string;
  name: string;
  description?: string;
  severity?: 'critical' | 'error' | 'warning' | 'info';
  category?: string;
  wcagLevel?: string;
  [key: string]: unknown;
}

export interface ListCheckpointsResponse {
  checkpoints: Checkpoint[];
  total?: number;
}

// Asset
export interface Asset {
  id: string;
  websiteId: string;
  url?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  score?: number;
  created?: string;
  updated?: string;
  completedAt?: string;
  [key: string]: unknown;
}

export interface SearchAssetsResponse {
  assets: Asset[];
  total?: number;
}

// Issue
export interface Issue {
  id: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  message: string;
  checkpointId?: string;
  checkpointName?: string;
  location?: {
    url?: string;
    path?: string;
    selector?: string;
    line?: number;
    column?: number;
  };
  [key: string]: unknown;
}

export interface AssetIssuesResponse {
  assetId: string;
  issues: Issue[];
  total?: number;
}

// Quality Check
export interface QualityCheckRequest {
  websiteId: string;
  url?: string;
  html?: string;
  metadata?: Record<string, unknown>;
}

export interface QualityCheckResponse {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  assetId: string;
  score?: number;
  issues: Issue[];
  debug?: {
    createResponse?: unknown;
    statusResponses?: unknown[];
    issuesResponse?: unknown;
  };
}

// Spellcheck
export interface SpellcheckRequest {
  assetId: string;
  language?: string;
}

export interface SpellcheckIssue {
  word: string;
  suggestions: string[];
  context?: string;
  location?: {
    line?: number;
    column?: number;
  };
}

export interface SpellcheckResponse {
  assetId: string;
  issues: SpellcheckIssue[];
  total?: number;
}

// API Error
export interface APIError {
  message: string;
  statusCode?: number;
  details?: unknown;
}
