import { IAgentRuntime, Memory, Provider } from "@elizaos/core";
import { PizzaOrderManager } from "../PizzaOrderManager";
import { OrderStatus, PaymentStatus } from "../types";

export const pizzaOrderProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory) => {
        const orderManager = new PizzaOrderManager(runtime);

        const userId = message.userId;
        const order = await orderManager.getOrder(userId);
        const customer = await orderManager.getCustomer(userId);
        if (!order) {
            return "No active pizza order. The customer needs to start a new order.";
        }

        // Add payment-specific status to context
        let context = "\nPAYMENT STATUS:\n";
        context += `Current Status: ${order.paymentStatus}\n`;
        if (order.paymentStatus === PaymentStatus.NOT_PROVIDED) {
            context += "Payment information needed to complete order.\n";
        } else if (order.paymentStatus === PaymentStatus.INVALID) {
            context += "Previous payment method was invalid. Please provide new payment information.\n";
        }

        // Add clearer next action guidance
        if (order.status === OrderStatus.AWAITING_PAYMENT) {
            context += "\nREQUIRED: Please provide credit card information to complete your order.\n";
        } else if (order.status === OrderStatus.PROCESSING) {
            context += "\nREQUIRED: Please review your order and confirm to place it.\n";
        }

        context += "=== PIZZA ORDER STATUS ===\n\n";

        // Add order summary
        context += orderManager.getOrderSummary(order, customer);

        // Add next required action
        context += "\nNEXT REQUIRED ACTION:\n";
        context += orderManager.getNextRequiredAction(order, customer);

        return context;
    }
};
