import { NextFunction, Response } from 'express';
import { verify } from 'jsonwebtoken';
import { HttpException } from '@exceptions/HttpException';
import { DataStoredInToken, RequestWithUser } from '@interfaces/auth.interface';
import prisma from '../lib/prisma'
import { PrismaClient } from '@prisma/client';

const authMiddleware = async (req: RequestWithUser, res: Response, next: NextFunction) => {
  try {
    const token = new PrismaClient().tokens;
    const Authorization = (req.header('Authorization') ? req.header('Authorization')?.split('Bearer ')[1] : null)
    if (Authorization) {

      console.log(Authorization)

      const findToken: any = await prisma.tokens.findMany({ where: { token: Authorization } });
      console.log("ougluggljgljhgkhjgkjhgkjgjgkjhgkjhkjhgkjgkgh",findToken)
      if (findToken.length) {
        const secretKey: string = process.env.secretKey;
        const verificationResponse = (await verify(Authorization, secretKey)) as DataStoredInToken;
        const userId: any = verificationResponse.id;
        const users = new PrismaClient().users;
        const findUser: any = await users.findUnique({ where: { id: userId } });

        if (findUser) {
          req.user = findUser;
          next();
        } else {
          next(new HttpException(401, 'Wrong authentication token'));
        }
      }
      else {
        next(new HttpException(401, 'Authentication token missing'));
      }
    } else {
      next(new HttpException(401, 'Authentication expired'));
    }
  } catch (error) {
    next(new HttpException(401, 'Something went wrong'));
  }
};

export default authMiddleware;