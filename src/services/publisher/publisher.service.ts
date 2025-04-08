import { Env } from "@/types/env";
import { IPublisherPayload } from "@/types/publisher";


export async function searchPublisher(env: Env, publisher_id: string) {
    try {
        const publisher = await env.DB.prepare("SELECT * FROM publisher WHERE id = ?")
            .bind(publisher_id)
            .all();
        return publisher;
    } catch (error) {
        console.log("error", error)
        return null;
    }
}

export async function publishStock(env: Env, payload: IPublisherPayload) {
    try {
        const publisher = await searchPublisher(env, payload.id);
        if (publisher?.results.length === 0) {
            return {
                status: 'error',
                message: 'Publisher not found'
            }
        }
        //update the stock db because publisher is valid

        console.log("payload", payload)
        return {
            status: 'ok',
            message: 'Stock published'
        }
    } catch (error) {
        console.log("error", error)
        return {
            status: 'error',
            message: 'Stock not published'
        }
    }
}
