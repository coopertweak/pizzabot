import { Action, IAgentRuntime, Memory, elizaLogger } from "@elizaos/core";
import { PizzaOrderManager } from "../PizzaOrderManager";

export const startOrder: Action = {
    name: "START_ORDER",
    description: "Starts a new pizza order",
    similes: ["BEGIN_ORDER", "NEW_ORDER"],
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "I want to order a pizza",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll help you order a pizza. What's your delivery address?",
                    action: "START_ORDER",
                },
            },
        ],
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        return true; // Let Eliza handle the conversation flow
    },
    handler: async (runtime: IAgentRuntime, message: Memory) => {
        elizaLogger.info("Starting new pizza order");
        const orderManager = new PizzaOrderManager(runtime);

        // Let the order manager create a new order with proper initialization
        await orderManager.initializeOrder(message.userId);

        return "I'll help you order a pizza. What's your delivery address?";
    }
};
