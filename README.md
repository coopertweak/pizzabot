# 🍕 Eliza with Dominos Plugin

This repository is a fork of the [Eliza AI Agent Framework](https://github.com/elizaos/eliza) that adds pizza ordering capabilities through Dominos Pizza integration.

## ⚠️ Security Warning

**IMPORTANT:** When handling personal information (addresses, payment details, etc.):
- DO NOT collect sensitive data in public channels ie twitter(X), discord, etc.
- Use private channels like:
  - Local private instance
  - Chats running on a personal server or a trusted execution environment (TEE)
- Consider implementing additional encryption for stored data

## 🚀 Features

All the powerful features of Eliza, plus:
- 🍕 Natural language pizza ordering
- 📝 Conversational order building
- 🏪 Store availability checking
- 🚗 Delivery validation
- 💳 Payment processing
- 📍 Location-based store finding

## 🛠️ Quick Start

### Prerequisites

- [Node.js 23+](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
- [pnpm 9+](https://pnpm.io/installation)
- Git for version control

### Installation

```bash
# Clone this repository
git clone [https://github.com/coopertweak/pizzabot.git]
cd pizzabot

# Install dependencies
pnpm install --no-frozen-lockfile

# Build the project
pnpm build

# Copy and configure environment
cp .env.example .env
```

### Configure Your Agent

1. Create a character file based on the templates in `characters/`
2. Add the Dominos plugin to your character configuration:

```json
{
  "name": "PizzaBot",
  "plugins": ["@ai16z/plugin-dominos"],
  // ... other character settings
}
```

### Start the Agent

```bash
# Start the agent
pnpm start --characters="characters/your-character.json"

# In a new terminal, start the client
pnpm start:client
# Use custom port if 3000 is in use when you start the agent
SERVER_PORT=3001 pnpm start:client
```

Visit `http://localhost:5173` (or the URL shown in your terminal) to interact with your agent.

## 🗣️ Example Pizza Ordering Conversation

```
User: "Can you order me a pizza?"
Agent: "I'll help you order a pizza! What's your delivery address?"

User: "123 Main St, Springfield IL"
Agent: "Great! Now I just need your name to continue with the order."

User: "John Smith"
Agent: "Thanks John! What size pizza would you like?"
```

## 🔧 Advanced Configuration

For Canadian orders:
```typescript
import { useInternational, canada } from 'dominos/utils/urls.js';
useInternational(canada);
```

## 🤝 Credits

This project builds upon the [Eliza AI Framework](https://github.com/elizaos/eliza). Visit their repository for the base framework documentation.

## 💬 Community & Support

- [Discord](https://discord.gg/ai16z) - For general discussion and help
- [GitHub Issues](https://github.com/coopertweak/pizzabot/issues) - For bug reports and feature requests

## 📝 License

MIT
