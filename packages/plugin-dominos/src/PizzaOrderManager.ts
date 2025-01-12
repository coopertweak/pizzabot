import { IAgentRuntime, elizaLogger } from "@elizaos/core";
import {
    Customer,
    ErrorType,
    Order,
    OrderError,
    OrderItem,
    OrderManager,
    OrderProgress,
    OrderRequest,
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    PizzaCrust,
    PizzaSize,
    PizzaTopping,
    ToppingPortion,
    DominosPayment,
    DominosAddress,
    DominosProduct
} from "./types";
import { RateLimiter } from "./utils/RateLimiter";
import { urls } from 'dominos';
import { useInternational, canada, usa } from 'dominos/utils/urls.js';
import { NearbyStores } from 'dominos';
import { Menu, Store } from 'dominos';

export class PizzaOrderManager implements OrderManager {
    storeId: string = "";

    // System state
    availability = {
        isStoreOpen: true,
        isDeliveryAvailable: true,
        isCarryoutAvailable: true,
    };

    // Required field configuration
    requiredFields = {
        requiresCustomerName: true,
        requiresAddress: true,
        requiresPayment: true,
        requiresPhone: true,
        requiresEmail: true,
    };

    // Payment configuration
    paymentConfig = {
        acceptsCash: false,
        acceptsCredit: true,
        requiresCVV: true,
        requiresPostalCode: true,
        maxFailedAttempts: 3,
    };

    // Menu configuration
    private readonly menuConfig = {
        defaultProductCode: "PIZZA",
        basePrices: {
            [PizzaSize.SMALL]: 9.99,
            [PizzaSize.MEDIUM]: 11.99,
            [PizzaSize.LARGE]: 13.99,
            [PizzaSize.XLARGE]: 15.99,
        },
        crustPrices: {
            [PizzaCrust.HAND_TOSSED]: 0,
            [PizzaCrust.THIN]: 0,
            [PizzaCrust.PAN]: 1.0,
            [PizzaCrust.GLUTEN_FREE]: 2.5,
            [PizzaCrust.BROOKLYN]: 1.5,
        },
        toppingPrices: {
            STANDARD: 1.5,
            PREMIUM: 2.5,
            SPECIALTY: 3.5,
        },
        toppingCategories: {
            STANDARD: [
                "PEPPERONI",
                "MUSHROOMS",
                "ONIONS",
                "GREEN_PEPPERS",
                "BLACK_OLIVES",
                "TOMATOES",
            ],
            PREMIUM: [
                "ITALIAN_SAUSAGE",
                "BACON",
                "EXTRA_CHEESE",
                "GROUND_BEEF",
                "HAM",
                "PINEAPPLE",
                "JALAPENOS",
            ],
            SPECIALTY: [
                "GRILLED_CHICKEN",
                "PHILLY_STEAK",
                "FETA_CHEESE",
                "SPINACH",
                "ANCHOVIES",
                "ARTICHOKE_HEARTS",
            ],
        },
        availableToppings: {
            // Standard Toppings
            PEPPERONI: "Pepperoni",
            MUSHROOMS: "Fresh Mushrooms",
            ONIONS: "Fresh Onions",
            GREEN_PEPPERS: "Green Peppers",
            BLACK_OLIVES: "Black Olives",
            TOMATOES: "Diced Tomatoes",
            // Premium Toppings
            ITALIAN_SAUSAGE: "Italian Sausage",
            BACON: "Applewood Smoked Bacon",
            EXTRA_CHEESE: "Extra Cheese Blend",
            GROUND_BEEF: "Seasoned Ground Beef",
            HAM: "Premium Ham",
            PINEAPPLE: "Sweet Pineapple",
            JALAPENOS: "Fresh Jalapeños",
            // Specialty Toppings
            GRILLED_CHICKEN: "Grilled Chicken Breast",
            PHILLY_STEAK: "Premium Philly Steak",
            FETA_CHEESE: "Feta Cheese",
            SPINACH: "Fresh Baby Spinach",
            ANCHOVIES: "Premium Anchovies",
            ARTICHOKE_HEARTS: "Artichoke Hearts",
        },
        specialCombos: {
            MEAT_LOVERS: {
                name: "Meat Lovers",
                discount: 2.0,
                requiredToppings: [
                    "PEPPERONI",
                    "ITALIAN_SAUSAGE",
                    "BACON",
                    "HAM",
                ],
            },
            VEGGIE_SUPREME: {
                name: "Veggie Supreme",
                discount: 2.0,
                requiredToppings: [
                    "MUSHROOMS",
                    "GREEN_PEPPERS",
                    "ONIONS",
                    "BLACK_OLIVES",
                    "TOMATOES",
                ],
            },
            HAWAIIAN: {
                name: "Hawaiian",
                discount: 1.5,
                requiredToppings: ["HAM", "PINEAPPLE"],
            },
            SUPREME: {
                name: "Supreme",
                discount: 3.0,
                requiredToppings: [
                    "PEPPERONI",
                    "ITALIAN_SAUSAGE",
                    "MUSHROOMS",
                    "ONIONS",
                    "GREEN_PEPPERS",
                ],
            },
        },
        incompatibleToppings: [
            ["ANCHOVIES", "CHICKEN"],
            ["PINEAPPLE", "ANCHOVIES"],
            ["ARTICHOKE_HEARTS", "GROUND_BEEF"],
        ],
    };

    // API Configuration
    private readonly BASE_URL = urls.order;
    private readonly TRACKER_URL = urls.tracker;

    private readonly headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Referer': 'order.dominos.com'
    };

    private readonly trackerHeaders = {
        'dpz-language': 'en',
        'dpz-market': 'UNITED_STATES',
        'Accept': 'application/json',
        'Content-Type': 'application/json; charset=utf-8'
    };

    private static rateLimiter = new RateLimiter({
        maxRequests: 10,  // Maximum requests per window
        timeWindow: 60000 // Time window in milliseconds (1 minute)
    });

    private menu: any = null;

    constructor(private runtime: IAgentRuntime) {
        elizaLogger.info("Initializing PizzaOrderManager");
        useInternational(usa);
    }

    // Helper Methods
    private getRequiredSetting(name: string): string {
        const value = this.runtime.getSetting(name);
        if (!value) {
            throw new Error(`Required setting ${name} is not configured`);
        }
        return value;
    }

    private getToppingInfo(toppingCode: string): {
        category: string;
        price: number;
    } {
        if (this.menuConfig.toppingCategories.STANDARD.includes(toppingCode)) {
            return {
                category: "STANDARD",
                price: this.menuConfig.toppingPrices.STANDARD,
            };
        }
        if (this.menuConfig.toppingCategories.PREMIUM.includes(toppingCode)) {
            return {
                category: "PREMIUM",
                price: this.menuConfig.toppingPrices.PREMIUM,
            };
        }
        if (this.menuConfig.toppingCategories.SPECIALTY.includes(toppingCode)) {
            return {
                category: "SPECIALTY",
                price: this.menuConfig.toppingPrices.SPECIALTY,
            };
        }
        throw new Error(`Invalid topping code: ${toppingCode}`);
    }

    private checkSpecialCombos(toppings: PizzaTopping[]): number {
        const toppingCodes = toppings.map((t) => t.code);
        let maxDiscount = 0;

        for (const [_, combo] of Object.entries(this.menuConfig.specialCombos)) {
            if (combo.requiredToppings.every((t) => toppingCodes.includes(t))) {
                maxDiscount = Math.max(maxDiscount, combo.discount);
            }
        }

        return maxDiscount;
    }

    private formatCurrency(amount: number): string {
        return `$${amount?.toFixed(2) || "?"}`;
    }

    private formatTopping(topping: PizzaTopping): string {
        const toppingInfo = this.getToppingInfo(topping.code);
        const amount = topping.amount > 1 ? "Extra " : "";
        const portion =
            topping.portion === ToppingPortion.ALL
                ? "Whole Pizza"
                : `${topping.portion} Half`;
        const category =
            toppingInfo.category.charAt(0) +
            toppingInfo.category.slice(1).toLowerCase();

        return (
            `${amount}${this.menuConfig.availableToppings[topping.code]} ` +
            `(${portion}) - ${category} Topping`
        );
    }

    // Cache Methods
    async getOrder(userId: string): Promise<Order | null> {
        return this.runtime.cacheManager.get(`order:${userId}`);
    }

    async saveOrder(userId: string, order: Order): Promise<void> {
        await this.runtime.cacheManager.set(`order:${userId}`, order);
    }

    async getCustomer(userId: string): Promise<Customer | null> {
        return this.runtime.cacheManager.get(`customer:${userId}`);
    }

    async saveCustomer(userId: string, customer: Customer): Promise<void> {
        await this.runtime.cacheManager.set(`customer:${userId}`, customer);
    }

    // API Integration Methods
    private async findNearestStore(address: string, city: string, state: string): Promise<any> {
        const encodedAddress = encodeURIComponent(address);
        const encodedCityState = encodeURIComponent(`${city}, ${state}`);
        const url = `${this.BASE_URL}/store-locator?s=${encodedAddress}&c=${encodedCityState}&type=Delivery`;

        const response = await fetch(url, {
            method: 'GET',
            headers: this.headers
        });
        return response.json();
    }

    private async getStoreInfo(storeId: string): Promise<any> {
        const url = `${this.BASE_URL}/store/${storeId}/profile`;
        const response = await fetch(url, {
            method: 'GET',
            headers: this.headers
        });
        return response.json();
    }

    private async validateOrderWithAPI(orderRequest: OrderRequest): Promise<any> {
        const url = `${this.BASE_URL}/validate-order`;
        const response = await fetch(url, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({ Order: orderRequest })
        });
        return response.json();
    }

    private async priceOrderWithAPI(orderRequest: OrderRequest): Promise<any> {
        const url = `${this.BASE_URL}/price-order`;
        const response = await fetch(url, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({ Order: orderRequest })
        });
        return response.json();
    }

    private async placeOrderWithAPI(orderRequest: OrderRequest): Promise<any> {
        const url = `${this.BASE_URL}/place-order`;
        const response = await fetch(url, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({ Order: orderRequest })
        });
        return response.json();
    }

    private async trackOrderWithAPI(phoneNumber: string): Promise<any> {
        const url = `${this.TRACKER_URL}/orders?phonenumber=${phoneNumber.replace(/\D/g, '')}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: this.trackerHeaders
        });
        return response.json();
    }

    // Validation Methods
    private validateToppings(toppings: PizzaTopping[]): OrderError | null {
        for (const topping of toppings) {
            if (!this.menuConfig.availableToppings[topping.code]) {
                return {
                    type: ErrorType.VALIDATION_FAILED,
                    message: `Invalid topping code: ${topping.code}`,
                    code: "INVALID_TOPPING",
                };
            }

            if (!Object.values(ToppingPortion).includes(topping.portion)) {
                return {
                    type: ErrorType.VALIDATION_FAILED,
                    message: `Invalid topping portion: ${topping.portion}`,
                    code: "INVALID_PORTION",
                };
            }

            if (topping.amount !== 1 && topping.amount !== 2) {
                return {
                    type: ErrorType.VALIDATION_FAILED,
                    message: "Topping amount must be 1 (normal) or 2 (extra)",
                    code: "INVALID_AMOUNT",
                };
            }
        }

        if (toppings.length > 10) {
            return {
                type: ErrorType.VALIDATION_FAILED,
                message: "Maximum of 10 toppings per pizza",
                code: "TOO_MANY_TOPPINGS",
            };
        }

        return null;
    }

    private validateCustomerInfo(customer: Customer): OrderError | null {
        const phoneRegex = /^\d{3}[-.]?\d{3}[-.]?\d{4}$/;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const nameRegex = /^[a-zA-Z0-9\s'-]{2,50}$/;

        if (!customer.name || !nameRegex.test(customer.name)) {
            return {
                type: ErrorType.VALIDATION_FAILED,
                message: "Please provide a valid name (2-50 characters)",
                code: "INVALID_NAME",
            };
        }

        if (!customer.phone || !phoneRegex.test(customer.phone)) {
            return {
                type: ErrorType.VALIDATION_FAILED,
                message: "Please provide a valid 10-digit phone number",
                code: "INVALID_PHONE",
            };
        }

        if (!customer.email || !emailRegex.test(customer.email)) {
            return {
                type: ErrorType.VALIDATION_FAILED,
                message: "Please provide a valid email address",
                code: "INVALID_EMAIL",
            };
        }

        if (!customer.address || customer.address.length < 10) {
            return {
                type: ErrorType.VALIDATION_FAILED,
                message: "Please provide a complete delivery address",
                code: "INVALID_ADDRESS",
            };
        }

        return null;
    }

    private validatePaymentMethod(payment: PaymentMethod): OrderError | null {
        const cardNumberRegex = /^\d{16}$/;
        const cvvRegex = /^\d{3,4}$/;
        const expiryRegex = /^(0[1-9]|1[0-2])\/([0-9]{2})$/;
        const postalRegex = /^\d{5}(-\d{4})?$/;

        if (!payment.cardNumber || !cardNumberRegex.test(payment.cardNumber)) {
            return {
                type: ErrorType.PAYMENT_FAILED,
                message: "Please provide a valid 16-digit credit card number",
                code: "INVALID_CARD_NUMBER",
            };
        }

        if (!payment.expiryDate || !expiryRegex.test(payment.expiryDate)) {
            return {
                type: ErrorType.PAYMENT_FAILED,
                message: "Please provide a valid expiration date (MM/YY)",
                code: "INVALID_EXPIRY",
            };
        }

        // Check if card is expired
        if (payment.expiryDate) {
            const [month, year] = payment.expiryDate.split("/");
            const expiry = new Date(2000 + parseInt(year), parseInt(month) - 1);
            if (expiry < new Date()) {
                return {
                    type: ErrorType.PAYMENT_FAILED,
                    message: "The card has expired",
                    code: "CARD_EXPIRED",
                };
            }
        }

        if (!payment.cvv || !cvvRegex.test(payment.cvv)) {
            return {
                type: ErrorType.PAYMENT_FAILED,
                message: "Please provide a valid CVV (3-4 digits)",
                code: "INVALID_CVV",
            };
        }

        if (
            this.paymentConfig.requiresPostalCode &&
            (!payment.postalCode || !postalRegex.test(payment.postalCode))
        ) {
            return {
                type: ErrorType.PAYMENT_FAILED,
                message: "Please provide a valid postal code",
                code: "INVALID_POSTAL",
            };
        }

        return null;
    }

    private async getMenu(): Promise<any> {
        if (!this.menu) {
            if (!this.storeId) {
                elizaLogger.error("Failed to get menu - no store ID set");
                throw new Error("Store ID must be set before getting menu");
            }
            elizaLogger.debug(`Fetching menu for store ${this.storeId}`);
            this.menu = await new Menu(this.storeId);
            elizaLogger.success(`Menu fetched successfully for store ${this.storeId}`);
        }
        return this.menu;
    }

    private async calculatePizzaPrice(item: OrderItem): Promise<number> {
        try {
            elizaLogger.debug(`Calculating price for order item:`, item);
            const dominosProduct = this.convertItemToProduct(item);

            const tempOrder = {
                StoreID: this.storeId,
                Products: [dominosProduct]
            };

            elizaLogger.debug("Requesting price from Dominos API");
            const response = await fetch(`${this.BASE_URL}/price-order`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({ Order: tempOrder })
            });

            const priceData = await response.json();

            if (priceData.Status !== 'Success') {
                elizaLogger.error("Price calculation failed:", priceData.StatusItems.join(', '));
                throw new Error(`Failed to get price: ${priceData.StatusItems.join(', ')}`);
            }

            elizaLogger.success(`Price calculated: $${priceData.Order.Amounts.Customer}`);
            return priceData.Order.Amounts.Customer;

        } catch (error) {
            elizaLogger.error("Error calculating pizza price:", error);
            throw error;
        }
    }

    private convertItemToProduct(item: OrderItem): DominosProduct {
        const sizeMap = {
            [PizzaSize.SMALL]: '10',
            [PizzaSize.MEDIUM]: '12',
            [PizzaSize.LARGE]: '14',
            [PizzaSize.XLARGE]: '16'
        };

        const crustMap = {
            [PizzaCrust.HAND_TOSSED]: 'HANDTOSS',
            [PizzaCrust.THIN]: 'THIN',
            [PizzaCrust.PAN]: 'PAN',
            [PizzaCrust.GLUTEN_FREE]: 'GLUTENF',
            [PizzaCrust.BROOKLYN]: 'BK'
        };

        const code = `${sizeMap[item.size]}${crustMap[item.crust]}`;
        const options: { [key: string]: { [key: string]: string } } = {
            C: { '1/1': '1' }, // Base cheese
        };

        item.toppings?.forEach((topping) => {
            const coverage = topping.portion === ToppingPortion.ALL ? '1/1' : '1/2';
            options[topping.code] = { [coverage]: topping.amount.toString() };
        });

        return {
            Code: code,
            Options: options
        };
    }

    private convertToOrderRequest(order: Order, customer: Customer): OrderRequest {
        const [firstName, ...lastNameParts] = customer.name.split(' ');
        const lastName = lastNameParts.join(' ');

        const addressParts = customer.address.split(',').map(part => part.trim());
        const street = addressParts[0];
        const cityStateZip = addressParts[1].split(' ');
        const postalCode = cityStateZip.pop() || '';
        const state = cityStateZip.pop() || '';
        const city = cityStateZip.join(' ');

        const orderRequest: OrderRequest = {
            Address: {
                Street: street,
                City: city,
                Region: state,
                PostalCode: postalCode
            },
            StoreID: this.storeId,
            Products: order.items?.map(item => this.convertItemToProduct(item)) || [],
            OrderChannel: 'OLO',
            OrderMethod: 'Web',
            LanguageCode: 'en',
            ServiceMethod: 'Delivery',
            FirstName: firstName,
            LastName: lastName,
            Email: customer.email,
            Phone: customer.phone
        };

        if (order.paymentMethod && order.paymentMethod.cardNumber) {
            orderRequest.Payments = [{
                Type: 'CreditCard',
                Amount: order.total,
                CardType: this.detectCardType(order.paymentMethod.cardNumber),
                Number: order.paymentMethod.cardNumber,
                Expiration: order.paymentMethod.expiryDate?.replace('/', '') || '',
                SecurityCode: order.paymentMethod.cvv || '',
                PostalCode: order.paymentMethod.postalCode || '',
                TipAmount: 0
            }];
        }

        return orderRequest;
    }

    private detectCardType(cardNumber: string): string {
        if (cardNumber.startsWith('4')) return 'VISA';
        if (cardNumber.startsWith('5')) return 'MASTERCARD';
        if (cardNumber.startsWith('34') || cardNumber.startsWith('37')) return 'AMEX';
        if (cardNumber.startsWith('6')) return 'DISCOVER';
        return 'UNKNOWN';
    }

    async getNearestStoreId(address: string): Promise<string> {
        try {
            const parts = address.split(',').map(part => part.trim());
            const street = parts[0];
            const cityState = parts[1].split(' ');
            const state = cityState.pop() || '';
            const city = cityState.join(' ');

            const storeResponse = await this.findNearestStore(street, city, state);

            if (!storeResponse.Stores || storeResponse.Stores.length === 0) {
                throw new Error("No nearby stores found.");
            }

            const deliveryStore = storeResponse.Stores.find((store: any) =>
                store.IsOnlineCapable &&
                store.IsDeliveryStore &&
                store.IsOpen &&
                store.ServiceIsOpen.Delivery
            );

            if (!deliveryStore) {
                throw new Error("No open stores found for delivery.");
            }

            this.storeId = deliveryStore.StoreID;
            return this.storeId;

        } catch (error) {
            console.error("Error finding nearest store:", error);
            throw error;
        }
    }

    async processOrder(order: Order, customer: Customer): Promise<Order | OrderError> {
        elizaLogger.info("Processing new order:", {
            customerName: customer.name,
            items: order.items?.length
        });

        try {
            // Check rate limit before processing
            if (!await PizzaOrderManager.rateLimiter.tryAcquire()) {
                return {
                    type: ErrorType.VALIDATION_FAILED,
                    message: "Too many orders. Please try again in a few minutes.",
                    code: "RATE_LIMIT_EXCEEDED"
                };
            }

            // Validate customer information
            const customerError = this.validateCustomerInfo(customer);
            if (customerError) return customerError;

            // Validate order items
            if (order.items) {
                for (const item of order.items) {
                    // Validate size
                    if (!Object.values(PizzaSize).includes(item.size)) {
                        return {
                            type: ErrorType.VALIDATION_FAILED,
                            message: `Invalid pizza size: ${item.size}`,
                            code: "INVALID_SIZE",
                        };
                    }

                    // Validate crust
                    if (!Object.values(PizzaCrust).includes(item.crust)) {
                        return {
                            type: ErrorType.VALIDATION_FAILED,
                            message: `Invalid crust type: ${item.crust}`,
                            code: "INVALID_CRUST",
                        };
                    }

                    // Validate toppings
                    if (item.toppings) {
                        const toppingError = this.validateToppings(item.toppings);
                        if (toppingError) return toppingError;
                    }

                    // Validate quantity
                    if (item.quantity < 1 || item.quantity > 10) {
                        return {
                            type: ErrorType.VALIDATION_FAILED,
                            message: "Quantity must be between 1 and 10",
                            code: "INVALID_QUANTITY",
                        };
                    }
                }
            }

            // Get store ID if not already set
            if (!this.storeId) {
                elizaLogger.debug("Finding nearest store for address:", customer.address);
                this.storeId = await this.getNearestStoreId(customer.address);
                elizaLogger.success(`Found nearest store: ${this.storeId}`);
            }

            // Convert to API format
            const orderRequest = this.convertToOrderRequest(order, customer);

            // Validate with API
            elizaLogger.debug("Validating order with Dominos API");
            const validatedOrder = await this.validateOrderWithAPI(orderRequest);
            if (validatedOrder.Status !== 'Success') {
                elizaLogger.error("Order validation failed:", validatedOrder.StatusItems);
                return {
                    type: ErrorType.VALIDATION_FAILED,
                    message: validatedOrder.StatusItems.join(', '),
                    code: 'API_VALIDATION_FAILED'
                };
            }
            elizaLogger.success("Order validation successful");

            // Price the order
            elizaLogger.debug("Getting final price from Dominos API");
            const pricedOrder = await this.priceOrderWithAPI(orderRequest);
            if (pricedOrder.Status !== 'Success') {
                elizaLogger.error("Order pricing failed:", pricedOrder.StatusItems);
                return {
                    type: ErrorType.VALIDATION_FAILED,
                    message: pricedOrder.StatusItems.join(', '),
                    code: 'API_PRICING_FAILED'
                };
            }
            elizaLogger.success(`Order priced successfully: $${pricedOrder.Order.Amounts.Customer}`);

            // Update total with API price
            order.total = pricedOrder.Order.Amounts.Customer;

            // If payment is provided and valid, attempt to place order
            if (order.paymentMethod) {
                elizaLogger.debug("Validating payment method");
                const paymentError = this.validatePaymentMethod(order.paymentMethod);
                if (paymentError) {
                    elizaLogger.error("Payment validation failed:", paymentError);
                    order.paymentStatus = PaymentStatus.INVALID;
                    return paymentError;
                }
                elizaLogger.success("Payment validation successful");

                elizaLogger.info("Placing final order with Dominos");
                const placedOrder = await this.placeOrderWithAPI(orderRequest);
                if (placedOrder.Status !== 'Success') {
                    elizaLogger.error("Order placement failed:", placedOrder.StatusItems);
                    return {
                        type: ErrorType.PAYMENT_FAILED,
                        message: placedOrder.StatusItems.join(', '),
                        code: 'API_ORDER_FAILED'
                    };
                }

                elizaLogger.success("🍕 Order placed successfully! 🎉");
                order.status = OrderStatus.CONFIRMED;
                order.paymentStatus = PaymentStatus.PROCESSED;
                order.progress.isConfirmed = true;
            }

            return order;

        } catch (error) {
            elizaLogger.error('Error processing order:', error);
            return {
                type: ErrorType.SYSTEM_ERROR,
                message: 'An unexpected error occurred while processing your order',
                code: 'SYSTEM_ERROR'
            };
        }
    }

    getOrderSummary(order?: Order, customer?: Customer): string {
        let summary = "";

        // Only add customer info if we have it
        if (customer?.name) {
            summary += `Order for: ${customer.name}\n`;
        }

        if (customer?.address) {
            summary += `Delivery to: ${customer.address}\n`;
        }

        // Add order details if we have them
        if (order?.items?.length) {
            summary += "\nItems:\n";
            order.items.forEach((item, index) => {
                summary += `${index + 1}. ${item.size} ${item.crust} Pizza\n`;
                if (item.toppings?.length) {
                    item.toppings.forEach(topping => {
                        summary += `   - ${topping.code}\n`;
                    });
                }
            });
        }

        if (order?.total) {
            summary += `\nTotal: $${order.total.toFixed(2)}`;
        }

        return summary || "No order details available";
    }

    getNextRequiredActionDialogue(order?: Order, customer?: Customer): string {
        // If no order exists yet, prompt to start one
        if (!order) {
            return "Would you like to order a pizza? I can help you with that!";
        }

        // Check customer information
        if (!customer?.name || !customer?.phone || !customer?.email || !customer?.address) {
            return "To continue with your order, I'll need your delivery information. " +
                   "Please provide your name, phone number, email, and delivery address.";
        }

        // Rest of the checks...
        if (!order.items?.length) {
            return "What kind of pizza would you like to order? " +
                   "You can choose the size (Small, Medium, Large, XLarge) and crust type " +
                   "(Hand Tossed, Thin, Pan, Brooklyn, or Gluten Free).";
        }

        if (!order.paymentMethod || !order.progress.hasValidPayment) {
            return "To complete your order, I'll need your payment information. " +
                   "Please provide your credit card details (number, expiration date, CVV, and postal code).";
        }

        if (!order.progress.isConfirmed) {
            return "Your order is ready! Would you like to confirm and place this order?";
        }

        return "Your order has been confirmed and is being prepared. " +
               "You can track your order status using your phone number.";
    }

    getNextRequiredAction(order?: Order, customer?: Customer): string {
        // If no order exists, suggest starting one
        if (!order) {
            return "START_ORDER";
        }

        // Check customer information
        if (!customer?.name || !customer?.phone || !customer?.email || !customer?.address) {
            return "PROVIDE_CUSTOMER_INFO";
        }

        // Rest of the checks...
        if (!order.items?.length) {
            return "ADD_ITEMS";
        }

        if (!order.paymentMethod || !order.progress.hasValidPayment) {
            return "PROVIDE_PAYMENT";
        }

        if (!order.progress.isConfirmed) {
            return "CONFIRM_ORDER";
        }

        return "ORDER_COMPLETE";
    }

    async validateStoreAvailability(address: string): Promise<{
        isAvailable: boolean;
        message?: string;
        storeId?: string;
    }> {
        try {
            const nearbyStores = await new NearbyStores(address);

            let closestStore = null;
            let minDistance = Number.MAX_VALUE;

            for (const store of nearbyStores.stores) {
                if (
                    store.IsOnlineCapable &&
                    store.IsDeliveryStore &&
                    store.IsOpen &&
                    store.ServiceIsOpen.Delivery &&
                    store.MinDistance < minDistance
                ) {
                    minDistance = store.MinDistance;
                    closestStore = store;
                }
            }

            if (!closestStore) {
                return {
                    isAvailable: false,
                    message: "No stores are currently available for delivery to your location."
                };
            }

            return {
                isAvailable: true,
                storeId: closestStore.StoreID,
                message: `Found available store ${closestStore.StoreID} (${minDistance.toFixed(1)} miles away)`
            };
        } catch (error) {
            console.error("Store availability check failed:", error);
            return {
                isAvailable: false,
                message: "Unable to check store availability. Please try again later."
            };
        }
    }

    async initializeOrder(userId: string): Promise<void> {
        const newOrder: Order = {
            status: OrderStatus.NEW,
            items: [],
            orderID: "",
            total: 0,
            estimatedWaitMinutes: 0,
            paymentStatus: PaymentStatus.INVALID,
            paymentMethod: null,
            amountsBreakdown: { customer: 0 },
            payments: [],
            validate: async () => {},
            price: async () => {},
            place: async () => {},
            addItem: async (item: OrderItem) => {
                newOrder.items.push(item);
            },
            progress: {
                hasCustomerInfo: false,
                hasValidPayment: false,
                isConfirmed: false
            }
        };

        await this.saveOrder(userId, newOrder);
    }
}