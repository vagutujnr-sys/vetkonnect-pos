declare module "paynow" {
  export class Payment {
    add(title: string, amount: number, quantity?: number): Payment;
  }

  export class InitResponse {
    success: boolean;
    redirectUrl: string;
    pollUrl: string;
    status: string;
    error: string;
  }

  export class StatusResponse {
    reference: string;
    amount: string;
    pollUrl: string;
    status: string;
  }

  export class Paynow {
    constructor(integrationId: string, integrationKey: string, resultUrl: string, returnUrl: string);
    createPayment(reference: string, authEmail: string): Payment;
    send(payment: Payment): Promise<InitResponse>;
    pollTransaction(url: string): Promise<InitResponse>;
    parseStatusUpdate(response: string): StatusResponse;
  }
}