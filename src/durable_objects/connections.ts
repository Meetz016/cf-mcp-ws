import { IServerMessage } from '../types/messages';

export class MCPConnectionsDO implements DurableObject {
    state: DurableObjectState;
    private clients: Map<WebSocket, string>;

    constructor(state: DurableObjectState) {
        this.state = state;
        this.clients = new Map();
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        // Handle WebSocket upgrade
        if (request.headers.get('Upgrade') === 'websocket') {
            return this.handleWebSocket(request);
        }

        // Handle broadcast request
        if (url.pathname === '/broadcast' && request.method === 'POST') {
            return this.handleBroadcast(request);
        }

        return new Response('Not found', { status: 404 });
    }

    private async handleWebSocket(request: Request): Promise<Response> {
        if (request.headers.get('Upgrade') !== 'websocket') {
            return new Response('Expected WebSocket', { status: 400 });
        }
        const { 0: client, 1: server } = new WebSocketPair();
        server.accept();
        const clientId = crypto.randomUUID();
        this.clients.set(server, clientId);

        // Send welcome message
        server.send(JSON.stringify({
            type: 'system',
            payload: { message: 'Connected to server' },
            timestamp: Date.now()
        }));
        console.log('Client connected:', clientId);

        // Set up message handler
        server.addEventListener("message", (event) => {
            const message = event.data;
            console.log("Received:", message);

            // Broadcast the message to all connected clients
            for (const [ws, _] of this.clients) {
                if (ws != server && ws.readyState === WebSocket.OPEN) {
                    ws.send(message);
                }
            }
        });

        server.addEventListener("close", () => {
            this.clients.delete(server);
        });

        return new Response(null, { status: 101, webSocket: client });
    }

    private async handleBroadcast(request: Request): Promise<Response> {
        try {
            const message = await request.json<IServerMessage>();

            // Broadcast to all clients
            for (const [ws] of this.clients) {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        ...message,
                        timestamp: Date.now()
                    }));
                }
            }

            return new Response(JSON.stringify({ status: 'ok' }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('Broadcast error:', error);
            return new Response(JSON.stringify({ error: 'Invalid message format' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
} 