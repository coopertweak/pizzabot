import {
    Action,
    ActionExample,
    generateText,
    IAgentRuntime,
    Memory,
    ModelClass,
} from "@elizaos/core";
import { PizzaOrderManager } from "../PizzaOrderManager";

const PIZZA_INTENT_PROMPT = `
You are checking to see if someone is asking you to order a pizza.
They should explicitly ask for a pizza order.

Here is their message:
{{text}}

The available options are [YES] or [NO]. Choose the most appropriate option.
Your response must include one of the options.`;

const parsePizzaIntent = (text: string): "YES" | "NO" | null => {
    const match = text
        .split('\n')[0]
        .trim()
        .replace("[", "")
        .toUpperCase()
        .replace("]", "")
        .match(/^(YES|NO)$/i);
    return match
        ? (match[0].toUpperCase() as "YES" | "NO")
        : text.includes("YES") ? "YES" : text.includes("NO") ? "NO" : null;
};

export const detectPizzaIntent: Action = {
    name: "DETECT_PIZZA_INTENT",
    description: "Detects if a user is requesting to order pizza",
    similes: ["CHECK_PIZZA_ORDER", "PIZZA_INTENT"],
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Can you order me a pizza?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll help you order a pizza! What size would you like?",
                    action: "START_ORDER",
                },
            },
        ],
        // Add more examples...
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        // Validate that pizza ordering is configured
        return !!runtime.getSetting('API_BASE_URL');
    },
    handler: async (runtime: IAgentRuntime, message: Memory) => {
        const context = PIZZA_INTENT_PROMPT.replace('{{text}}', message.content.text);

        const response = await generateText({
            runtime,
            context,
            modelClass: ModelClass.LARGE,
        });

        const result = parsePizzaIntent(response);

        if (result === "YES") {
            // Instead of checking settings, we should check the memory system
            // for previously collected customer information
            const customerInfo = await runtime.messageManager.getMemories({
                roomId: message.roomId,
                count: 1
            });

            if (!customerInfo || customerInfo.length === 0) {
                // No stored customer info, start collecting it
                return "I'll help you order a pizza! First, I'll need some information. What's your delivery address?";
            }

            if (!customerInfo[0]?.content?.address || typeof customerInfo[0].content.address !== 'string') {
                return "I need your delivery address to check store availability.";
            }

            const orderManager = new PizzaOrderManager(runtime);
            const availability = await orderManager.validateStoreAvailability(customerInfo[0].content.address);

            if (!availability.isAvailable) {
                return availability.message;
            }

            // Store is available, trigger the START_ORDER action with customer info
            await runtime.processActions(
                {
                    ...message,
                    content: {
                        ...message.content,
                        storeId: availability.storeId,
                        customerInfo: customerInfo[0].content,
                        action: "START_ORDER"
                    }
                },
                []
            );
            return null;
        }

        return null;
    }
};