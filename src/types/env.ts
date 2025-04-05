import { D1Database } from "@cloudflare/workers-types";

export interface Env {
    CONNECTIONS: DurableObjectNamespace;
    DB: D1Database;
}