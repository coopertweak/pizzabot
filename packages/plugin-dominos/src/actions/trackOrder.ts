import { Action, IAgentRuntime, Memory, elizaLogger } from "@elizaos/core";
import { PizzaOrderManager } from "../PizzaOrderManager";
import { Tracking } from 'dominos';
import { OrderStatus } from "../types";

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
        const orderManager = new PizzaOrderManager(runtime);
        const order = await orderManager.getOrder(message.userId);
        return !!order && order.status === OrderStatus.CONFIRMED;
    },
    handler: async (runtime: IAgentRuntime, message: Memory) => {
        try {
            elizaLogger.info("Tracking pizza order for user");
            const orderManager = new PizzaOrderManager(runtime);

            const order = await orderManager.getOrder(message.userId);
            const customer = await orderManager.getCustomer(message.userId);

            if (!order || !customer) {
                elizaLogger.warn("No active order found for user");
                return "I couldn't find any recent orders for you. Have you placed an order yet?";
            }

            const tracking = new Tracking();
            elizaLogger.debug("Requesting tracking info for phone:", customer.phone);

            const trackingResult = await tracking.byPhone(customer.phone);
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

            if (error.name === 'DominosTrackingError') {
                return "I couldn't find any active orders for tracking. If you just placed your order, please wait a few minutes and try again.";
            }

            return "I'm having trouble tracking your order right now. Please try again in a few minutes.";
        }
    }
};