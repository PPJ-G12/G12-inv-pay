import { Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentSessionDto } from './dto';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @MessagePattern("create-payment-session")
  createPaymentSession(@Payload() paymentSessionDto: PaymentSessionDto) {
    return this.paymentsService.createPaymentSession(paymentSessionDto);
  }

  @Get('success')
  success(@Query('orderId') orderId: string) {
    const receiptUrl = this.paymentsService.getReceiptUrl(orderId);

    return {
      ok: true,
      message: 'Payment successful',
      receiptUrl: receiptUrl || 'Receipt URL not available',
    };
  }

  @Get('cancel')
  cancel() {
    return {
      ok: true,
      message: 'Payment canceled'
    }
  }

  @Post('webhook')
  async stripeWebhook(@Req() req: Request, @Res() res: Response) {
    return this.paymentsService.stripeWebhook(req, res);
  }
}
