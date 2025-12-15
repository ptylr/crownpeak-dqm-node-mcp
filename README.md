```
        __          .__
_______/  |_ ___.__.|  |_______
\____ \   __<   |  ||  |\_  __ \
|  |_> >  |  \___  ||  |_|  | \/
|   __/|__|  / ____||____/__|
|__|         \/

https://ptylr.com
https://www.linkedin.com/in/ptylr/
```

# Crownpeak DQM MCP Server
A portable Model Context Protocol (MCP) server that wraps the Crownpeak DQM CMS REST API. This server exposes agent-friendly tools for quality checking, asset management, checkpoint monitoring, and more.

## Features
- **Dual Transport Support**: Run as stdio (desktop clients) or HTTP server (cloud hosting)
- **Production Ready**: TypeScript, error handling, rate limiting, request timeouts
- **Docker Native**: Containerized deployment with health checks
- **Portable**: Deploy anywhere - AWS, Azure, GCP, Netlify, Vercel, Fly.io, Kubernetes
- **Safe by Default**: Read-only operations by default, destructive tools behind feature flag
- **Agent Optimized**: Task-oriented tools designed for AI agents

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm (recommended) or npm
- Crownpeak DQM API key

### Installation
```bash
# Clone repository
git clone <repository-url>
cd crownpeak-dqm-node-mcp

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Edit .env and add your API key
# DQM_API_KEY=your_api_key_here
```
### Build
```bash
pnpm run build
```
## Usage

### Local Stdio Mode (Desktop Clients)

For use with desktop MCP clients like Claude Desktop:

```bash
# Run directly
pnpm start

# Or with environment variables
DQM_API_KEY=your_key pnpm start
```

#### Claude Desktop Configuration

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "crownpeak-dqm": {
      "command": "node",
      "args": ["/absolute/path/to/crownpeak-dqm-node-mcp/dist/index.js"],
      "env": {
        "DQM_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### HTTP Server Mode (Cloud Hosting)

For remote hosting and API access:

```bash
# Start HTTP server
pnpm run start:http

# Server will start on port 3000 (configurable via PORT env var)
```

Test endpoints:

```bash
# Health check
curl http://localhost:3000/healthz

# List available tools
curl http://localhost:3000/tools

# Call a tool
curl -X POST http://localhost:3000/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "list_websites",
    "arguments": {}
  }'
```

## Docker Deployment

### Using Docker Compose (Recommended)

```bash
# Create .env file with your API key
echo "DQM_API_KEY=your_api_key_here" > .env

# Start the server
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the server
docker-compose down
```

### Using Docker Directly

```bash
# Build the image
docker build -t crownpeak-dqm-mcp .

# Run the container
docker run -d \
  --name crownpeak-dqm-mcp \
  -p 3000:3000 \
  -e DQM_API_KEY=your_api_key_here \
  crownpeak-dqm-mcp

# View logs
docker logs -f crownpeak-dqm-mcp

# Stop the container
docker stop crownpeak-dqm-mcp
```

## Cloud Deployment

### AWS

#### AWS ECS/Fargate

```bash
# Build and push to ECR
aws ecr create-repository --repository-name crownpeak-dqm-mcp
docker tag crownpeak-dqm-mcp:latest <account-id>.dkr.ecr.<region>.amazonaws.com/crownpeak-dqm-mcp:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/crownpeak-dqm-mcp:latest

# Create task definition with:
# - Image: <ecr-url>
# - Port: 3000
# - Environment: DQM_API_KEY (use Secrets Manager)
# - Health check: /healthz

# Deploy using ECS console or CLI
```

#### AWS App Runner

```bash
# Use App Runner with ECR source
# Configure:
# - Port: 3000
# - Health check: /healthz
# - Environment variable: DQM_API_KEY
```

### Azure

#### Azure Container Instances

```bash
az container create \
  --resource-group myResourceGroup \
  --name crownpeak-dqm-mcp \
  --image crownpeak-dqm-mcp:latest \
  --dns-name-label crownpeak-dqm \
  --ports 3000 \
  --environment-variables DQM_API_KEY=your_key \
  --cpu 1 --memory 0.5
```

#### Azure Container Apps

```bash
az containerapp create \
  --name crownpeak-dqm-mcp \
  --resource-group myResourceGroup \
  --environment myEnvironment \
  --image crownpeak-dqm-mcp:latest \
  --target-port 3000 \
  --ingress external \
  --env-vars DQM_API_KEY=secretref:dqm-api-key
```

### GCP

#### Cloud Run

```bash
# Build and push to GCR
gcloud builds submit --tag gcr.io/<project-id>/crownpeak-dqm-mcp

# Deploy to Cloud Run
gcloud run deploy crownpeak-dqm-mcp \
  --image gcr.io/<project-id>/crownpeak-dqm-mcp \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars DQM_API_KEY=your_key \
  --port 3000
```

#### GKE (Kubernetes)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crownpeak-dqm-mcp
spec:
  replicas: 2
  selector:
    matchLabels:
      app: crownpeak-dqm-mcp
  template:
    metadata:
      labels:
        app: crownpeak-dqm-mcp
    spec:
      containers:
      - name: crownpeak-dqm-mcp
        image: gcr.io/<project-id>/crownpeak-dqm-mcp:latest
        ports:
        - containerPort: 3000
        env:
        - name: DQM_API_KEY
          valueFrom:
            secretKeyRef:
              name: dqm-secrets
              key: api-key
        livenessProbe:
          httpGet:
            path: /healthz
            port: 3000
        readinessProbe:
          httpGet:
            path: /healthz
            port: 3000
---
apiVersion: v1
kind: Service
metadata:
  name: crownpeak-dqm-mcp
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app: crownpeak-dqm-mcp
```

### Vercel

Create `vercel.json`:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "dist/http.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "dist/http.js"
    }
  ],
  "env": {
    "DQM_API_KEY": "@dqm-api-key"
  }
}
```

Deploy:

```bash
vercel --prod
```

### Netlify

Create `netlify.toml`:

```toml
[build]
  command = "pnpm run build"
  publish = "dist"

[functions]
  node_bundler = "esbuild"

[[redirects]]
  from = "/*"
  to = "/.netlify/functions/server"
  status = 200
```

Create serverless function wrapper in `netlify/functions/server.ts`.

### Fly.io

Create `fly.toml`:

```toml
app = "crownpeak-dqm-mcp"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "3000"

[[services]]
  internal_port = 3000
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [[services.http_checks]]
    interval = 10000
    timeout = 2000
    grace_period = "5s"
    method = "get"
    path = "/healthz"
```

Deploy:

```bash
fly launch
fly secrets set DQM_API_KEY=your_key
fly deploy
```

## Available Tools

### Discovery

- **list_websites**: List all websites in your DQM account
- **get_website**: Get details of a specific website

### Checkpoints (Quality Rules)

- **list_checkpoints**: List all quality checkpoints, optionally filtered by website
- **get_checkpoint**: Get details of a specific checkpoint

### Assets (Scanned Pages)

- **search_assets**: Search for assets with optional filters
- **get_asset**: Get details of a specific asset
- **get_asset_status**: Check the status of an asset scan
- **get_asset_issues**: Get all quality issues for an asset

### Quality Checking

- **run_quality_check**: Run a quality check on a URL or HTML content
  - Accepts: `websiteId`, `url` (optional), `html` (optional), `metadata` (optional)
  - Creates asset, polls until complete, returns issues
  - Rate limited to prevent overload

### Spellcheck

- **spellcheck_asset**: Run spellcheck on an asset
  - Accepts: `assetId`, `language` (optional)

## Configuration

All configuration via environment variables. See `.env.example` for all options.

### Required

- `DQM_API_KEY`: Your Crownpeak DQM API key

### Optional

- `DQM_API_BASE_URL`: Override base URL (default: `https://developer.crownpeak.com/DQM/cms`)
- `PORT`: HTTP server port (default: `3000`)
- `ENABLE_DESTRUCTIVE_TOOLS`: Enable delete operations (default: `false`)
- `DQM_REQUEST_TIMEOUT`: Request timeout in ms (default: `30000`)
- `QUALITY_CHECK_MAX_POLLS`: Max polling attempts for quality checks (default: `60`)
- `QUALITY_CHECK_POLL_INTERVAL`: Polling interval in ms (default: `2000`)
- `MAX_CONCURRENT_QUALITY_CHECKS`: Concurrent quality check limit (default: `3`)

## Development

### Run in Development Mode

```bash
pnpm run dev
```

### Run Tests

```bash
# Run all tests
pnpm test

# Watch mode
pnpm run test:watch

# With coverage
pnpm test -- --coverage
```

### Linting

```bash
pnpm run lint
```

### Type Checking

```bash
pnpm run typecheck
```

## Architecture

```
src/
├── types.ts          # TypeScript type definitions
├── config.ts         # Configuration management
├── dqmClient.ts      # DQM API client
├── tools.ts          # MCP tool definitions
├── server.ts         # MCP server (stdio transport)
├── http.ts           # HTTP server entry point
├── index.ts          # Stdio entry point
└── *.test.ts         # Test files
```

## API Client Features

- Automatic authentication (x-api-key header)
- Request timeouts
- Error handling with structured errors
- Rate limiting for quality checks
- Polling with exponential backoff
- Issue normalization

## Security

- API keys loaded from environment (never hardcoded)
- Non-root Docker user
- Read-only operations by default
- Request timeouts prevent hanging
- Rate limiting prevents abuse
- Comprehensive error handling (no secret leakage)

## Troubleshooting

### "DQM_API_KEY environment variable is required"

Set your API key in `.env` or pass it directly:

```bash
DQM_API_KEY=your_key pnpm start
```

### Connection timeouts

Increase timeout:

```bash
DQM_REQUEST_TIMEOUT=60000 pnpm start:http
```

### Quality check polling times out

Increase max polls or interval:

```bash
QUALITY_CHECK_MAX_POLLS=120 pnpm start:http
```

### Docker health check fails

Ensure the container is running and port 3000 is accessible:

```bash
docker logs crownpeak-dqm-mcp
curl http://localhost:3000/healthz
```

##  Legal Notices
This is an example solution subject to the [MIT license](./LICENSE).

## Disclaimer
This document is provided for information purposes only. Paul Taylor may change the contents hereof without notice. This document is not warranted to be error-free, nor subject to any other warranties or conditions, whether expressed orally or implied in law, including implied warranties and conditions of merchantability or fitness for a particular purpose. Paul Taylor specifically disclaims any liability with respect to this document and no contractual obligations are formed either directly or indirectly by this document. The technologies, functionality, services, and processes described herein are subject to change without notice.
