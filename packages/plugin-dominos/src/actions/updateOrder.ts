import { Action, ActionExample, IAgentRuntime, Memory, ModelClass, generateText } from "@elizaos/core";
import { PizzaOrderManager } from "../PizzaOrderManager";
import { PizzaSize, PizzaCrust, ToppingPortion, OrderItem } from "../types";

const PIZZA_BUILD_PROMPT = `
Based on the conversation and current order state, determine what pizza details were specified and what still needs to be asked.

Current order state: {{orderState}}
Customer message: {{message}}

Format your response as JSON:
{
    "updates": {
        "size": "SMALL" | "MEDIUM" | "LARGE" | "XLARGE" | null,
        "crust": "HAND_TOSSED" | "THIN" | "PAN" | "GLUTEN_FREE" | "BROOKLYN" | null,
        "toppings": [
            {
                "code": string,
                "portion": "LEFT" | "RIGHT" | "ALL",
                "amount": 1 | 2
            }
        ] | null,
        "quantity": number | null
    },
    "nextPrompt": string // What to ask the customer next
}
`;

export const updateOrder: Action = {
    name: "UPDATE_ORDER",
    description: "Updates the current pizza order with size, crust, toppings, or quantity",
    similes: ["MODIFY_ORDER", "CHANGE_ORDER"],
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "I want a large pizza",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "What type of crust would you like? We have Hand Tossed, Thin, Pan, Brooklyn, or Gluten Free.",
                    action: "UPDATE_ORDER",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Make it thin crust with pepperoni",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I've added pepperoni to your thin crust pizza. Would you like any additional toppings?",
                    action: "UPDATE_ORDER",
                },
            },
        ],
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const orderManager = new PizzaOrderManager(runtime);
        const order = await orderManager.getOrder(message.userId);
        return !!order; // Only valid if there's an active order
    },
    handler: async (runtime: IAgentRuntime, message: Memory) => {
        const orderManager = new PizzaOrderManager(runtime);
        const order = await orderManager.getOrder(message.userId);

        // Get current order state
        const orderState = {
            items: order?.items || [],
            currentItem: order?.items?.[order.items.length - 1] || {}
        };

        // Generate response based on current state and message
        const context = PIZZA_BUILD_PROMPT
            .replace('{{orderState}}', JSON.stringify(orderState))
            .replace('{{message}}', message.content.text);

        const response = await generateText({
            runtime,
            context,
            modelClass: ModelClass.LARGE,
        });

        try {
            const parsed = JSON.parse(response);

            // Apply updates to the order
            if (parsed.updates) {
                if (!order.items) {
                    order.items = [];
                }

                let currentItem: OrderItem = order.items[order.items.length - 1] || {
                    productCode: 'PIZZA',
                    size: null,
                    crust: null,
                    toppings: [],
                    quantity: 0
                };

                if (parsed.updates.size) currentItem.size = parsed.updates.size;
                if (parsed.updates.crust) currentItem.crust = parsed.updates.crust;
                if (parsed.updates.toppings) currentItem.toppings = parsed.updates.toppings;
                if (parsed.updates.quantity) currentItem.quantity = parsed.updates.quantity;

                // If this is a new item, add it to the order
                if (order.items.length === 0 ||
                    (currentItem.size && currentItem.crust)) {
                    order.items.push(currentItem);
                } else {
                    // Update existing item
                    order.items[order.items.length - 1] = currentItem;
                }

                await orderManager.saveOrder(message.userId, order);
            }

            return parsed.nextPrompt;
        } catch (error) {
            console.error("Error updating order:", error);
            return "I had trouble understanding that. Could you please specify what you'd like for your pizza?";
        }
    }
};
