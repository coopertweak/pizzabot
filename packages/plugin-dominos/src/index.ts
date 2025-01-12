import { Plugin } from "@elizaos/core";
import { startOrder } from "./actions/startOrder";
import { pizzaOrderProvider } from "./providers/pizzaOrder";
import { endOrder } from "./actions/endOrder";
import { updateCustomer } from "./actions/updateCustomer";
import { updateOrder } from "./actions/updateOrder";
import { confirmOrder } from "./actions/confirmOrder";
import { detectPizzaIntent } from "./actions/detectPizzaIntent";
import { trackOrder } from "./actions/trackOrder";

// Export plugin as default
export default {
    name: "dominos",
    description: "Order a dominos pizza",
    actions: [
        detectPizzaIntent,
        startOrder,
        endOrder,
        updateCustomer,
        updateOrder,
        confirmOrder,
        trackOrder
    ],
    providers: [pizzaOrderProvider],
} as Plugin;
