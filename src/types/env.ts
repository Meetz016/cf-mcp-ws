import { D1Database } from "@cloudflare/workers-types";

export interface Env {
    CONNECTIONS: DurableObjectNamespace;
    DB: D1Database;
    GOOGLE_ID: string;
    GOOGLE_SECRET: string;
    JWT_SECRET: string;
}