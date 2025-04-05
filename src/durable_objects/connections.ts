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
        console.log("message", message);
        if (message.isNewStock && message.id && message.payload.price) {
            console.log("message", message);
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
                console.log(`${stock.toLocaleLowerCase()} added to topic list by publisher ${publishResult.data.publisher_id}`);
                this.topics.set(stock.toLocaleLowerCase(), new Set<WebSocket>());
            }

            server.send(JSON.stringify(publishResult));
            return;
        } else {
            const stock = message.payload.stock.toLowerCase();

            // Validate publisher has a stock price
            if (!message.payload.price) {
                this.sendErrorResponse(server, "Price is required for publisher updates");
                return;
            }

            if (!this.topics.get(stock)) {
                //then search for stock in db
                const isExists = await searchStock(this.env, stock);
                if (!isExists.success) {
                    const errorMessage: IResponseMessage = {
                        payload: {
                            stock
                        },
                        message: `Stock ${stock} Does not exist in topic list.`,
                        timestamp: Date.now()
                    }
                    server.send(JSON.stringify(errorMessage));
                    return;
                } else {
                    // Stock found in database but not in local map
                    this.topics.set(stock, new Set<WebSocket>());
                    console.log(`Stock ${stock} found in database, added to local topics map`);
                }
            }

            const subscribers = this.topics.get(stock);
            console.log("subscribers", subscribers);

            // Broadcast the stock update to all subscribers
            if (message.payload.price) {
                const updateMessage: IResponseMessage = {
                    payload: {
                        stock,
                        price: message.payload.price
                    },
                    message: "UPDATE !!!",
                    timestamp: Date.now()
                }
                if (subscribers) {
                    subscribers.forEach(subscriber => {
                        if (subscriber.readyState === WebSocket.OPEN) {
                            subscriber.send(JSON.stringify(updateMessage));
                        }
                    });
                }
            }
        }
    }

    /**
     * Handle subscriber messages
     */
    private async handleSubscriberMessage(server: WebSocket, message: IServerMessage, clientId: string) {
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

        const stock = message.payload?.stock.toLocaleLowerCase();
        if (!stock) {
            this.sendErrorResponse(server, "Stock name is required");
            return;
        }

        // Check if stock exists in local topics map
        if (!this.topics.has(stock)) {
            // If not in local map, check database
            const stockSearchResult = await searchStock(this.env, stock);

            if (!stockSearchResult.success) {
                // Stock doesn't exist in database either
                const errorMessage: IResponseMessage = {
                    payload: {
                        stock
                    },
                    message: `Stock ${stock} not found. It has not been published by any publisher.`,
                    timestamp: Date.now()
                }
                server.send(JSON.stringify(errorMessage));
                return;
            } else {
                // Stock found in database but not in local map, add it
                this.topics.set(stock, new Set<WebSocket>());
                console.log(`Stock ${stock} found in database, added to local topics map`);
            }
        }

        //TRY TO SEARCH IF SUBSCRIBER EXISTS
        const isSubscriberExists = await searchSubscriber(this.env, message.id);
        if (!isSubscriberExists.success) {
            //create new subscriber
            const newSubscriber = await addSubscriber(this.env);
            console.log("newSubscriber", newSubscriber);
            if (newSubscriber.success) {
                message.id = newSubscriber.data.subscriber_id;

                //now create subscription table entry
                const subscription = await addSubscription(this.env, stock, newSubscriber.data.subscriber_id);
                if (subscription.success) {
                    this.topics.get(stock)?.add(server);
                    console.log(`Subscriber ${clientId} subscribed to ${stock}`);

                    // Send confirmation message
                    server.send(JSON.stringify({
                        type: 'success',
                        payload: {
                            message: `Subscribed to the stock: ${stock}`,
                            subscriber_id: newSubscriber.data.subscriber_id
                        },
                        timestamp: Date.now()
                    }));
                } else {
                    const errorMessage: IResponseMessage = {
                        payload: {
                            stock
                        },
                        message: subscription.message || "Failed to subscribe to stock",
                        timestamp: Date.now()
                    }
                    server.send(JSON.stringify(errorMessage));
                }
            } else {
                const errorMessage: IResponseMessage = {
                    payload: {
                        stock
                    },
                    message: "Failed to create subscriber",
                    timestamp: Date.now()
                }
                server.send(JSON.stringify(errorMessage));
            }
        } else {
            // Subscriber exists, create subscription
            const subscription = await addSubscription(this.env, stock, message.id);
            if (subscription.success) {
                this.topics.get(stock)?.add(server);
                console.log(`Existing subscriber ${message.id} subscribed to ${stock}`);

                // Send confirmation message
                server.send(JSON.stringify({
                    type: 'success',
                    payload: { message: `Subscribed to the stock: ${stock}` },
                    timestamp: Date.now()
                }));
            } else {
                const errorMessage: IResponseMessage = {
                    payload: {
                        stock
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