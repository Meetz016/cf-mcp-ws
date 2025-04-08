import { Hono } from 'hono';
import { MCPConnectionsDO } from './durable_objects/connections';
import { Env } from './types/env';
import { cors } from 'hono/cors';
import { User } from './types/user';
import { getToken } from './services/user/user.services';
import { IPublisherPayload } from './types/publisher';
import { addStockService, getStockService } from './services/stock/stock.service';


const app = new Hono<{ Bindings: Env }>();
app.use('*', async (c, next) => {
    if (c.req.header('upgrade')?.toLowerCase() !== 'websocket') {
        return cors()(c, next)
    }
    return next()
})


// Health check endpoint
app.get('/', (c) => {
    return c.json({
        status: 'ok',
        message: 'MCP Server is running'
    });
});


app.post("/publish", async (c) => {
    const payload: IPublisherPayload = await c.req.json();
    const publisher = await addStockService(c.env, payload);
    console.log("publisher response", publisher)
    return c.json({
        publisher,
        status: 'ok',
        message: 'Payload received'
    });
});

app.get("/stocks", async (c) => {
    const stocks = await getStockService(c.env);
    console.log("stocks", stocks)
    return c.json(stocks);
});
app.get('/auth/callback', async (c) => {
    const url = new URL(c.req.url)
    const code = url.searchParams.get('code')

    if (!code) {
        return c.text('Missing code', 400)
    }

    // Exchange code for access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: c.env.GOOGLE_ID,
            client_secret: c.env.GOOGLE_SECRET,
            redirect_uri: 'https://mcp-server.kmeetz016.workers.dev/auth/callback',
            grant_type: 'authorization_code',
        }),
    })

    const tokenData: any = await tokenRes.json()
    const accessToken = tokenData.access_token
    console.log(tokenRes)
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    })

    const user: User = await userRes.json()
    console.log("user", user)
    if (user) {

        console.log("payload is:", user.email)
        const token = await getToken(c.env, user)
        console.log("token:", token)

        return Response.redirect(`http://localhost:5173/dashboard?token=${token}`, 302) // or redirect to frontend with token
    }
    return c.json({ error: 'Something went wrong' }, 400)
})

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