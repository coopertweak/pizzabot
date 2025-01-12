import { Action, IAgentRuntime, Memory, elizaLogger } from "@elizaos/core";
import { PizzaOrderManager } from "../PizzaOrderManager";
import { OrderStatus } from "../types";

export const confirmOrder: Action = {
    name: "CONFIRM_ORDER",
    description: "Confirms and places the final order with Dominos",
    similes: ["FINALIZE_ORDER", "FINISH_ORDER", "PLACE_ORDER"],
    examples: [
        // TODO: Add examples
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const orderManager = new PizzaOrderManager(runtime);
        const userId = message.userId;
        const order = await orderManager.getOrder(userId);
        const customer = await orderManager.getCustomer(userId);

        if (!order || !customer) return false;

        // Only valid if we have complete customer info and valid payment
        return (
            order.progress &&
            order.progress.hasCustomerInfo &&
            order.progress.hasValidPayment &&
            !order.progress.isConfirmed
        );
    },
    handler: async (runtime: IAgentRuntime, message: Memory) => {
        elizaLogger.info("Confirming pizza order");
        const orderManager = new PizzaOrderManager(runtime);
        const userId = message.userId;
        const order = await orderManager.getOrder(userId);
        const customer = await orderManager.getCustomer(userId);

        try {
            elizaLogger.debug("Validating final order with Dominos");
            await order.validate();

            elizaLogger.debug("Getting final pricing");
            await order.price();

            elizaLogger.info("Placing final order with Dominos");
            await order.place();

            // Update order status and save
            order.status = OrderStatus.CONFIRMED;
            await orderManager.saveOrder(userId, order);

            elizaLogger.success(`🎉 Order confirmed! Order #${order.orderID}`);

            // Return confirmation message - Eliza will handle storing it
            return (
                `Great news! Your order has been confirmed and is being prepared.\n\n` +
                `Order Number: ${order.orderID}\n` +
                `Estimated Delivery Time: ${order.estimatedWaitMinutes} minutes\n\n` +
                orderManager.getOrderSummary(order, customer)
            );
        } catch (error) {
            elizaLogger.error("Failed to confirm order:", error);
            return "There was an issue placing your order: " + error.message;
        }
    }
};
