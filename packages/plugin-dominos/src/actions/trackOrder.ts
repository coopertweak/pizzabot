import { Action, ActionExample, IAgentRuntime, Memory, elizaLogger } from "@elizaos/core";
import { PizzaOrderManager } from "../PizzaOrderManager";
import { Tracking } from 'dominos';

export const trackOrder: Action = {
    name: "TRACK_ORDER",
    description: "Tracks the status of a user's Dominos pizza order",
    similes: ["CHECK_ORDER", "ORDER_STATUS", "PIZZA_STATUS", "WHERE_PIZZA"],
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Where's my pizza?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Let me check your order status...",
                    action: "TRACK_ORDER",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Track my order",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Your order is in the oven and will be ready for delivery soon!",
                    action: "TRACK_ORDER",
                },
            },
        ],
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        // Check if user has a recent order in memory
        const recentOrder = await runtime.messageManager.getMemories({
            roomId: message.roomId,
            count: 1
        }).then(memories =>
            memories.filter(m =>
                m.userId === message.userId &&
                m.content.type === 'order'
            )
        );

        return recentOrder.length > 0;
    },
    handler: async (runtime: IAgentRuntime, message: Memory) => {
        try {
            elizaLogger.info("Tracking pizza order for user");

            // Get the user's most recent order from memory
            const recentOrder = await runtime.messageManager.getMemories({
                roomId: message.roomId,
                count: 1
            }).then(memories =>
                memories.filter(m =>
                    m.userId === message.userId &&
                    m.content.type === 'order'
                )
            );

            if (!recentOrder.length) {
                elizaLogger.warn("No recent order found for user");
                return "I couldn't find any recent orders for you. Have you placed an order yet?";
            }

            const orderData = recentOrder[0].content;
            const customer = await runtime.messageManager.getMemories({
                roomId: message.roomId,
                count: 1
            }).then(memories =>
                memories.filter(m =>
                    m.userId === message.userId &&
                    m.content.type === 'customer'
                )
            );

            if (!customer.length) {
                elizaLogger.error("Customer data not found for order tracking");
                return "I'm having trouble finding your customer information. Please try placing a new order.";
            }

            const tracking = new Tracking();
            elizaLogger.debug("Requesting tracking info for phone:", customer[0].content.phone);

            const trackingResult = await tracking.byPhone(customer[0].content.phone);

            elizaLogger.success("Retrieved order tracking information");

            // Format tracking information into a user-friendly message
            let statusMessage = "🍕 Here's your order status:\n\n";

            if (trackingResult.OrderStatus) {
                statusMessage += `Status: ${trackingResult.OrderStatus}\n`;
            }

            if (trackingResult.StoreStatus) {
                statusMessage += `Store Status: ${trackingResult.StoreStatus}\n`;
            }

            if (trackingResult.EstimatedWaitMinutes) {
                statusMessage += `Estimated Wait: ${trackingResult.EstimatedWaitMinutes} minutes\n`;
            }

            if (trackingResult.DeliveryStatus) {
                statusMessage += `\nDelivery Status: ${trackingResult.DeliveryStatus}`;
                if (trackingResult.DriverName) {
                    statusMessage += `\nDriver: ${trackingResult.DriverName}`;
                }
            }

            return statusMessage;

        } catch (error) {
            elizaLogger.error("Error tracking order:", error);

            // Handle specific Dominos tracking errors
            if (error.name === 'DominosTrackingError') {
                return "I couldn't find any active orders for tracking. If you just placed your order, please wait a few minutes and try again.";
            }

            return "I'm having trouble tracking your order right now. Please try again in a few minutes.";
        }
    }
};