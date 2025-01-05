# 🍕 Dominos Pizza Plugin

A plugin for the Eliza framework that enables pizza ordering capabilities through Dominos Pizza.

## 📦 Installation

```bash
pnpm add @ai16z/plugin-dominos
```

## 🚀 Usage

Add the plugin to your character configuration:

```typescript
import { dominosPlugin } from "@ai16z/plugin-dominos";

const character = {
    name: "Your Character",
    // ... other character config
    plugins: [dominosPlugin]
};
```

## 🛠️ Features

- 🔍 Natural language pizza order detection
- 📝 Conversational order building
- 🏪 Automatic store availability checking
- 🚗 Delivery validation
- ⏰ Rate limiting protection
- 💳 Payment processing
- 📍 Location-based store finding

## 🗣️ Example Conversation

```
User: "Can you order me a pizza?"
Agent: "I'll help you order a pizza! First, I'll need some information. What's your delivery address?"

User: "123 Main St, Springfield IL"
Agent: "Great! Now I just need your name to continue with the order."

User: "John Smith"
Agent: "Thanks John! What size pizza would you like? We have Small, Medium, Large, and Extra Large."

User: "Large with pepperoni"
Agent: "I've added a large pizza with pepperoni. Would you like any additional toppings?"
```

## 🔧 Configuration

The plugin automatically uses Dominos USA endpoints by default. For Canadian orders:

```typescript
import { useInternational, canada } from 'dominos/utils/urls.js';

// Set to use Canadian endpoints
useInternational(canada);
```

## 🤝 Actions

- `DETECT_PIZZA_INTENT` - Identifies pizza ordering requests
- `START_ORDER` - Initiates the order process
- `UPDATE_ORDER` - Modifies the current order
- `UPDATE_CUSTOMER` - Updates customer information
- `CONFIRM_ORDER` - Finalizes and places the order
- `END_ORDER` - Cancels or completes the order

## 📝 License

MIT

## 🔗 Links

- [Eliza Documentation](https://elizaos.github.io/eliza/)
- [Dominos API Documentation](https://github.com/RIAEvangelist/node-dominos-pizza-api)