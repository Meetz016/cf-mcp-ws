import { Env } from "@/types/env";
import { IPublisherRepository } from "@/types/publisher.repository.types";
import { IRepositoryResponse } from "@/types/response/repository.response";

export async function publish(env: Env, data: IPublisherRepository): Promise<IRepositoryResponse> {
    try {
        const { publisher_id, stock_name, stock_symbol, stock_price } = data;

        // Check if publisher exists
        const dbResult = await env.DB
            .prepare("SELECT * FROM publisher WHERE publisher_id = ?")
            .bind(publisher_id)
            .all();

        let finalPublisherId = publisher_id;

        if (dbResult.results.length === 0) {
            // Create new publisher
            finalPublisherId = crypto.randomUUID();
            await env.DB
                .prepare("INSERT INTO publisher (publisher_id) VALUES (?)")
                .bind(finalPublisherId)
                .run();
        }

        // Create new stock entry
        const stockId = crypto.randomUUID();
        await env.DB
            .prepare(`
                INSERT INTO stock (stock_id, stock_name, stock_symbol, stock_price, publisher_id)
                VALUES (?, ?, ?, ?, ?)
            `)
            .bind(stockId, stock_name, stock_symbol, stock_price, finalPublisherId)
            .run();

        return {
            success: true,
            message: dbResult.results.length === 0
                ? "Publisher didn't exist. Created new publisher and published stock."
                : "Stock published successfully.",
            data: {
                publisher_id: finalPublisherId,
                stock_id: stockId,
            },
        };
    } catch (error: any) {
        console.error("Error in publish():", error);

        return {
            success: false,
            message: "An error occurred while publishing stock.",
            data: {
                error: error.message || String(error),
            },
        };
    }
}
