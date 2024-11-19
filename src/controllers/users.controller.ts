import { NextFunction, Request, Response } from 'express';
import { HttpException } from '@exceptions/HttpException';
import userService from '@services/users.service';
import authService from '@services/auth.service';
import Validator from 'validatorjs';
import { createUserDto } from '@/dtos/users.dto';

class UsersController {
  public userService = new userService();
  public authService = new authService()


  // public createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  //   try {
      
  //     const userData = req.body;

  //     let validation = new Validator(userData, createUserDto);
  //     if(validation.fails()){
  //       if(validation.errorCount > 0){
  //         throw new HttpException(400, validation.errors.all());
  //       }
  //     }


  //     const createUserData: user = await this.userService.createUser(userData);

  //     res.status(201).json({ data: createUserData, message: 'user created successfully' });
  //   } catch (error) {
  //     next(error);
  //   }
  // };

  // public login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  //   try {

  //     let { username, password } = req.body;

  //     const login = await this.userService.userLogin(username, password);

  //     res.status(200).json({ data: login, message: 'login successfully' });
  //   } catch (error) {
  //     next(error);
  //   }
  // }
  
  // public getUsers = async (req, res, next): Promise<void> => {
  //   try {

  //     const findAllUsersData: user[] = await this.userService.findAllUser();
      

  //     res.status(200).json({ data: findAllUsersData, message: 'all users fetched successfully' });
  //   } catch (error) {
  //     next(error);
  //   }
  // };


  public subscribe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

  };

  public loginWithGoogle = async (req: any, res: any, next: NextFunction): Promise<void> => {
    try {
      let data: any = req.user
      const ssoLogin = await this.userService.loginWithGmail(data);
      res.redirect(`https://app.orthoai.in/${ssoLogin}`)
    } catch (error) {
      res.redirect(`https://app.orthoai.in/${null}`)
    }
  };

  public saveQuestion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      let userId, question, workspaceId, url
      userId = req.body.userId;
      question = req.body.question;
      workspaceId = req.body.workspaceId;
      url = req.body.url ? req.body.url : ""
      
      const findAllTransactionData = await this.userService.saveQuestion(userId, question, workspaceId, url);

      res.status(200).json({ message: 'Question Saved Successfully...!', data: findAllTransactionData });
    } catch (error) {
      next(error);
    }
  }

  public updateAnswerOrError = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      let questionId, answer, error, workspaceId,vote,reason
      questionId = req.body.questionId;
      answer = req.body.answer;
      error = req.body.error;
      workspaceId = req.body.workspaceId;
      vote = req.body.vote
      reason = req.body.reason ? req.body.reason : ""
      
      const updateAnswerOrError = await this.userService.updateAnswerOrError(questionId, answer, error, workspaceId, vote, reason);

      res.status(200).json({ message: 'Question Saved Successfully...!', data: updateAnswerOrError });
    } catch (error) {
      next(error);
    }
  }

  public getWorkspacesByUserId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      let userId = req.body.userId;
      
      const getWorkspacesByUserId = await this.userService.getWorkspacesByUserId(userId);

      res.status(200).json({ message: 'workspace sent Successfully...!', data: getWorkspacesByUserId });
    } catch (error) {
      next(error);
    }
  }

  public deleteWorkspaceId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      let workspaceId = req.body.workspaceId;
      
      const deleteWorkspaceId = await this.userService.deleteWorkspaceId(workspaceId);

      res.status(200).json({ message: 'workspace deleted Successfully...!', data: deleteWorkspaceId });
    } catch (error) {
      next(error);
    }
  }

  public getSubsciptionPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const getSubsciptionPlan = await this.userService.getSubsciptionPlan();
      res.status(200).json({ message: 'Subscription Plan Fetched Successfully...!', data: getSubsciptionPlan });
    } catch (error) {
      next(error);
    }
  
  }

  public discover = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const discover = await this.userService.discover(req.query);
      res.status(200).json({ message: 'discover data Fetched Successfully...!', data: discover });
    } catch (error) {
      next(error);
    }
  
  }

}

export default UsersController;
