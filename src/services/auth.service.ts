import { compare, hash } from 'bcrypt';
import config from 'config';
import { sign } from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { HttpException } from '@exceptions/HttpException';
import { DataStoredInToken, TokenData } from '@interfaces/auth.interface';
import { isEmpty } from '@utils/util';
import prisma from '../lib/prisma';
import unirest from 'unirest';
import aws from "aws-sdk";
import smtpTransport from 'nodemailer-smtp-transport';
import nodemailer from 'nodemailer';
import { verify } from 'jsonwebtoken';
const generateUniqueId = require('generate-unique-id');
import moment from 'moment';

let pathOfLogo = process.env.SERVERURL + "logo"


aws.config.update({
  secretAccessKey: process.env.secretAccessKey,
  accessKeyId: process.env.accessKeyId,
  region: process.env.region,
});


class AuthService {
  public users = prisma.users;
  public tokens = prisma.tokens;
  public signupToken = prisma.signupToken;
  public subscription = prisma.subscription;
  public general_settings = prisma.general_settings
  public QA = prisma.QA
  public coupon = prisma.coupon

  // public async signup(userData): Promise<any> {
  //   if (isEmpty(userData)) throw new HttpException(400, "Your not userData");
  //   let companyId

  //   const findUser: any = await this.users.findUnique({ where: { email: userData.email } });
  //   if (findUser) throw new HttpException(409, `Your email ${userData.email} already exists`);

  //   const resetTokenData = await this.createTokenForResetPassword(userData);

  //   if(userData.code){
  //     const findCompanyByCouponId = await this.coupon.findUnique({
  //       where :{
  //         code : userData.code
  //       }
  //     })

  //     console.log(findCompanyByCouponId)

  //     if(findCompanyByCouponId.userId != null){
  //       throw new HttpException(409, `Your coupon code ${userData.code} is already utilised`);
  //     }

  //     companyId = findCompanyByCouponId.companyId
  //     console.log(companyId)
  //   }

  //   let couponCode = userData.code
  //   delete userData.code;

  //   const createUserData = await this.users.create({ data: { ...userData, companyId : companyId } });

  //   const updateUserId = await this.coupon.update({
  //     where :{
  //       code : couponCode
  //     },
  //     data : {
  //       userId : createUserData.id
  //     }
  //   })

  //   console.log("createUserData", createUserData, updateUserId)

  //   let saveResetToken = await this.signupToken.create({
  //     data: {
  //       token: resetTokenData.token.toString(),
  //       userId: createUserData.id,
  //       status: true
  //     }
  //   });

  //   console.log("saveResetToken", saveResetToken)

  //   let link = `https://app.orthoai.in/reset-password/${saveResetToken.id}`;

  //   console.log(link)

  //   let sendMail = await this.awsMail(userData.email, link, "signup")

  //   const addfreeTier = await this.adduserSubscription(createUserData.id, "free")

  //   return createUserData;
  // }

  public async signup(userData): Promise<any> {
    if (isEmpty(userData)) throw new HttpException(400, "No userData provided");

    let companyId: string | null = null;
    let couponCode: string | null = userData?.code || null;

    // Check if user already exists
    const findUser = await this.users.findUnique({ where: { email: userData.email } });

    // Case 1: User exists and coupon code is provided
    if (findUser) {
      if (couponCode) {
        const coupon = await this.coupon.findUnique({ where: { code: couponCode } });

        if (!coupon) throw new HttpException(404, `Coupon code ${couponCode} not found`);
        if (coupon.userId) throw new HttpException(409, `Coupon code ${couponCode} is already utilized`);

        // Update coupon with existing user
        await this.coupon.update({
          where: { code: couponCode },
          data: { userId: findUser.id }
        });

        return userData;
      }

      // Case 2: User exists, but no coupon code is provided
      throw new HttpException(409, `User with email ${userData.email} already exists`);
    }

    // Case 3: New user and coupon code is provided
    if (couponCode) {
      const coupon = await this.coupon.findUnique({ where: { code: couponCode } });

      if (!coupon) throw new HttpException(404, `Coupon code ${couponCode} not found`);
      if (coupon.userId) throw new HttpException(409, `Coupon code ${couponCode} is already utilized`);

      companyId = coupon.companyId;
    }

    // Case 4: New user, no coupon code
    delete userData.code; // Remove code from user data

    // Create the new user
    const createUserData = await this.users.create({
      data: { ...userData, companyId }
    });

    // If coupon was provided, update the coupon with the new user's ID
    if (couponCode) {
      await this.coupon.update({
        where: { code: couponCode },
        data: { userId: createUserData.id }
      });
    }

    // Generate and save reset token
    const resetTokenData = await this.createTokenForResetPassword(userData);
    const saveResetToken = await this.signupToken.create({
      data: {
        token: resetTokenData.token.toString(),
        userId: createUserData.id,
        status: true
      }
    });

    // Construct password reset link
    const link = `https://app.orthoai.in/reset-password/${saveResetToken.id}`;

    // Send signup email
    await this.awsMail(userData.email, link, "signup");

    // Add free-tier subscription
    await this.adduserSubscription(createUserData.id, "free");

    return userData;
  }

  public async resetPasswordRequest(userData: any) {
    try {

      const findUser = await this.users.findFirst({
        where: {
          email: userData.email
        }
      });

      if (!findUser) throw new HttpException(409, `Your email ${userData.email} not found`);

      const resetTokenData = await this.createTokenForResetPassword(userData);

      const findUserToken = await prisma.signupToken.findFirst({
        where: {
          userId: findUser.id
        }
      });

      var saveResetToken
      let link
      if (findUserToken) {
        link = `https://app.orthoai.in/forgot-password/${findUserToken.id}`;
        console.log(link)
        saveResetToken = await prisma.signupToken.updateMany({
          where: {
            userId: findUser.id
          },
          data: {
            token: resetTokenData.token.toString(),
            status: true
          }
        })
      } else {
        saveResetToken = await prisma.signupToken.create({
          data: {
            token: resetTokenData.token.toString(),
            userId: findUser.id,
            status: true
          }
        });

        link = `https://app.orthoai.in/forgot-password/${saveResetToken.id}`;
        console.log(link)
      }


      let sendMail = await this.awsMail(userData.email, link, "resetPasswordRequest")
      return sendMail

    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  public async resetPassword(userData, id) {
    let response = "Passowrd reset successful"
    try {
      const findToken = await prisma.signupToken.findFirst({
        where: {
          id: id,
          status: true
        }
      })

      if (!findToken || findToken == null) {
        response = "Password is already reset"
        return response
      }
      else {
        const secretKey: string = process.env.secretKey;
        const verificationResponse = (await verify(findToken.token, secretKey)) as DataStoredInToken;

        console.log(";lfdskfds;lkdfs;lkfds;lkfds;lkfds", verificationResponse)

        const userEmail: any = verificationResponse.id;
        const findUser: any = await prisma.users.findUnique({ where: { email: userEmail } });
        if (!findUser) {
          response = `Your email ${findUser.email} not found`
          return response
        }

        // If no error, set new password.
        const hashedPassword = await hash(userData.password, 10);
        const updateUserData = await prisma.users.update({
          where: { id: findUser.id },
          data: {
            password: hashedPassword,
            status: true
          }
        });

        if (updateUserData) {
          let statusChange = await prisma.signupToken.update({
            where: {
              id: id
            },
            data: {
              status: false
            }
          })
        }


        if (userData.method == 'resetPassword') {
          let loginToServer = await this.thirdPartyLogin()

          let addUserToGlobalServer = await this.addUserToGlobalServer(loginToServer.token, findUser.email, userData.password)
          let globalUserId = addUserToGlobalServer.user.id
          console.log("176 ===========================> globalUserId", globalUserId)

          console.log(findUser.id)

          let updateUserGenId = await prisma.users.updateMany({
            where: {
              email: findUser.email
            },
            data: {
              genId: globalUserId.toString()
            }
          });

          console.log("185 =========================>", updateUserGenId)

          let getGlobalUserList = await this.getGlobalUserList(loginToServer.token)

          console.log("slsakjdsahkjdsahkjdahkjdsahkjdsahkdsahdsakjhdsakjhdsakja")

          for (let i = 0; i < getGlobalUserList.workspaces.length; i++) {
            // if (getGlobalUserList.workspaces[i].name == "orthoglobal1") {
            let newArray = getGlobalUserList.workspaces[i].userIds
            newArray.push(globalUserId)
            console.log("newArray 184 ====>", newArray)

            let updateArrays = await this.updateArray(loginToServer.token, newArray,getGlobalUserList.workspaces[i].id)
            console.log("updateArrays", updateArrays)

            // let updateArraysforPatient = await this.updateArrayForPatient(loginToServer.token, newArray)
            // console.log("updateArraysforPatient", updateArraysforPatient)
            // }
          }
        }

        return response;
      }
    }
    catch (error) {
      throw new HttpException(401, `Link has expired. Kindly set your password by clicking on "Forgot Password" link.`);
    }
  }

  public createTokenForResetPassword(user: any): TokenData {
    const dataStoredInToken: DataStoredInToken = { id: user.email };
    const secretKey: string = process.env.secretKey;
    const expiresIn: any = '60m';
    return { expiresIn, token: sign(dataStoredInToken, secretKey, { expiresIn }) };
  }

  public async login(username, password): Promise<any> {
    if (!username || !password) {
      throw new HttpException(400, "Plz Enter Credentials");
    }

    const user = await this.users.findFirst({
      where: {
        email: username,
        status: true
      },
      include: {
        subscription: {
          take: 1,
          orderBy: {
            updatedAt: 'desc'
          }
        }
      }
    })

    if (!user) {
      throw new HttpException(400, "Invalid username or the user is deleted. Please signup again.");
    }

    if (user.isSSOuser == true) {
      throw new HttpException(400, "Use Continue with Google to sign in with your Google account");
    }

    if (user.password == null) {
      throw new HttpException(400, "Email verification is pending! Please check your email to reset password");
    }

    let decrypt_password = await compare(password, user.password)

    console.log(decrypt_password)

    if (!decrypt_password) {
      throw new HttpException(400, "Invalid password");
    }

    const dataStoredInToken = { id: user.id };
    const secretKey = process.env.secretKey
    const expiresIn = '180d';
    const token: any = sign(dataStoredInToken, secretKey, { expiresIn });

    const findUserToken = await this.tokens.findFirst({
      where: {
        user_id: user.id
      }
    })

    // if (findUserToken) {
    //   const saveToekn = await this.tokens.updateMany({
    //     where: {
    //       user_id: user.id
    //     },
    //     data: {
    //       token: token
    //     },
    //   })
    // }
    //else {
      const saveToken = await this.tokens.create({
        data: {
          token: token,
          user_id: user.id
        }
      });
    //}

    let serverLogin

    try {
      serverLogin = await this.serverLogin(username, password);
      console.log('Login successful: ', serverLogin);
    } catch (error) {
      console.error('Login failed: ', error.message);
      // Handle error appropriately, like sending a response with status 500 or 502
    }

    console.log(serverLogin)

    if (serverLogin) {
      let info: any = {
        id: user.id,
        email: username,
        firstName: user.firstName,
        lastName: user.lastName,
        mobile: user.mobile,
        status: user.status,
        userType: user.userType,
        subscriptionType: user.subscription[0]?.subscriptionType,
        queryCount: user.subscription[0]?.queryCount,
        isPlanActive: user.subscription[0]?.isPlanActive
      }

      return { token: token, user: info, chatToken: serverLogin.token }
    }
  }

  public async upload(file: any): Promise<any> {
    return { code: 200, fileData: file };
  }

  // public async createEmailVerificationTokens(user: User) {
  //   if (isEmpty(user)) throw new HttpException(500, "Invalid user data");
  //   const emailToken = this.tokens.create({
  //     data: {
  //       type: TokenType.EMAIL,
  //       userId: user.id
  //     }
  //   });
  //   return emailToken;
  // }
  // public async createPhoneVerificationTokens(user: User) {
  //   if (isEmpty(user)) throw new HttpException(500, "Invalid user data");
  //   const phoneToken = this.tokens.create({
  //     data: {
  //       type: TokenType.PHONE,
  //       userId: user.id
  //     }
  //   });
  //   return phoneToken;
  // }
  // public async verifyPhoneToken(token: number) {
  //   const verificationToken = await this.tokens.findUnique({
  //     where: {
  //       id: token,
  //     }
  //   });
  //   if (!verificationToken) throw new HttpException(424, "Invalid Token for phone");
  //   if (verificationToken.type != TokenType.PHONE) throw new HttpException(424, "Invalid Token for phone");

  //   const user = await this.users.findUnique({ where: { id: verificationToken.userId } });
  //   if (!user) throw new HttpException(500, "Some thing went wrong!");

  //   await this.users.update({
  //     where: {
  //       id: user.id
  //     }, data: {
  //       phoneVerified: true
  //     }

  //   });

  // }
  // public async verifyEmailToken(token: number) {
  //   const verificationToken = await this.tokens.findUnique({
  //     where: {
  //       id: token,
  //     }
  //   });
  //   if (!verificationToken) throw new HttpException(424, "Invalid Token for email");
  //   if (verificationToken.type != TokenType.EMAIL) throw new HttpException(424, "Invalid Token for email");

  //   const user = await this.users.findUnique({ where: { id: verificationToken.userId } });
  //   if (!user) throw new HttpException(500, "Some thing went wrong!");

  //   await this.users.update({
  //     where: {
  //       id: user.id
  //     }, data: {
  //       emailVerified: true
  //     }

  //   });

  // }
  // public async login(userData): Promise<{ cookie: string; findUser: User }> {
  //   if (isEmpty(userData)) throw new HttpException(400, "Your not userData");

  //   const findUser: User = await this.users.findUnique({ where: { email: userData.email } });
  //   if (!findUser) throw new HttpException(409, `Your email ${userData.email} not found`);

  //   const isPasswordMatching: boolean = await compare(userData.password, findUser.password);
  //   if (!isPasswordMatching) throw new HttpException(409, "Your password not matching");

  //   if (!findUser.emailVerified || !findUser.phoneVerified) throw new HttpException(410, `Email/Phone not verified!`)



  //   const tokenData = this.createToken(findUser);
  //   const cookie = this.createCookie(tokenData);

  //   return { cookie, findUser };
  // }

  public async logout(userData: any): Promise<any> {
    if (isEmpty(userData)) throw new HttpException(400, "You are not userData");

    const findUser: any = await this.users.findFirst({ where: { email: userData.email } });
    if (!findUser) throw new HttpException(409, "Your not user");

    console.log(findUser)

    const deleteToken = await this.tokens.deleteMany({ where: { user_id: findUser.id } })

    return findUser;
  }


  public async changeUserType(userData: any): Promise<any> {
    if (isEmpty(userData)) throw new HttpException(400, "You are not userData");

    const findUser: any = await this.users.findFirst({ where: { id: userData.id } });
    if (!findUser) throw new HttpException(409, "Your not user");

    console.log(findUser)

    const updateUserData = await this.users.update({ where: { id: findUser.id }, data: { userType: userData.userType } })

    return updateUserData;
  }

  public createToken(user: any): TokenData {
    console.log(user)
    const dataStoredInToken: DataStoredInToken = { id: user.id };
    const secretKey: string = config.get('secretKey');
    console.log(secretKey)
    const expiresIn: any = "24h";

    return { expiresIn, token: sign(dataStoredInToken, secretKey, { expiresIn }) };
  }

  public createCookie(tokenData: TokenData): string {
    return `Authorization=${tokenData.token}; HttpOnly; Max-Age=${tokenData.expiresIn};`;
  }

  public async awsMail(email, link, requestType): Promise<any> {
    try {
      return new Promise(async (resolve: any, reject: any) => {
        console.log(email, link)
        let emailSubject = "Verification email from Ortho AI";
        let emailTemplate

        if (requestType == "signup") {
          emailTemplate = `<!DOCTYPE html>
  
        <html lang="en" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:v="urn:schemas-microsoft-com:vml">
        
        <head>
          <title></title>
          <meta content="text/html; charset=utf-8" http-equiv="Content-Type" />
          <meta content="width=device-width, initial-scale=1.0" name="viewport" />
          <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch><o:AllowPNG/></o:OfficeDocumentSettings></xml><![endif]-->
          <style>
            * {
              box-sizing: border-box;
            }
        
            body {
              margin: 0;
              padding: 0;
            }
        
            a[x-apple-data-detectors] {
              color: inherit !important;
              text-decoration: inherit !important;
            }
        
            #MessageViewBody a {
              color: inherit;
              text-decoration: none;
            }
        
            p {
              line-height: inherit
            }
        
            .desktop_hide,
            .desktop_hide table {
              mso-hide: all;
              display: none;
              max-height: 0px;
              overflow: hidden;
            }
        
            .image_block img+div {
              display: none;
            }
        
            @media (max-width:660px) {
        
              .desktop_hide table.icons-inner,
              .social_block.desktop_hide .social-table {
                display: inline-block !important;
              }
        
              .icons-inner {
                text-align: center;
              }
        
              .icons-inner td {
                margin: 0 auto;
              }
        
              .mobile_hide {
                display: none;
              }
        
              .row-content {
                width: 100% !important;
              }
        
              .stack .column {
                width: 100%;
                display: block;
              }
        
              .mobile_hide {
                min-height: 0;
                max-height: 0;
                max-width: 0;
                overflow: hidden;
                font-size: 0px;
              }
        
              .desktop_hide,
              .desktop_hide table {
                display: table !important;
                max-height: none !important;
              }
            }
          </style>
        </head>
        
        <body style="background-color: #f8f8f9; margin: 0; padding: 0; -webkit-text-size-adjust: none; text-size-adjust: none;">
          <table border="0" cellpadding="0" cellspacing="0" class="nl-container" role="presentation"
            style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #f8f8f9;" width="100%">
            <tbody>
              <tr>
                <td>
                  <table align="center" border="0" cellpadding="0" cellspacing="0" class="row row-1"
                    role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;" width="100%">
                    <tbody>
                      <tr>
                        <td>
                          <table align="center" border="0" cellpadding="0" cellspacing="0"
                            class="row-content stack" role="presentation"
                            style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #fff; color: #000; width: 640px; margin: 0 auto;"
                            width="640">
                            <tbody>
                              <tr>
                                <td class="column column-1"
                                  style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; vertical-align: top; border-top: 0px; border-right: 0px; border-bottom: 0px; border-left: 0px;"
                                  width="100%">
                                  <table border="0" cellpadding="0" cellspacing="0"
                                    class="image_block block-1" role="presentation"
                                    style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;"
                                    width="100%">
                                    <tr>
                                      <td class="pad" style="width:100%;">
                                        <div align="center" class="alignment"
                                          style="line-height:10px">
                                          <img alt="Image of lock & key."
                                            src="${pathOfLogo}"
                                            style="display: block; height: auto; border: 0; max-width: 640px; width: 100%;"
                                            title="Image of lock & key." width="640" />
                                        </div>
                                      </td>
                                    </tr>
                                  </table>
                                  <table border="0" cellpadding="0" cellspacing="0"
                                    class="divider_block block-2" role="presentation"
                                    style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;"
                                    width="100%">
                                    <tr>
                                      <td class="pad" style="padding-top:30px;">
                                        <div align="center" class="alignment">
                                          <table border="0" cellpadding="0" cellspacing="0"
                                            role="presentation"
                                            style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;"
                                            width="100%">
                                            <tr>
                                              <td class="divider_inner"
                                                style="font-size: 1px; line-height: 1px; border-top: 0px solid #BBBBBB;">
                                                <span> </span>
                                              </td>
                                            </tr>
                                          </table>
                                        </div>
                                      </td>
                                    </tr>
                                  </table>
                                  <table border="0" cellpadding="0" cellspacing="0"
                                    class="paragraph_block block-3" role="presentation"
                                    style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;"
                                    width="100%">
                                    <tr>
                                      <td class="pad"
                                        style="padding-bottom:10px;padding-left:40px;padding-right:40px;padding-top:10px;">
                                        <div
                                          style="color:#555555;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:30px;line-height:120%;text-align:center;mso-line-height-alt:36px;">
                                          <p style="margin: 0; word-break: break-word;"><span
                                              style="color: #2b303a;"><strong>Verify your
                                                email address</strong></span></p>
                                        </div>
                                      </td>
                                    </tr>
                                  </table>
                                  <table border="0" cellpadding="0" cellspacing="0"
                                    class="paragraph_block block-4" role="presentation"
                                    style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;"
                                    width="100%">
                                    <tr>
                                      <td class="pad"
                                        style="padding-bottom:10px;padding-left:40px;padding-right:40px;padding-top:10px;">
                                        <div
                                          style="color:#555555;font-family:Montserrat, Trebuchet MS, Lucida Grande, Lucida Sans Unicode, Lucida Sans, Tahoma, sans-serif;font-size:15px;line-height:150%;text-align:left;mso-line-height-alt:22.5px;">
                                          <p style="margin: 0;">Your almost set to start
                                            enjoying <b>OrthoAi</b> service. Simply click the link
                                            below to verify your email address and get
                                            started. The link expires in 48 hours.</p>
                                        </div>
                                      </td>
                                    </tr>
                                  </table>
                                  <table border="0" cellpadding="0" cellspacing="0"
                                    class="button_block block-5" role="presentation"
                                    style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;"
                                    width="100%">
                                    <tr>
                                      <td class="pad"
                                        style="padding-left:10px;padding-right:10px;padding-top:15px;text-align:center;">
                                        <div align="center" class="alignment">
                                          <a href=${link}
                                            style="text-decoration:none;display:inline-block;color:#ffffff;background-color:#0c6af7;border-radius:35px;width:auto;border-top:0px solid transparent;font-weight:undefined;border-right:0px solid transparent;border-bottom:0px solid transparent;border-left:0px solid transparent;padding-top:15px;padding-bottom:15px;font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;text-align:center;mso-border-alt:none;word-break:keep-all;"
                                            target="_blank"><span
                                              style="padding-left:30px;padding-right:30px;font-size:16px;display:inline-block;letter-spacing:normal;"><span
                                                style="margin: 0; word-break: break-word; line-height: 32px;"><strong>Verify
                                                  Your
                                                  Email</strong></span></span></a><!--[if mso]></center></v:textbox></v:roundrect><![endif]-->
                                        </div>
                                      </td>
                                    </tr>
                                  </table>
                                  <table border="0" cellpadding="0" cellspacing="0"
                                    class="paragraph_block block-6" role="presentation"
                                    style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;"
                                    width="100%">
                                    <tr>
                                      <td class="pad"
                                        style="padding-bottom:10px;padding-left:40px;padding-right:40px;padding-top:30px;">
                                        <div
                                          style="color:#878787;font-family:Montserrat, Trebuchet MS, Lucida Grande, Lucida Sans Unicode, Lucida Sans, Tahoma, sans-serif;font-size:14px;line-height:150%;text-align:left;mso-line-height-alt:21px;">
                                          <p style="margin: 0;"><em>Please ignore this email
                                              if you did not request a verification
                                              email.</em>
                                          </p>
                                        </div>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <table align="center" border="0" cellpadding="0" cellspacing="0" class="row row-2"
                    role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;" width="100%">
                    <tbody>
                      <tr>
                        <td>
                          <table align="center" border="0" cellpadding="0" cellspacing="0"
                            class="row-content stack" role="presentation"
                            style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #410125; color: #000; width: 640px; margin: 0 auto;"
                            width="640">
                            <tbody>
                              <tr>
                                <td class="column column-1"
                                  style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; vertical-align: top; border-top: 0px; border-right: 0px; border-bottom: 0px; border-left: 0px;"
                                  width="100%">
                                  <table border="0" cellpadding="0" cellspacing="0"
                                    class="paragraph_block block-3" role="presentation"
                                    style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;"
                                    width="100%">
                                    <tr>
                                      <td class="pad"
                                        style="padding-bottom:30px;padding-left:40px;padding-right:40px;padding-top:20px;">
                                        <div
                                          style="color:#555555;font-family:Montserrat, Trebuchet MS, Lucida Grande, Lucida Sans Unicode, Lucida Sans, Tahoma, sans-serif;font-size:12px;line-height:120%;text-align:center;mso-line-height-alt:14.399999999999999px;">
                                          <p style="margin: 0; word-break: break-word;"><span
                                              style="color: #95979c;">Contact:
                                              support@orthoai.com</span></p>
                                        </div>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table><!-- End -->
        </body>
        
        </html>`;
        }

        if (requestType == 'resetPasswordRequest') {
          emailTemplate = `<!DOCTYPE html>
  
          <html lang="en" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:v="urn:schemas-microsoft-com:vml">
          
          <head>
            <title></title>
            <meta content="text/html; charset=utf-8" http-equiv="Content-Type" />
            <meta content="width=device-width, initial-scale=1.0" name="viewport" />
            <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch><o:AllowPNG/></o:OfficeDocumentSettings></xml><![endif]-->
            <style>
              * {
                box-sizing: border-box;
              }
          
              body {
                margin: 0;
                padding: 0;
              }
          
              a[x-apple-data-detectors] {
                color: inherit !important;
                text-decoration: inherit !important;
              }
          
              #MessageViewBody a {
                color: inherit;
                text-decoration: none;
              }
          
              p {
                line-height: inherit
              }
          
              .desktop_hide,
              .desktop_hide table {
                mso-hide: all;
                display: none;
                max-height: 0px;
                overflow: hidden;
              }
          
              .image_block img+div {
                display: none;
              }
          
              @media (max-width:660px) {
          
                .desktop_hide table.icons-inner,
                .social_block.desktop_hide .social-table {
                  display: inline-block !important;
                }
          
                .icons-inner {
                  text-align: center;
                }
          
                .icons-inner td {
                  margin: 0 auto;
                }
          
                .mobile_hide {
                  display: none;
                }
          
                .row-content {
                  width: 100% !important;
                }
          
                .stack .column {
                  width: 100%;
                  display: block;
                }
          
                .mobile_hide {
                  min-height: 0;
                  max-height: 0;
                  max-width: 0;
                  overflow: hidden;
                  font-size: 0px;
                }
          
                .desktop_hide,
                .desktop_hide table {
                  display: table !important;
                  max-height: none !important;
                }
              }
            </style>
          </head>
          
          <body style="background-color: #f8f8f9; margin: 0; padding: 0; -webkit-text-size-adjust: none; text-size-adjust: none;">
            <table border="0" cellpadding="0" cellspacing="0" class="nl-container" role="presentation"
              style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #f8f8f9;" width="100%">
              <tbody>
                <tr>
                  <td>
                    <table align="center" border="0" cellpadding="0" cellspacing="0" class="row row-1"
                      role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;" width="100%">
                      <tbody>
                        <tr>
                          <td>
                            <table align="center" border="0" cellpadding="0" cellspacing="0"
                              class="row-content stack" role="presentation"
                              style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #fff; color: #000; width: 640px; margin: 0 auto;"
                              width="640">
                              <tbody>
                                <tr>
                                  <td class="column column-1"
                                    style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; vertical-align: top; border-top: 0px; border-right: 0px; border-bottom: 0px; border-left: 0px;"
                                    width="100%">
                                    <table border="0" cellpadding="0" cellspacing="0"
                                      class="image_block block-1" role="presentation"
                                      style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;"
                                      width="100%">
                                      <tr>
                                        <td class="pad" style="width:100%;">
                                          <div align="center" class="alignment"
                                            style="line-height:10px">
                                            <img alt="Image of lock & key."
                                              src="${pathOfLogo}"
                                              style="display: block; height: auto; border: 0; max-width: 640px; width: 100%;"
                                              title="Image of lock & key." width="640" />
                                          </div>
                                        </td>
                                      </tr>
                                    </table>
                                    <table border="0" cellpadding="0" cellspacing="0"
                                      class="divider_block block-2" role="presentation"
                                      style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;"
                                      width="100%">
                                      <tr>
                                        <td class="pad" style="padding-top:30px;">
                                          <div align="center" class="alignment">
                                            <table border="0" cellpadding="0" cellspacing="0"
                                              role="presentation"
                                              style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;"
                                              width="100%">
                                              <tr>
                                                <td class="divider_inner"
                                                  style="font-size: 1px; line-height: 1px; border-top: 0px solid #BBBBBB;">
                                                  <span> </span>
                                                </td>
                                              </tr>
                                            </table>
                                          </div>
                                        </td>
                                      </tr>
                                    </table>
                                    <table border="0" cellpadding="0" cellspacing="0"
                                      class="paragraph_block block-3" role="presentation"
                                      style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;"
                                      width="100%">
                                      <tr>
                                        <td class="pad"
                                          style="padding-bottom:10px;padding-left:40px;padding-right:40px;padding-top:10px;">
                                          <div
                                            style="color:#555555;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:30px;line-height:120%;text-align:center;mso-line-height-alt:36px;">
                                            <p style="margin: 0; word-break: break-word;"><span
                                                style="color: #2b303a;"><strong>Reset Your
                                                  Password?</strong></span></p>
                                          </div>
                                        </td>
                                      </tr>
                                    </table>
                                    <table border="0" cellpadding="0" cellspacing="0"
                                      class="paragraph_block block-4" role="presentation"
                                      style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;"
                                      width="100%">
                                      <tr>
                                        <td class="pad"
                                          style="padding-bottom:10px;padding-left:40px;padding-right:40px;padding-top:10px;">
                                          <div
                                            style="color:#555555;font-family:Montserrat, Trebuchet MS, Lucida Grande, Lucida Sans Unicode, Lucida Sans, Tahoma, sans-serif;font-size:15px;line-height:150%;text-align:left;mso-line-height-alt:22.5px;">
                                            <p style="margin: 0;">We have sent you this email in
                                              response to your request to reset your password
                                              on Orthoai.To reset your password, Please follow
                                              the link below:</p>
                                          </div>
                                        </td>
                                      </tr>
                                    </table>
                                    <table border="0" cellpadding="0" cellspacing="0"
                                      class="button_block block-5" role="presentation"
                                      style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;"
                                      width="100%">
                                      <tr>
                                        <td class="pad"
                                          style="padding-left:10px;padding-right:10px;padding-top:15px;text-align:center;">
                                          <div align="center" class="alignment">
                                            <a href=${link}
                                              style="text-decoration:none;display:inline-block;color:#ffffff;background-color:#0c6af7;border-radius:35px;width:auto;border-top:0px solid transparent;font-weight:undefined;border-right:0px solid transparent;border-bottom:0px solid transparent;border-left:0px solid transparent;padding-top:15px;padding-bottom:15px;font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;text-align:center;mso-border-alt:none;word-break:keep-all;"
                                              target="_blank"><span
                                                style="padding-left:30px;padding-right:30px;font-size:16px;display:inline-block;letter-spacing:normal;"><span
                                                  style="margin: 0; word-break: break-word; line-height: 32px;"><strong>RESET
                                                    PASSWORD</strong></span></span></a><!--[if mso]></center></v:textbox></v:roundrect><![endif]-->
                                          </div>
                                        </td>
                                      </tr>
                                    </table>
                                    <table border="0" cellpadding="0" cellspacing="0"
                                      class="paragraph_block block-6" role="presentation"
                                      style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;"
                                      width="100%">
                                      <tr>
                                        <td class="pad"
                                          style="padding-bottom:10px;padding-left:40px;padding-right:40px;padding-top:30px;">
                                          <div
                                            style="color:#878787;font-family:Montserrat, Trebuchet MS, Lucida Grande, Lucida Sans Unicode, Lucida Sans, Tahoma, sans-serif;font-size:14px;line-height:150%;text-align:left;mso-line-height-alt:21px;">
                                            <p style="margin: 0;"><em>Please ignore this email
                                                if you did not request a password
                                                change.</em></p>
                                          </div>
                                        </td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <table align="center" border="0" cellpadding="0" cellspacing="0" class="row row-2"
                      role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;" width="100%">
                      <tbody>
                        <tr>
                          <td>
                            <table align="center" border="0" cellpadding="0" cellspacing="0"
                              class="row-content stack" role="presentation"
                              style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #410125; color: #000; width: 640px; margin: 0 auto;"
                              width="640">
                              <tbody>
                                <tr>
                                  <td class="column column-1"
                                    style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; vertical-align: top; border-top: 0px; border-right: 0px; border-bottom: 0px; border-left: 0px;"
                                    width="100%">
                                    <table border="0" cellpadding="0" cellspacing="0"
                                      class="paragraph_block block-3" role="presentation"
                                      style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;"
                                      width="100%">
                                      <tr>
                                        <td class="pad"
                                          style="padding-bottom:30px;padding-left:40px;padding-right:40px;padding-top:20px;">
                                          <div
                                            style="color:#555555;font-family:Montserrat, Trebuchet MS, Lucida Grande, Lucida Sans Unicode, Lucida Sans, Tahoma, sans-serif;font-size:12px;line-height:120%;text-align:center;mso-line-height-alt:14.399999999999999px;">
                                            <p style="margin: 0; word-break: break-word;"><span
                                                style="color: #95979c;">Contact:
                                                support@orthoai.com</span></p>
                                          </div>
                                        </td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table><!-- End -->
          </body>
          
          </html>`
        }

        try {
          var transport = nodemailer.createTransport(smtpTransport({
            host: 'email-smtp.ap-south-1.amazonaws.com',
            port: 465,
            secure: true,
            auth: {
              user: process.env.user,
              pass: process.env.pass
            }
          }));
          var mailOptions = {
            from: 'Ortho AI <ortho.aigpt@gmail.com>', // sender address
            to: `${email}`, // list of receivers
            subject: `${emailSubject}`, // Subject line
            html: `${emailTemplate}` // html body
          };
          transport.sendMail(mailOptions, function (error, info) {
            if (error) {
              console.log(error);
            }
            else {
              console.log('Message sent: ' + info.response);
            }
          });
          resolve(true);
        } catch (error) {
          console.log(error);
          reject(error);
        }


        // try {
        //   var transport = nodemailer.createTransport(smtpTransport({
        //     host: 'email-smtp.ap-south-1.amazonaws.com',
        //     port: 465,
        //     secure: true,
        //     auth: {
        //       user: process.env.user,
        //       pass: process.env.pass
        //     }
        //   }));
        //   var mailOptions = {
        //     from: process.env.SOURCE_EMAIL, // sender address
        //     to: `${email}`, // list of receivers
        //     subject: `${emailSubject}`, // Subject line
        //     html: `${emailTemplate}` // html body
        //   };
        //   transport.sendMail(mailOptions, function (error, info) {
        //     if (error) {
        //       console.log(error);
        //     }
        //     else {
        //       console.log('Message sent: ' + info.response);
        //     }
        //   });
        //   resolve(true);
        // } catch (error) {
        //   console.log(error);
        //   reject(error);
        // }
      });
    }
    catch (error) {
      console.log(error)
    }
  }

  public async adduserSubscription(userId, subscriptionType) {
    try {
      return await new Promise(async (resolve, reject) => {
        let amount
        const findUser = await this.users.findFirst({
          where: {
            id: userId
          }
        });

        if (!findUser) new HttpException(409, `user not found`);

        const transactionId = await generateUniqueId({
          length: 32,
          useLetters: true
        });

        console.log(transactionId)

        const findOldSubscription = await this.subscription.updateMany({
          where: {
            userId: userId
          },
          data: {
            isPlanActive: false
          }
        })

        console.log("findOldSubscription", findOldSubscription)

        if (subscriptionType == "free") {
          let endofweek = moment().add(7, 'days');
          const addfreeSubscription = await this.subscription.create({
            data: {
              userId: userId,
              subscriptionEndDate: endofweek,
              amount: 0,
              amountType: "CREDIT",
              transactionNumber: transactionId,
              paymentStatus: "SUCCESS",
              approvalStatus: "APPROVED",
              isPlanActive: true
            }
          })

          resolve(true)
        }
        else {

          var currentDate = moment(new Date());
          let futureMonthEnd, queryCount

          // let queryCount = await this.subscription.findFirst({
          //   where: {
          //     userId: userId
          //   },
          //   select: {
          //     queryCount: true
          //   }
          // })

          //console.log(queryCount)

          if (subscriptionType == "monthlyPro") {

            var futureMonth = moment(currentDate).add(1, 'M').endOf('day');
            //futureMonthEnd = moment(futureMonth).endOf('month');

            if (currentDate.date() != futureMonth.date() && futureMonth.isSame(futureMonthEnd.format('YYYY-MM-DD'))) {
              futureMonth = futureMonth.add(1, 'd');
            }

            console.log(currentDate);
            console.log(futureMonth);

            let newQueryCount = await this.general_settings.findFirst({
              where: {
                subscriptionType: "monthlyPro"
              }
            })

            console.log(newQueryCount)
            queryCount = Number(newQueryCount.limit)
            amount = newQueryCount.subscriptionAmount
            console.log(queryCount, amount)
          }

          if (subscriptionType == "monthlyEnterprise") {

            var futureMonth = moment(currentDate).add(1, 'M').endOf('day');
            //futureMonthEnd = moment(futureMonth).endOf('month');

            if (currentDate.date() != futureMonth.date() && futureMonth.isSame(futureMonthEnd.format('YYYY-MM-DD'))) {
              futureMonth = futureMonth.add(1, 'd');
            }

            console.log(currentDate);
            console.log(futureMonth);

            let newQueryCount = await this.general_settings.findFirst({
              where: {
                subscriptionType: "monthlyEnterprise"
              }
            })

            console.log(newQueryCount)
            queryCount = Number(newQueryCount.limit)
            amount = newQueryCount.subscriptionAmount
            console.log(queryCount, amount)
          }
          // if (subscriptionType == "quarterly") {
          //   queryCount = queryCount + 20

          //   var futureMonth = moment(currentDate).add(3, 'M');
          //   futureMonthEnd = moment(futureMonth).endOf('month');

          //   if (currentDate.date() != futureMonth.date() && futureMonth.isSame(futureMonthEnd.format('YYYY-MM-DD'))) {
          //     futureMonth = futureMonth.add(1, 'd');
          //   }

          //   console.log(currentDate);
          //   console.log(futureMonth);

          // }
          // if (subscriptionType == "half_yearly") {
          //   queryCount = queryCount + 30

          //   var futureMonth = moment(currentDate).add(6, 'M');
          //   futureMonthEnd = moment(futureMonth).endOf('month');

          //   if (currentDate.date() != futureMonth.date() && futureMonth.isSame(futureMonthEnd.format('YYYY-MM-DD'))) {
          //     futureMonth = futureMonth.add(1, 'd');
          //   }

          //   console.log(currentDate);
          //   console.log(futureMonth);

          // }
          // if (subscriptionType == "annually") {
          //   queryCount = queryCount + 30

          //   var futureMonth = moment(currentDate).add(12, 'M');
          //   futureMonthEnd = moment(futureMonth).endOf('month');

          //   if (currentDate.date() != futureMonth.date() && futureMonth.isSame(futureMonthEnd.format('YYYY-MM-DD'))) {
          //     futureMonth = futureMonth.add(1, 'd');
          //   }

          //   console.log(currentDate);
          //   console.log(futureMonth);
          // }

          const addSubscription = await this.subscription.create({
            data: {
              userId: userId,
              subscriptionType: subscriptionType,
              queryCount: queryCount,
              amount: amount,
              amountType: "CREDIT",
              transactionNumber: transactionId,
              paymentStatus: "SUCCESS",
              approvalStatus: "APPROVED",
              subscriptionEndDate: futureMonth,
              isPlanActive: true
            }
          })

          resolve(true)

        }
      })
    }
    catch (error) {
      console.log(error)
    }
  }

  public async thirdPartyLogin(): Promise<any> {
    try {
      return await new Promise(async (resolve: any, reject: any) => {
        var req = await unirest('POST', 'https://api.orthoai.in/api/request-token')
          .headers({
            'Content-Type': 'application/json'
          })
          .send(JSON.stringify({
            "username": "apiadmin",
            "password": "OrthoAIAPI@2023"
          }))
          .end(function (res) {
            if (res.error) throw new Error(res.error);
            console.log(res.raw_body);
            resolve(JSON.parse(res.raw_body));
          });
      })
    }
    catch (error) {
      console.log(error)
    }
  }

  public async addUserToGlobalServer(token, username, password): Promise<any> {
    try {
      return await new Promise(async (resolve: any, reject: any) => {
        var req = await unirest('POST', 'https://api.orthoai.in/api/admin/users/new')
          .headers({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          })
          .send(JSON.stringify({
            "username": username,
            "password": password,
            "role": "default"
          }))
          .end(function (res) {
            if (res.error) throw new Error(res.error);
            console.log(res.raw_body);
            resolve(JSON.parse(res.raw_body))
          });

      })
    }
    catch (error) {
      console.log(error)
    }
  }

  public async getGlobalUserList(token): Promise<any> {
    try {
      return await new Promise(async (resolve: any, reject: any) => {
        var req = await unirest('GET', 'https://api.orthoai.in/api/admin/workspaces')
          .headers({
            'Authorization': `Bearer ${token}`
          })
          .end(function (res) {
            if (res.error) throw new Error(res.error);
            //console.log("1236",res.raw_body);
            resolve(JSON.parse(res.raw_body));
          });
      })
    }
    catch (error) {
      console.log(error)
    }
  }

  public async updateArray(token, array,id): Promise<any> {
    console.log(array, "array 1242")
    try {
      return await new Promise(async (resolve: any, reject: any) => {
        var req = await unirest('POST', `https://api.orthoai.in/api/admin/workspaces/${Number(id)}/update-users`)
          .headers({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          })
          .send(JSON.stringify({
            "userIds": array
          }))
          .end(function (res) {
            if (res.error) throw new Error(res.error);
            resolve(res.raw_body);
          });

      })
    }
    catch (error) {
      console.log(error)
    }
  }

  public async updateArrayForPatient(token, array): Promise<any> {
    console.log(array, "array 1242")
    try {
      return await new Promise(async (resolve: any, reject: any) => {
        var req = await unirest('POST', 'https://api.orthoai.in/api/admin/workspaces/9/update-users')
          .headers({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          })
          .send(JSON.stringify({
            "userIds": array
          }))
          .end(function (res) {
            if (res.error) throw new Error(res.error);
            resolve(res.raw_body);
          });

      })
    }
    catch (error) {
      console.log(error)
    }
  }

  public async serverLogin(username: string, password: string): Promise<any> {
    console.log(username, password);
  
    try {
      // Return a promise for the API call
      return await new Promise(async (resolve, reject) => {
        // Make the API request
        unirest('POST', 'https://api.orthoai.in/api/request-token')
          .headers({
            'Content-Type': 'application/json'
          })
          .send(JSON.stringify({
            "username": username,
            "password": password
          }))
          .end(function (res) {
            // Handle response error (like 502)
            if (res.error) {
              console.error('API error: ', res.error);
              return reject(new Error('Third-party server error occurred.')); // Reject with an error message
            }
  
            // Handle successful response
            try {
              const result = JSON.parse(res.raw_body);
              console.log("API Response: ", result);
              resolve(result); // Resolve the promise with the parsed result
            } catch (err) {
              console.error('Parsing error: ', err);
              reject(new Error('Failed to parse server response.')); // Reject if there's a parsing error
            }
          });
      });
    } catch (error) {
      // Catch any other errors and log them
      console.error('Unexpected error: ', error);
      throw new Error('Internal server error occurred.');
    }
  }
  
  public async getUserCount(): Promise<any> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set the time to 00:00:00 for the start of today
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1); // Set the date to the next day

      const count = await this.users.count({
        where: {
          genId: {
            not: {
              equals: null,
            }
          }
        }
      })

      const todaysSignUp = await this.users.count({
        where: {
          createdAt: {
            gte: today, // Greater than or equal to the start of today
            lt: tomorrow, // Less than the start of tomorrow
          },
        },
      })

      const todaysQuestionAsked = await this.QA.count({
        where: {
          createdAt: {
            gte: today, // Greater than or equal to the start of today
            lt: tomorrow, // Less than the start of tomorrow
          },
        },
      })

      let response = {
        totalUsers: count,
        todaysSignUp: todaysSignUp,
        todaysQuestionAsked: todaysQuestionAsked
      }

      return response;
    }
    catch (error) {
      console.log(error)
      throw new HttpException(409, error);
    }
  }
}

export default AuthService;