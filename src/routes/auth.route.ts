import { Router } from 'express';
import AuthController from '@controllers/auth.controller';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import validationMiddleware from '@middlewares/validation.middleware';

class AuthRoute implements Routes {
  public path = '/';
  public router = Router();
  public authController = new AuthController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {

    this.router.post(`${this.path}signup`, this.authController.signUp);
    this.router.post(`${this.path}resetPasswordRequest`, this.authController.resetPasswordRequest);
    this.router.post(`${this.path}resetPassword/:id`, this.authController.resetPassword);
    // this.router.get(`${this.path}verifyPhone/:token`, this.authController.verifyPhone)
    // this.router.get(`${this.path}verifyEmail/:token`, this.authController.verifyEmail)
    this.router.post(`${this.path}login`, this.authController.logIn);
    this.router.post(`${this.path}logout`, authMiddleware, this.authController.logOut);
    this.router.post(`${this.path}updateUserType`, authMiddleware, this.authController.updateUserType);
    this.router.get(`${this.path}logo`, this.authController.logo);
    this.router.get(`${this.path}getUserCount`, this.authController.getUserCount);
  }
}

export default AuthRoute;
