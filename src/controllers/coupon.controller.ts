// src/controllers/coupon.controller.ts

import { NextFunction, Request, Response } from 'express';
import CouponService from '@services/coupon.service';
import { coupon } from '@prisma/client';

class CouponController {
  public couponService = new CouponService();

  public createCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const couponData = req.body;
      const createdCoupon: coupon = await this.couponService.createCoupon(couponData);
      res.status(201).json({ data: createdCoupon, message: 'Coupon created successfully' });
    } catch (error) {
      next(error);
    }
  };

  public getCouponById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const couponId = req.params.id;
      const coupon = await this.couponService.getCouponById(couponId);
      res.status(200).json({ data: coupon, message: 'Coupon retrieved successfully' });
    } catch (error) {
      next(error);
    }
  };

  public getAllCoupons = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coupons = await this.couponService.getAllCoupons();
      res.status(200).json({ data: coupons, message: 'Coupons retrieved successfully' });
    } catch (error) {
      next(error);
    }
  };

  public updateCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const couponId = req.params.id;
      const couponData = req.body;
      const updatedCoupon = await this.couponService.updateCoupon(couponId, couponData);
      res.status(200).json({ data: updatedCoupon, message: 'Coupon updated successfully' });
    } catch (error) {
      next(error);
    }
  };

  public deleteCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const couponId = req.params.id;
      await this.couponService.deleteCoupon(couponId);
      res.status(204).json({ message: 'Coupon deleted successfully' });
    } catch (error) {
      next(error);
    }
  };

  public generateCoupons = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { companyId, count } = req.body;

      if (!companyId || !count || count <= 0) {
        res.status(400).json({ message: 'Invalid input. Please provide a valid company ID and a count greater than 0.' });
        return;
      }

      const couponCodes = await this.couponService.generateCoupons(companyId, count);
      res.status(201).json({ message: 'Coupons created successfully', coupons: couponCodes });
    } catch (error) {
      next(error);
    }
  };
}

export default CouponController;
