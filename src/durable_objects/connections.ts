import { IResponseMessage, IServerMessage } from '../types/messages';

export class MCPConnectionsDO implements DurableObject {
    state: DurableObjectState;
    private topics: Map<string, Set<WebSocket>>;
    private clients: Map<WebSocket, string>;

    constructor(state: DurableObjectState) {
        this.state = state;
        this.clients = new Map();
        this.topics = new Map();
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

        // Set up message handler
        server.addEventListener("message", (event) => {
            try {
                const message = event.data;
                const parsedMessage: IServerMessage = JSON.parse(message.toString());
                if (parsedMessage.type === "publisher") {
                    console.log("publisher", typeof parsedMessage.isNewStock);
                    if (parsedMessage.isNewStock) {
                        console.log("new stock", parsedMessage);
                        const stock = parsedMessage.payload.stock;
                        const message: IResponseMessage = {
                            payload: {
                                stock
                            },
                            message: `Publisher ${clientId} added a new stock: ${stock}`,
                            timestamp: Date.now()
                        }
                        this.topics.set(stock, new Set<WebSocket>());
                        server.send(JSON.stringify(message));
                    } else {
                        const stock = parsedMessage.payload.stock;
                        const subscribers = this.topics.get(stock);
                        console.log("subscribers", subscribers);
                        if (parsedMessage.payload.price) {
                            const message: IResponseMessage = {
                                payload: {
                                    stock,
                                    price: parsedMessage.payload.price
                                },
                                message: "UPDATE !!!",
                                timestamp: Date.now()
                            }
                            if (subscribers) {
                                subscribers.forEach(subscriber => {
                                    if (subscriber.readyState === WebSocket.OPEN) {
                                        subscriber.send(JSON.stringify(message));
                                    }
                                });
                            }
                        }
                    }
                } else if (parsedMessage.type === "subscriber") {
                    const stock = parsedMessage.payload?.stock;
                    if (stock) {
                        if (!this.topics.has(stock)) {
                            const message: IResponseMessage = {
                                payload: {
                                    stock
                                },
                                message: `Stock ${stock} not listed by publisher`,
                                timestamp: Date.now()
                            }
                            server.send(JSON.stringify(message));
                            return;
                        }
                        this.topics.get(stock)?.add(server);
                        console.log(`Subscriber ${clientId} subscribed to ${stock}`);
                        server.send(JSON.stringify({
                            type: 'success',
                            payload: { message: `Subscribed to the stock: ${stock}` },
                            timestamp: Date.now()
                        }));
                    }
                }

            } catch (error) {
                console.error('Error processing message:', error);
                server.send(JSON.stringify({
                    type: 'error',
                    payload: { message: 'Invalid message format' },
                    timestamp: Date.now()
                }));
            }
        });

        server.addEventListener("close", () => {
            // Remove from all topics
            this.topics.forEach((subscribers, topic) => {
                subscribers.delete(server);
                if (subscribers.size === 0) {
                    this.topics.delete(topic);
                }
            });
            this.clients.delete(server);
            console.log(`Client ${clientId} disconnected`);
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