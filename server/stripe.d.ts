declare module 'stripe' {
  type StripeOptions = {
    apiVersion?: string
  }

  type StripeCustomer = {
    id: string
    email?: string
    name?: string
    metadata?: Record<string, unknown>
  }

  type StripeBillingPortalSession = {
    id: string
    url: string
  }

  type StripeCheckoutSession = {
    id: string
    url?: string
    status?: string
    payment_status?: string
    payment_intent?: string | { id?: string }
    client_reference_id?: string
    customer_details?: { email?: string }
    amount_total?: number
    currency?: string
    metadata?: Record<string, unknown>
    description?: string
  }

  type StripeWebhookEvent = {
    type: string
    data: {
      object: StripeCheckoutSession
    }
  }

  class Stripe {
    constructor(secretKey: string, options?: StripeOptions)
    customers: {
      create(params: Record<string, unknown>): Promise<StripeCustomer>
    }
    billingPortal: {
      sessions: {
        create(params: Record<string, unknown>): Promise<StripeBillingPortalSession>
      }
    }
    checkout: {
      sessions: {
        create(params: Record<string, unknown>): Promise<StripeCheckoutSession>
        retrieve(sessionId: string): Promise<StripeCheckoutSession>
      }
    }
    webhooks: {
      constructEvent(rawBody: Buffer | string, signature: string, secret: string): StripeWebhookEvent
    }
  }

  namespace Stripe {
    namespace Checkout {
      interface Session extends StripeCheckoutSession {}
    }
  }

  export default Stripe
}