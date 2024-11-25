import { Injectable } from '@nestjs/common';
import { envs } from '../config';
import Stripe from 'stripe';
import { PaymentSessionDto } from './dto';

@Injectable()
export class PaymentsService {
  private readonly stripe = new Stripe(envs.stripeSecret);

  async createPaymentSession(paymentSessionDto: PaymentSessionDto) {

    const {items, orderId } = paymentSessionDto;
    const lineItems = items.map(item => {
      return {
        price_data: {
          currency: "clp",
          product_data: {
            name: item.name,
          },
          unit_amount: item.price * item.quantity
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
      success_url: envs.urlSuccess,
      cancel_url: envs.urlCancel,
    });

    return session;
  }

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
      case "charge.succeeded":
        const chargeSuccess = event.data.object;
        console.log({
          orderId: chargeSuccess.metadata.orderId,
        });
        break;
        default:
          console.log(`Event ${event.type} not handled`);
    }

    // @ts-ignore
    return res.status(200).json({sig});
  }
}
