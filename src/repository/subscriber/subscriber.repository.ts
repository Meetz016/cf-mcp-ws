import { Env } from "@/types/env";
import { IRepositoryResponse } from "@/types/response/repository.response";

/**
 * Search for a subscriber by ID
 * @param env Cloudflare environment
 * @param subscriber_id Subscriber ID to search for
 * @returns Repository response with subscriber data if found
 */
export async function searchSubscriber(env: Env, subscriber_id: string): Promise<IRepositoryResponse> {
    try {
        if (!subscriber_id || typeof subscriber_id !== 'string' || subscriber_id.trim() === '') {
            return {
                success: false,
                message: "Invalid subscriber ID. Subscriber ID is required.",
            };
        }

        const subscriber = await env.DB.prepare("SELECT * FROM subscriber WHERE subscriber_id = ?")
            .bind(subscriber_id)
            .all();
        if (subscriber.results.length === 0) {
            return {
                success: false,
                message: "Subscriber not found.",
            }
        }
        return {
            success: true,
            message: "Subscriber found",
            data: subscriber.results[0]
        }
    } catch (error: any) {
        console.error("Error in searchSubscriber:", error);
        return {
            success: false,
            message: "An error occurred while searching for subscriber.",
            data: {
                error: error.message || String(error),
            },
        };
    }
}

/**
 * Add a new subscriber to the database
 * @param env Cloudflare environment
 * @returns Repository response with the new subscriber ID
 */
export async function addSubscriber(env: Env): Promise<IRepositoryResponse> {
    try {
        const subscriber_id = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO subscriber (subscriber_id) VALUES (?)")
            .bind(subscriber_id)
            .run();

        return {
            success: true,
            message: "Subscriber added successfully",
            data: {
                subscriber_id
            }
        }
    } catch (error: any) {
        console.error("Error in addSubscriber:", error);
        return {
            success: false,
            message: "An error occurred while adding subscriber.",
            data: {
                error: error.message || String(error),
            },
        };
    }
}
