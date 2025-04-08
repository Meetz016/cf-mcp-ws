import { Env } from "@/types/env";
import { IPublisherPayload } from "@/types/publisher";
import { IRepositoryResponse } from "@/types/response/repository.response";

export async function searchStock(env: Env, stock_name: string) {
    const stock = await env.DB
        .prepare("SELECT * FROM stocks WHERE LOWER(stock_name) = LOWER(?)")
        .bind(stock_name)
        .all();
    return stock;

}

export async function addStock(env: Env, publisherPayload: IPublisherPayload) {
    //now add new stock to the db
    const stock_id = crypto.randomUUID();
    const current_timestamp = new Date().toISOString();
    const res = await env.DB.prepare("INSERT INTO stocks (stock_id,stock_name, publisher_id, stock_price, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(stock_id, publisherPayload.stock_name, publisherPayload.id, publisherPayload.stock_price, current_timestamp, current_timestamp)
        .run();
    return { stock_id, res }
}


export async function get(env: Env): Promise<IRepositoryResponse> {
    try {

        const stocks = await env.DB.prepare("SELECT stock_id,stock_name,stock_price FROM stocks").bind().all();
        return {
            success: true,
            message: "All stocks retrieved successfully",
            data: stocks.results
        };
    } catch (error: any) {
        console.error("Error in getAllStocks:", error);
        return {
            success: false,
            message: "An error occurred while retrieving all stocks.",
            data: {
                error: error.message || String(error),
            },
        };
    }
}
