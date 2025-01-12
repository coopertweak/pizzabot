export class RateLimiter {
    private requests: number[] = [];
    private maxRequests: number;
    private timeWindow: number;

    constructor({ maxRequests, timeWindow }: { maxRequests: number; timeWindow: number }) {
        this.maxRequests = maxRequests;
        this.timeWindow = timeWindow;
    }

    async tryAcquire(): Promise<boolean> {
        const now = Date.now();

        // Remove expired timestamps
        this.requests = this.requests.filter(
            timestamp => now - timestamp < this.timeWindow
        );

        if (this.requests.length >= this.maxRequests) {
            return false;
        }

        this.requests.push(now);
        return true;
    }

    getTimeToNextAvailable(): number {
        if (this.requests.length === 0) return 0;

        const now = Date.now();
        const oldestRequest = this.requests[0];
        return Math.max(0, this.timeWindow - (now - oldestRequest));
    }
}