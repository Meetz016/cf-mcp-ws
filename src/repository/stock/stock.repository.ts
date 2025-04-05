import { Env } from "@/types/env";
import { IRepositoryResponse } from "@/types/response/repository.response";

export async function searchStock(env: Env, stock_name: string): Promise<IRepositoryResponse> {
    console.log("Looking for stock:", stock_name);
    try {
        // Case-insensitive search using UPPER function on both sides
        const stock = await env.DB.prepare("SELECT * FROM stock WHERE UPPER(stock_name) = UPPER(?)")
            .bind(stock_name)
            .all();

        console.log("Stock search results:", stock.results.length > 0 ? stock.results[0] : "No results");

        if (stock.results.length === 0) {
            return {
                success: false,
                message: `Stock "${stock_name}" not found.`,
            }
        }

        return {
            success: true,
            message: "Stock found",
            data: stock.results[0]
        }
    } catch (error: any) {
        console.error("Error in searchStock:", error);
        return {
            success: false,
            message: "An error occurred while searching for stock.",
            data: {
                error: error.message || String(error),
            },
        };
    }
}


export async function getAllStocks(env: Env): Promise<IRepositoryResponse> {
    try {
        //just select stock_name,stock_id,stock_price
        const stocks = await env.DB.prepare("SELECT stock_name,stock_id,stock_price,stock_symbol FROM stock").bind().all();
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
