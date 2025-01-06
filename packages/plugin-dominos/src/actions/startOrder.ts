import { Action, ActionExample, IAgentRuntime, Memory, ModelClass, generateText } from "@elizaos/core";
import { PizzaOrderManager } from "../PizzaOrderManager";

const COLLECT_INFO_PROMPT = `
You are collecting information for a pizza order. Based on the conversation, determine what information is still needed.
Current information: {{currentInfo}}

The customer's last message: {{message}}

Respond with what information was provided and what is still needed.
Format your response as JSON:
{
    "provided": {
        "address": string | null,
        "name": string | null,
        "phone": string | null,
        "email": string | null
    },
    "nextPrompt": string // What to ask the customer next
}
`;

export const startOrder: Action = {
    name: "START_ORDER",
    description: "Starts a new pizza order and collects customer information",
    similes: ["BEGIN_ORDER", "NEW_ORDER"],
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "123 Main St, Springfield IL",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Great! Now I just need your name to continue with the order.",
                    action: "START_ORDER",
                },
            },
        ],
        // Add more examples...
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const orderManager = new PizzaOrderManager(runtime);
        const existingOrder = await orderManager.getOrder(message.userId);
        return !existingOrder; // Only valid if no existing order
    },
    handler: async (runtime: IAgentRuntime, message: Memory) => {
        // Get any existing customer info
        const customerInfo = await runtime.messageManager.getMemories({
            roomId: message.roomId,
            count: 1
        });

        const currentInfo = customerInfo.length > 0 ? customerInfo[0].content : {};

        // Generate response based on current info and message
        const context = COLLECT_INFO_PROMPT
            .replace('{{currentInfo}}', JSON.stringify(currentInfo))
            .replace('{{message}}', message.content.text);

        const response = await generateText({
            runtime,
            context,
            modelClass: ModelClass.LARGE,
        });

        try {
            const parsed = JSON.parse(response);

            // Update customer info with any new information
            if (Object.keys(parsed.provided).some(key => parsed.provided[key])) {
                await runtime.messageManager.createMemory({
                    userId: message.userId,
                    roomId: message.roomId,
                    agentId: runtime.agentId,
                    content: {
                        ...currentInfo,
                        ...parsed.provided
                    }
                });
            }

            // Check if we have all required info
            const hasAllInfo = ['address', 'name', 'phone', 'email']
                .every(key => parsed.provided[key] || (currentInfo && currentInfo[key]));

            if (hasAllInfo) {
                // Start collecting order details
                return "Great! Now let's build your pizza. What size would you like? We have Small, Medium, Large, and Extra Large.";
            }

            // Ask for next piece of information
            return parsed.nextPrompt;
        } catch (error) {
            console.error("Error parsing response:", error);
            return "I'm sorry, I had trouble processing that. Could you please provide your delivery address?";
        }
    }
};
