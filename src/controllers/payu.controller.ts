import { NextFunction, Request, Response } from 'express';
import PayUService from '../services/payu.service';

class PayUController {
  public payUService = new PayUService();

  // Method to handle the creation of payment
  public createPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { orderId, amount, firstname, email, phone, productinfo } = req.body;

      // Initiate payment using PayU service
      const paymentResponse = await this.payUService.initiatePayment({
        txnid: orderId,
        amount,
        firstname,
        email,
        phone,
        productinfo
      });

      res.json(paymentResponse);
    } catch (error) {
      next(error);
    }
  };

  // Handle payment callback from PayU
  public paymentCallback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { txnid, status } = req.body;

      // Update the payment status in the database
      await this.payUService.updatePaymentStatus(txnid, status);

      res.sendStatus(200);
    } catch (error) {
      next(error);
    }
  };
}

export default PayUController;
