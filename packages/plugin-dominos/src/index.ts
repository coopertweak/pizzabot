import { Plugin } from "@elizaos/core";
import { startOrder } from "./actions/startOrder";
import { pizzaOrderProvider } from "./providers/pizzaOrder";
import { endOrder } from "./actions/endOrder";
import { updateCustomer } from "./actions/updateCustomer";
import { updateOrder } from "./actions/updateOrder";
import { confirmOrder } from "./actions/confirmOrder";
import { detectPizzaIntent } from "./actions/detectPizzaIntent";

export * as actions from "./actions";
export * as providers from "./providers";

export const dominosPlugin: Plugin = {
    name: "dominos",
    description: "Order a dominos pizza",
    actions: [
        detectPizzaIntent,
        startOrder,
        endOrder,
        updateCustomer,
        updateOrder,
        confirmOrder
    ],
    providers: [pizzaOrderProvider],
};
