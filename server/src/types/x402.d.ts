declare module '@x402/express' {
    export function paymentMiddleware(...args: any[]): any;
    export class x402ResourceServer {
        constructor(...args: any[]);
        register(...args: any[]): any;
    }
}

declare module '@x402/evm/exact/server' {
    export class ExactEvmScheme {
        constructor(...args: any[]);
    }
}

declare module '@x402/core/server' {
    export class HTTPFacilitatorClient {
        constructor(...args: any[]);
    }
}
