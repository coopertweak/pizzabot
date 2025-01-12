import { Action, IAgentRuntime, Memory } from "@elizaos/core";
import { PizzaOrderManager } from "../PizzaOrderManager";
import { OrderStatus, Order } from "../types";
import { elizaLogger } from "@elizaos/core";

export const confirmOrder: Action = {
    name: "CONFIRM_ORDER",
    similes: ["FINALIZE_ORDER", "FINISH_ORDER", "PLACE_ORDER"],
    examples: [
        // TODO
    ],
    description: "Confirms and places the final order with Dominos",
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

            // Update order status
            order.status = OrderStatus.CONFIRMED;

            // Store order details in memory for tracking
            await runtime.messageManager.createMemory({
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                content: {
                    text: `Order #${order.orderID} confirmed`,
                    type: 'order',
                    orderID: order.orderID,
                    status: order.status,
                    estimatedWaitMinutes: order.estimatedWaitMinutes,
                    total: order.total
                }
            });

            await orderManager.saveOrder(userId, order);

            elizaLogger.success(`🎉 Order confirmed! Order #${order.orderID}`);
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
    },
};
