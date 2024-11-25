import { NextFunction, Request, Response } from "express";
import { users } from "@prisma/client";
import { RequestWithUser } from "@interfaces/auth.interface";
import AuthService from "@services/auth.service";
import path from "path";
// import VerifyService from '@services/verification.service';

class AuthController {
  public authService = new AuthService();

  public signUp = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userData = req.body;
      const signUpUserData: users = await this.authService.signup(userData);
      res.status(201).json({ message: "signup" });
    } catch (error) {
      next(error);
    }
  };

  public resetPasswordRequest = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> => {
    try {
      const userData: any = req.body;
      const resetPasswordRequest = await this.authService.resetPasswordRequest(
        userData
      );
      res.status(200).json({ Data: resetPasswordRequest, message: "Success" });
    } catch (error) {
      next(error);
    }
  };

  public resetPassword = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> => {
    try {
      const userData = req.body;
      const id = req.params.id;
      const resetPasswordForUser = await this.authService.resetPassword(
        userData,
        id
      );
      res.status(200).json({ Data: resetPasswordForUser, message: "Success" });
    } catch (error) {
      next(error);
    }
  };

  // public verifyPhone = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  //   const token = Number(req.params.token);
  //   try {
  //     await this.authService.verifyPhoneToken(token);
  //     res.sendStatus(200);
  //   } catch (error) {
  //     next(error);
  //   }
  // }

  // public verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  //   const token = Number(req.params.token);
  //   try {
  //     await this.authService.verifyEmailToken(token);
  //     res.sendStatus(200);
  //   } catch (error) {
  //     next(error);
  //   }
  // }

  public logIn = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      let { email, password } = req.body;
      const login = await this.authService.login(email, password);
      res.status(200).json({ data: login, message: "login successfully" });
    } catch (error) {
      next(error);
    }
  };

  public logOut = async (
    req: RequestWithUser,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userData: users = req.user;
      const logOutUserData: users = await this.authService.logout(userData);

      res.setHeader("Set-Cookie", ["Authorization=; Max-age=0"]);
      res.status(200).json({ message: "logout" });
    } catch (error) {
      next(error);
    }
  };
  public updateUserMobile = async (
    req: RequestWithUser,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      let userData = req.body;
      const updatedMobile = await this.authService.updateUserMobile(userData);

      res.status(200).json({
        data: updatedMobile,
        message: "Mobile updated successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  public updateUserType = async (
    req: RequestWithUser,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      let userData = req.body;
      const changeUserType = await this.authService.changeUserType(userData);

      res.status(200).json({
        data: changeUserType,
        message: "User type chnaged successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  public logo = async (
    req: RequestWithUser,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      res.sendFile(path.join(__dirname, "../images/___passwordreset.gif"));
    } catch (error) {
      next(error);
    }
  };

  public getUserCount = async (
    req: RequestWithUser,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const count = await this.authService.getUserCount();
      res.status(200).json({ data: count, message: "stats sent successfully" });
    } catch (error) {
      next(error);
    }
  };
}

export default AuthController;
