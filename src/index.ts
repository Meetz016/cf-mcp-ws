import { Hono } from 'hono';
import { MCPConnectionsDO } from './durable_objects/connections';
import { Env } from './types/env';
import { getAllStocks } from './repository/stock/stock.repository';



const app = new Hono<{ Bindings: Env }>();


// Health check endpoint
app.get('/', (c) => {
    return c.json({
        status: 'ok',
        message: 'MCP Server is running'
    });
});

app.get("/stocks", async (c) => {
    const stocks = await getAllStocks(c.env);
    return c.json(stocks);
});

// WebSocket connection endpoint
app.get('/ws', async (c) => {
    console.log('Received WebSocket connection request');
    try {
        // Check if this is a WebSocket upgrade request
        if (c.req.header('Upgrade') !== 'websocket') {
            return c.json({ error: 'Expected WebSocket upgrade request' }, 400);
        }

        const id = c.env.CONNECTIONS.idFromName('connections');
        const connectionsObject = c.env.CONNECTIONS.get(id);

        // Forward the WebSocket upgrade request to the Durable Object
        return connectionsObject.fetch(c.req.raw);
    } catch (error) {
        console.error('WebSocket connection error:', error);
        return c.json({ error: 'Failed to establish WebSocket connection' }, 500);
    }
});
export default {
    fetch: app.fetch,
};

export { MCPConnectionsDO }; 