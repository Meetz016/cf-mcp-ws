# MCP Server Planning Document

## Project Overview
This project aims to create a WebSocket server deployed on Cloudflare Workers that broadcasts messages to all connected clients. Since Cloudflare Workers are serverless and WebSockets require persistent connections, we'll use Durable Objects to maintain connection state.

## Technology Stack
- **Platform**: Cloudflare Workers
- **State Management**: Durable Objects
- **Language**: TypeScript
- **Framework**: Hono
- **Protocol**: WebSocket

## Architecture Design

### Components
1. **Worker**: Entry point that routes WebSocket connection requests to the appropriate Durable Object
2. **Durable Object**: Maintains WebSocket connections and handles broadcasting messages
3. **Client Interface**: Defines how clients connect and communicate with the server

### Data Flow
1. Client establishes WebSocket connection with the Worker
2. Worker forwards connection to a Durable Object instance
3. Durable Object maintains the connection and adds it to a registry
4. When a message is received, the Durable Object broadcasts it to all registered connections

## Implementation Plan

### 1. Project Setup
- Initialize a new Cloudflare Workers project with wrangler
- Configure TypeScript
- Install Hono framework
- Set up proper wrangler configuration for Durable Objects

### 2. Interface Definitions Examples (feel free to make your own )

```typescript
// Client message interface
interface IClientMessage {
  type: string;
  payload: any;
  timestamp: number;
}

// Server message interface
interface IServerMessage {
  type: string;
  payload: any;
  timestamp: number;
  sender?: string;
}

// WebSocket connection wrapper interface
interface IWebSocketConnection {
  id: string;
  socket: WebSocket;
  timestamp: number;
}

// Connection registry interface
interface IConnectionRegistry {
  connections: Map<string, IWebSocketConnection>;
  add(connection: IWebSocketConnection): void;
  remove(id: string): void;
  broadcast(message: IServerMessage): void;
}
```

### 3. Durable Object Implementation

```typescript
// Will implement the connection registry and WebSocket handling
export class MCPConnectionsDO implements DurableObject {
  private connections: Map<string, IWebSocketConnection>;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.connections = new Map();
    this.env = env;
    state.blockConcurrencyWhile(() => this.initialize());
  }

  async initialize() {
    // Any initialization logic
  }

  async fetch(request: Request) {
    // Handle WebSocket upgrade
    // Add connection to registry
    // Set up message handlers
  }

  broadcast(message: IServerMessage) {
    // Send message to all connected clients
  }
}
```

### 4. Worker Implementation using Hono

```typescript
// Main worker entry point using Hono for routing
const app = new Hono();

app.get('/ws', async (c) => {
  // Handle WebSocket connections and forward to the Durable Object
});

app.post('/broadcast', async (c) => {
  // API endpoint to broadcast messages programmatically
});

export default {
  fetch: app.fetch,
};
```

### 5. Wrangler Configuration

The `wrangler.toml` will need to define the Durable Objects:

```toml
name = "mcp-server"
main = "src/index.ts"
compatibility_date = "2023-05-15"

[durable_objects]
bindings = [
  { name = "CONNECTIONS", class_name = "MCPConnectionsDO" }
]

[[migrations]]
tag = "v1"
new_classes = ["MCPConnectionsDO"]
```

## Implementation Details

### Connection Management
- Generate unique IDs for each connection
- Store connections in the Durable Object's Map
- Clean up connections when they close or error out

### Message Broadcasting
- When a message is received from any client, parse it
- Validate message format
- Broadcast to all connected clients
- Handle any errors during broadcasting

### Error Handling
- Implement proper error handling for WebSocket connections
- Handle reconnection logic
- Log errors appropriately

### Testing Strategy
1. Local testing using wrangler dev
2. Test broadcasting functionality with multiple clients
3. Test reconnection scenarios

## Deployment
- Deploy using `wrangler deploy` or `npx wrangler deploy`
- Set up proper bindings in production

## Future Enhancements
- Authentication for WebSocket connections
- Message filtering options
- Rate limiting
- Client-specific message targeting