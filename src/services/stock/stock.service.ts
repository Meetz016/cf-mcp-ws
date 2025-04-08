import { Env } from "@/types/env";
import { IPublisherPayload } from "@/types/publisher";


export async function searchStock(env: Env, stock_name: string) {
    try {
        const stock = await env.DB
            .prepare("SELECT * FROM stocks WHERE LOWER(stock_name) = LOWER(?)")
            .bind(stock_name)
            .all();
        return stock;
    } catch (error) {
        console.log("error", error);
        return null;
    }
}

export async function addStock(env: Env, publisherPayload: IPublisherPayload) {
    try {
        const isStockExists = await searchStock(env, publisherPayload.stock_name);
        if (isStockExists?.results.length !== 0) {
            return {
                status: 'error publishing stock',
                message: 'Stock already exists'
            }
        }
        //now add new stock to the db
        const stock_id = crypto.randomUUID();
        const current_timestamp = new Date().toISOString();
        await env.DB.prepare("INSERT INTO stocks (stock_id,stock_name, publisher_id, stock_price, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(stock_id, publisherPayload.stock_name, publisherPayload.id, publisherPayload.stock_price, current_timestamp, current_timestamp)
            .run();
        return {
            stock_id: stock_id,
            status: 'success publishing stock',
            message: 'Stock added to the db'
        }
    } catch (error) {
        console.log("error", error);
        return null;
    }
}
