import { Router } from 'express';
import PayUController from '../controllers/payu.controller';
import { Routes } from '@interfaces/routes.interface';

class PayURoute implements Routes {
  public path = '/payu';
  public router = Router();
  public payuController = new PayUController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/create-payment`, this.payuController.createPayment);
    this.router.post(`${this.path}/payment-callback`, this.payuController.paymentCallback);
  }
}

export default PayURoute;