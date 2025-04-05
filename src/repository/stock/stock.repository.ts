import { Env } from "@/types/env";
import { IRepositoryResponse } from "@/types/response/repository.response";

export async function searchStock(env: Env, stock_name: string): Promise<IRepositoryResponse> {
    try {
        console.log(stock_name);
        //check if stock exists
        const stock = await env.DB.prepare("SELECT * FROM stock WHERE stock_name = ?")
            .bind(stock_name.toUpperCase())
            .all();
        console.log(stock);
        if (stock.results.length === 0) {
            return {
                success: false,
                message: "Stock not found.",
            }
        }
        return {
            success: true,
            message: "Stock found",
            data: stock.results[0]
        }
    } catch (error: any) {
        console.error(error);
        return {
            success: false,
            message: "An error occurred while searching for stock.",
            data: {
                error: error.message || String(error),
            },
        };
    }
}
