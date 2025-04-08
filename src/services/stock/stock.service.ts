import { addStock, searchStock } from "@/repository/stock/stock.repository";
import { Env } from "@/types/env";
import { IPublisherPayload } from "@/types/publisher";



export async function addStockService(env: Env, publisherPayload: IPublisherPayload) {
    try {
        const isStockExists = await searchStock(env, publisherPayload.stock_name);
        if (isStockExists?.results.length !== 0) {
            return {
                status: 'error publishing stock',
                message: 'Stock already exists'
            }
        }
        const { stock_id, res } = await addStock(env, publisherPayload);
        if (res.success) {
            return {
                stock_id: stock_id,
                status: 'success publishing stock',
                message: 'Stock added to the db'
            }
        }
        return {
            status: 'error publishing stock',
            message: 'somthing went wrong'
        }
    } catch (error) {
        console.log("error", error);
        return null;
    }
}
