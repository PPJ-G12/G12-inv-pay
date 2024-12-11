import { Inject, Injectable } from '@nestjs/common';
import { envs, NATS_SERVICE } from '../config';
import Stripe from 'stripe';
import { PaymentSessionDto } from './dto';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class PaymentsService {
  private readonly stripe = new Stripe(envs.stripeSecret);
  private readonly receiptUrls = new Map<string, string>();

  constructor(
    @Inject(NATS_SERVICE) private readonly client: ClientProxy
  ) {
  }

  async createPaymentSession(paymentSessionDto: PaymentSessionDto) {

    const {items, orderId } = paymentSessionDto;
    const lineItems = items.map(item => {
      return {
        price_data: {
          currency: "clp",
          product_data: {
            name: item.name,
          },
          unit_amount: item.price
        },
        quantity: item.quantity
      }
    });

    const session = await this.stripe.checkout.sessions.create({
      payment_intent_data: {
        metadata:{
          orderId: orderId
        }
      },
      line_items: lineItems,
      mode: "payment",
      success_url: `${envs.urlSuccess}?orderId=${orderId}`,
      cancel_url: envs.urlCancel,
    });

    return {
      cancel_url: session.cancel_url,
      success_url: session.success_url,
      url: session.url,
      orderId: session.metadata.orderId,
    }
  }

  /**
   * Recibe un webhook de Stripe y procesa los datos de la orden
   * @param req La solicitud HTTP
   * @param res La respuesta HTTP
   */
  //https://docs.stripe.com/webhooks#webhooks-summary
  async stripeWebhook(req: Request, res: Response) {
    const sig = req.headers["stripe-signature"];
    let event: Stripe.Event;
    const endpointSecret = envs.endpointSecret;

    try{
      event = this.stripe.webhooks.constructEvent(
        req['rawBody'],
        sig,
        endpointSecret,
      );
    } catch (err){
      // @ts-ignore
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    switch (event.type) {
      case 'charge.succeeded':
        const chargeSuccess = event.data.object;
        const payload = {
          orderId: chargeSuccess.metadata.orderId,
          stripeChargeId: chargeSuccess.id,
          receiptUrl: chargeSuccess.receipt_url,
        };
        console.log(payload);
        this.receiptUrls.set(payload.orderId, payload.receiptUrl);
        this.client.emit('paymentSucceeded', payload);
        break;
        default:
          console.log(`Event ${event.type} not handled`);
    }

    // @ts-ignore
    return res.status(200).json({sig});
  }

  getReceiptUrl(orderId: string): string | undefined {
    return this.receiptUrls.get(orderId);
  }
}
