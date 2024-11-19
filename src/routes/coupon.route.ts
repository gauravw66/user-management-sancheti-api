// src/routes/coupon.route.ts

import { Router } from 'express';
import CouponController from '@/controllers/coupon.controller';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';

class CouponRoute implements Routes {
  public path = '/coupon';
  public router = Router();
  public couponController = new CouponController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}`, this.couponController.createCoupon);
    this.router.get(`${this.path}/:id`, this.couponController.getCouponById);
    this.router.get(`${this.path}`, this.couponController.getAllCoupons);
    this.router.put(`${this.path}/:id`, this.couponController.updateCoupon);
    this.router.delete(`${this.path}/:id`, this.couponController.deleteCoupon);
    this.router.post(`${this.path}/generate`, this.couponController.generateCoupons);
  }
}

export default CouponRoute;
