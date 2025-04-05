import { Env } from "@/types/env";
import { IRepositoryResponse } from "@/types/response/repository.response";

/**
 * Add a new subscription for a subscriber to a stock
 * @param env Cloudflare environment
 * @param stock_name Stock name to find and subscribe to
 * @param subscriber_id Subscriber ID
 * @returns Repository response with the new subscription ID
 */
export async function addSubscription(env: Env, stock_name: string, subscriber_id: string): Promise<IRepositoryResponse> {
    try {
        // Validate inputs
        if (!stock_name || typeof stock_name !== 'string' || stock_name.trim() === '') {
            return {
                success: false,
                message: "Invalid stock name. Stock name is required.",
            };
        }

        if (!subscriber_id || typeof subscriber_id !== 'string' || subscriber_id.trim() === '') {
            return {
                success: false,
                message: "Invalid subscriber ID. Subscriber ID is required.",
            };
        }

        // Normalize stock name to uppercase
        const normalizedStockName = stock_name.toUpperCase();

        // First find the stock_id for the given stock name
        const stockResult = await env.DB.prepare(
            "SELECT stock_id FROM stock WHERE UPPER(stock_name) = ?"
        )
            .bind(normalizedStockName)
            .all();

        if (stockResult.results.length === 0) {
            return {
                success: false,
                message: `Stock "${stock_name}" not found in the database.`,
            };
        }

        const stock_id = stockResult.results[0].stock_id;

        // Check if subscription already exists with stock_id
        const existingSubscription = await env.DB.prepare(
            "SELECT * FROM subscription WHERE stock_id = ? AND subscriber_id = ?"
        )
            .bind(stock_id, subscriber_id)
            .all();

        if (existingSubscription.results.length > 0) {
            return {
                success: true,
                message: "Subscription already exists",
                data: {
                    subscription_id: existingSubscription.results[0].subscription_id,
                    stock_id
                }
            };
        }

        // Create new subscription with stock_id
        const subscription_id = crypto.randomUUID();
        await env.DB.prepare(
            "INSERT INTO subscription (subscription_id, stock_id, subscriber_id) VALUES (?, ?, ?)"
        )
            .bind(subscription_id, stock_id, subscriber_id)
            .run();

        return {
            success: true,
            message: "Subscription added successfully",
            data: {
                subscription_id,
                stock_id
            }
        };
    } catch (error: any) {
        console.error("Error in addSubscription:", error);
        return {
            success: false,
            message: "An error occurred while adding subscription.",
            data: {
                error: error.message || String(error),
            },
        };
    }
}

/**
 * Get all subscriptions for a subscriber
 * @param env Cloudflare environment
 * @param subscriber_id Subscriber ID
 * @returns Repository response with the subscriptions
 */
export async function getSubscriptionsBySubscriberId(env: Env, subscriber_id: string): Promise<IRepositoryResponse> {
    try {
        if (!subscriber_id || typeof subscriber_id !== 'string' || subscriber_id.trim() === '') {
            return {
                success: false,
                message: "Invalid subscriber ID. Subscriber ID is required.",
            };
        }

        // Join with stock table to get stock details
        const subscriptions = await env.DB.prepare(`
            SELECT s.subscription_id, s.stock_id, s.subscriber_id, s.created_at,
                   st.stock_name, st.stock_symbol, st.stock_price
            FROM subscription s
            JOIN stock st ON s.stock_id = st.stock_id
            WHERE s.subscriber_id = ?
        `)
            .bind(subscriber_id)
            .all();

        return {
            success: true,
            message: "Subscriptions retrieved successfully",
            data: subscriptions.results
        };
    } catch (error: any) {
        console.error("Error in getSubscriptionsBySubscriberId:", error);
        return {
            success: false,
            message: "An error occurred while retrieving subscriptions.",
            data: {
                error: error.message || String(error),
            },
        };
    }
}
