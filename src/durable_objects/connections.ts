import { publish } from '@/repository/publisher/publisher.repository';
import { IResponseMessage, IServerMessage } from '../types/messages';
import { Env } from '../types/env';
import { IPublisherRepository } from '@/types/publisher.repository.types';
import { searchStock } from '@/repository/stock/stock.repository';
import { addSubscriber, searchSubscriber } from '@/repository/subscriber/subscriber.repository';
import { addSubscription } from '@/repository/subscriptions/subscriptions.repository';

export class MCPConnectionsDO implements DurableObject {
    state: DurableObjectState;
    env: Env;
    private topics: Map<string, Set<WebSocket>>;
    private clients: Map<WebSocket, string>;

    constructor(state: DurableObjectState, env: Env) {
        this.state = state;
        this.clients = new Map();
        this.topics = new Map();
        this.env = env;
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
        server.addEventListener("message", async (event) => {
            try {
                const message = event.data;
                if (!message) {
                    this.sendErrorResponse(server, "Empty message received");
                    return;
                }

                let parsedMessage: IServerMessage;
                try {
                    console.log("message", typeof message);
                    parsedMessage = JSON.parse(message.toString());
                    console.log("parsedMessage", parsedMessage);
                } catch (e) {
                    this.sendErrorResponse(server, "Invalid JSON format");
                    return;
                }

                if (!parsedMessage.type) {
                    this.sendErrorResponse(server, "Message type is required");
                    return;
                }

                if (!parsedMessage.payload || !parsedMessage.payload.stock) {
                    this.sendErrorResponse(server, "Stock name is required");
                    return;
                }

                if (parsedMessage.type === "publisher") {
                    await this.handlePublisherMessage(server, parsedMessage);
                } else if (parsedMessage.type === "subscriber") {
                    await this.handleSubscriberMessage(server, parsedMessage, clientId);
                } else {
                    this.sendErrorResponse(server, `Unsupported message type: ${parsedMessage.type}`);
                }
            } catch (error) {
                console.error('Error processing message:', error);
                this.sendErrorResponse(server, "An error occurred while processing your message");
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

    /**
     * Handle publisher messages
     */
    private async handlePublisherMessage(server: WebSocket, message: IServerMessage) {
        console.log("Processing publisher message:", message);

        // Case 1: Creating a new stock
        if (message.isNewStock && message.id && message.payload.price) {
            console.log("Creating new stock:", message.payload.stock);
            const publisherId: string = message.id;
            const stock = message.payload.stock;
            const stockDetails: IPublisherRepository = {
                publisher_id: publisherId,
                stock_name: stock,
                stock_symbol: message.payload.stock.slice(0, 3),
                stock_price: message.payload.price
            }

            const publishResult = await publish(this.env, stockDetails);
            if (publishResult.success) {
                console.log(`Stock ${stock} added to topic list by publisher ${publishResult.data.publisher_id}`);
                // Store the normalized lowercase name in the topics map for case-insensitive lookups
                this.topics.set(stock.toLowerCase(), new Set<WebSocket>());
            }

            server.send(JSON.stringify(publishResult));
            return;
        }
        // Case 2: Updating an existing stock
        else {
            const stockName = message.payload.stock;
            const stockLower = stockName.toLowerCase();

            // Validate publisher has a stock price
            if (!message.payload.price) {
                this.sendErrorResponse(server, "Price is required for publisher updates");
                return;
            }

            // Check if stock exists in the topics map (case-insensitive)
            const stockExists = this.topics.has(stockLower);

            if (!stockExists) {
                console.log(`Stock ${stockName} not found in topics map, checking database...`);

                // Not in local map, check database
                const isExists = await searchStock(this.env, stockName);

                if (!isExists.success) {
                    // Not found in database either
                    const errorMessage: IResponseMessage = {
                        payload: {
                            stock: stockName
                        },
                        message: `Stock ${stockName} does not exist. Please create it with isNewStock=true first.`,
                        timestamp: Date.now()
                    }
                    server.send(JSON.stringify(errorMessage));
                    return;
                } else {
                    // Found in database, add to topics map
                    this.topics.set(stockLower, new Set<WebSocket>());
                    console.log(`Stock ${stockName} found in database, added to local topics map`);
                }
            }

            const subscribers = this.topics.get(stockLower);
            console.log(`Found ${subscribers?.size || 0} subscribers for stock ${stockName}`);

            // Broadcast the stock update to all subscribers
            const updateMessage: IResponseMessage = {
                type: 'stock-update',
                payload: {
                    stock: stockName,
                    price: message.payload.price
                },
                message: "STOCK PRICE UPDATE",
                timestamp: Date.now()
            }

            if (subscribers && subscribers.size > 0) {
                subscribers.forEach(subscriber => {
                    if (subscriber.readyState === WebSocket.OPEN) {
                        subscriber.send(JSON.stringify(updateMessage));
                    }
                });
                console.log(`Broadcasted update to ${subscribers.size} subscribers`);
            } else {
                console.log(`No active subscribers for stock ${stockName}`);
            }

            // Always send confirmation to the publisher
            server.send(JSON.stringify({
                success: true,
                message: `Stock price updated for ${stockName}`,
                timestamp: Date.now()
            }));
        }
    }

    /**
     * Handle subscriber messages
     */
    private async handleSubscriberMessage(server: WebSocket, message: IServerMessage, clientId: string) {
        console.log("Processing subscriber message:", message);

        // Validate subscriber ID
        if (!message.id) {
            const errorMessage: IResponseMessage = {
                payload: {
                    stock: message.payload?.stock
                },
                message: "Subscriber ID is required",
                timestamp: Date.now()
            }
            server.send(JSON.stringify(errorMessage));
            return;
        }

        const stockName = message.payload?.stock;
        if (!stockName) {
            this.sendErrorResponse(server, "Stock name is required");
            return;
        }

        // Normalize stock name for lookups
        const stockLower = stockName.toLowerCase();

        // Check if stock exists in local topics map
        if (!this.topics.has(stockLower)) {
            console.log(`Stock ${stockName} not found in topics map, checking database...`);

            // If not in local map, check database
            const stockSearchResult = await searchStock(this.env, stockName);

            if (!stockSearchResult.success) {
                // Stock doesn't exist in database either
                const errorMessage: IResponseMessage = {
                    payload: {
                        stock: stockName
                    },
                    message: `Stock "${stockName}" not found. It has not been published by any publisher.`,
                    timestamp: Date.now()
                }
                server.send(JSON.stringify(errorMessage));
                return;
            } else {
                // Stock found in database but not in local map, add it
                this.topics.set(stockLower, new Set<WebSocket>());
                console.log(`Stock ${stockName} found in database, added to local topics map`);
            }
        }

        // Check if subscriber exists
        console.log(`Checking if subscriber exists: ${message.id}`);
        const isSubscriberExists = await searchSubscriber(this.env, message.id);

        if (!isSubscriberExists.success) {
            console.log(`Subscriber ${message.id} not found, creating new subscriber`);

            // Create new subscriber
            const newSubscriber = await addSubscriber(this.env);

            if (newSubscriber.success) {
                const subscriberId = newSubscriber.data.subscriber_id;
                console.log(`Created new subscriber: ${subscriberId}`);

                // Update message id with new subscriber id
                message.id = subscriberId;

                // Create subscription table entry
                const subscription = await addSubscription(this.env, stockName, subscriberId);

                if (subscription.success) {
                    // Add to in-memory topics map
                    this.topics.get(stockLower)?.add(server);
                    console.log(`Subscriber ${clientId} subscribed to ${stockName}`);

                    // Send confirmation message
                    server.send(JSON.stringify({
                        type: 'success',
                        payload: {
                            message: `Subscribed to the stock: ${stockName}`,
                            subscriber_id: subscriberId
                        },
                        timestamp: Date.now()
                    }));
                } else {
                    const errorMessage: IResponseMessage = {
                        payload: {
                            stock: stockName
                        },
                        message: subscription.message || "Failed to subscribe to stock",
                        timestamp: Date.now()
                    }
                    server.send(JSON.stringify(errorMessage));
                }
            } else {
                const errorMessage: IResponseMessage = {
                    payload: {
                        stock: stockName
                    },
                    message: "Failed to create subscriber",
                    timestamp: Date.now()
                }
                server.send(JSON.stringify(errorMessage));
            }
        } else {
            // Subscriber exists, create subscription
            console.log(`Subscriber ${message.id} found, creating subscription to ${stockName}`);

            const subscription = await addSubscription(this.env, stockName, message.id);

            if (subscription.success) {
                // Add to in-memory topics map
                this.topics.get(stockLower)?.add(server);
                console.log(`Existing subscriber ${message.id} subscribed to ${stockName}`);

                // Send confirmation message
                server.send(JSON.stringify({
                    type: 'success',
                    payload: {
                        message: `Subscribed to the stock: ${stockName}`,
                        stock_id: subscription.data.stock_id
                    },
                    timestamp: Date.now()
                }));
            } else {
                const errorMessage: IResponseMessage = {
                    payload: {
                        stock: stockName
                    },
                    message: subscription.message || "Failed to subscribe to stock",
                    timestamp: Date.now()
                }
                server.send(JSON.stringify(errorMessage));
            }
        }
    }

    /**
     * Send an error response to the client
     */
    private sendErrorResponse(socket: WebSocket, message: string) {
        socket.send(JSON.stringify({
            type: 'error',
            payload: { message },
            timestamp: Date.now()
        }));
    }

    /**
     * Handle broadcast messages
     */
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