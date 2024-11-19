// src/services/coupon.service.ts

import { coupon } from '@prisma/client';
import { HttpException } from '@exceptions/HttpException';
import prisma from '../lib/prisma';
import { randomBytes } from 'crypto';

class CouponService {
  public async createCoupon(couponData): Promise<coupon> {
    const uniqueCode = await this.generateUniqueCouponCode();
    const newCoupon = await prisma.coupon.create({
      data: {
        code: uniqueCode,
        ...couponData
      }
    });
    return newCoupon;
  }

  public async getCouponById(id: string): Promise<coupon | null> {
    const foundCoupon = await prisma.coupon.findUnique({
      where: { id }
    });
    if (!foundCoupon) throw new HttpException(404, 'Coupon not found');
    return foundCoupon;
  }

  public async getAllCoupons(): Promise<coupon[]> {
    return await prisma.coupon.findMany();
  }

  public async updateCoupon(id: string, couponData): Promise<coupon> {
    const updatedCoupon = await prisma.coupon.update({
      where: { id },
      data: { ...couponData }
    });
    return updatedCoupon;
  }

  public async deleteCoupon(id: string): Promise<void> {
    await prisma.coupon.delete({
      where: { id }
    });
  }

  public async generateCoupons(companyId: string, count: number): Promise<string[]> {
    const couponCodes: string[] = [];

    for (let i = 0; i < count; i++) {
      const code = await this.generateUniqueCouponCode();
      couponCodes.push(code);

      // Create a coupon entry in the database
      await prisma.coupon.create({
        data: {
          code: code,
          companyId: companyId,
          // You can add userId if needed or leave it out if it's optional
        },
      });
    }

    return couponCodes;
  }

  private async generateUniqueCouponCode(): Promise<string> {
    const codeLength = 16;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  
    let uniqueCode;
    do {
      const timestamp = Date.now().toString(36); // Convert timestamp to base-36
      const randomPart = Array.from({ length: codeLength - timestamp.length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
      uniqueCode = timestamp + randomPart; // Combine timestamp and random characters
    } while (await prisma.coupon.findUnique({ where: { code: uniqueCode } }));
  
    return uniqueCode;
  }
}

export default CouponService;
