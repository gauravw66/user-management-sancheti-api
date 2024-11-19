import axios from 'axios';
import crypto from 'crypto';
import prisma from '../lib/prisma';  // Adjust the path if necessary

class PayUService {
  private PAYU_BASE_URL = 'https://secure.payu.in'; // For production. Use 'https://test.payu.in' for testing.
  private MERCHANT_KEY = process.env.PAYU_CLIENT_ID!;
  private MERCHANT_SALT = process.env.PAYU_SALT!;
  private REDIRECT_URL = `${process.env.SERVERURL}/payu/payment-callback`;

  private generateHash(data: any): string {
    const text = `${this.MERCHANT_KEY}|${data.txnid}|${data.amount}|${data.productinfo}|${data.firstname}|${data.email}|||||||||||${this.MERCHANT_SALT}`;
    return crypto.createHash('sha512').update(text).digest('hex');
  }

  public async initiatePayment(order: any): Promise<any> {
    const hash = this.generateHash(order);

    const paymentData = {
      key: this.MERCHANT_KEY,
      txnid: order.txnid,
      amount: order.amount,
      productinfo: order.productinfo,
      firstname: order.firstname,
      email: order.email,
      phone: order.phone,
      surl: this.REDIRECT_URL,  // Success URL
      furl: this.REDIRECT_URL,  // Failure URL
      hash: hash,
      service_provider: 'payu_paisa',
    };

    try {
      const response = await axios.post(`${this.PAYU_BASE_URL}/_payment`, null, {
        params: paymentData,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return response.data;
    } catch (error) {
      throw new Error('Payment initiation failed: ' + error.message);
    }
  }

  public async updatePaymentStatus(txnid: string, status: string): Promise<void> {
    try {
      await prisma.payment.update({
        where: { id: parseInt(txnid, 10) },
        data: { status }
      });
    } catch (error) {
      throw new Error('Failed to update payment status: ' + error.message);
    }
  }
}

export default PayUService;
