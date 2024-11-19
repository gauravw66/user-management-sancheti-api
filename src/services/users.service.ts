import { hash, compare } from 'bcrypt';
import { sign } from 'jsonwebtoken'
import { HttpException } from '@exceptions/HttpException';
import { isEmpty } from '@utils/util';
import { Strategy } from 'passport-google-oauth20'
import passport from 'passport'
import prisma from '../lib/prisma';
import AuthService from './auth.service';
import unirest from 'unirest';

class UserService {
  public users = prisma.users;
  public QA = prisma.QA
  public tokens = prisma.tokens;
  public signupToken = prisma.signupToken;
  public subscription = prisma.subscription;
  public general_settings = prisma.general_settings
  public workspaces = prisma.workspaces
  public serverLogin = new AuthService().serverLogin;
  public adduserSubscription = new AuthService().adduserSubscription
  public thirdPartyLogin = new AuthService().thirdPartyLogin
  public addUserToGlobalServer = new AuthService().addUserToGlobalServer
  public getGlobalUserList = new AuthService().getGlobalUserList
  public updateArray = new AuthService().updateArray
  public updateArraysforPatient = new AuthService().updateArrayForPatient

  public async createUser(userData): Promise<any> {
    if (isEmpty(userData)) throw new HttpException(400, "You are not userData");

    let { username, password } = userData;

    const findUser: any = await this.users.findFirst({ where: { username: username } });
    if (findUser) throw new HttpException(409, `Your username ${username} already exists`);

    const hashedPassword = await hash(password, 10);
    const createUserData = await this.users.create({ data: { ...userData, password: hashedPassword } });
    return createUserData;
  }

  public async userLogin(username: string, password: string): Promise<any> {

    if (!username || !password) {
      throw new HttpException(400, "Plz Enter Credentials");
    }

    const user = await this.users.findFirst({
      where: {
        username: username
      }
    })

    if (!user) {
      throw new HttpException(400, "Invalid Username");
    }

    let decrypt_password = await compare(password, user.password)
    console.log(decrypt_password)
    if (!decrypt_password) {
      throw new HttpException(400, "Invalid password");
    }

    const dataStoredInToken = { id: user.id };
    const secretKey = 'secretKey'
    const expiresIn = '1d';
    const token = sign(dataStoredInToken, secretKey, { expiresIn });

    return token
  }

  public async findAllUser(): Promise<any[]> {
    const allUser: any[] = await this.users.findMany();
    return allUser;
  }

  public async loginWithGmail(data): Promise<any> {
    try {
      console.log("76 =======================================>", data)
      let email = data.email.trim().toLowerCase();

      const findUser: any = await this.users.findFirst({
        where: { email: email },
        include: {
          subscription: {
            take: 1,
            orderBy: {
              updatedAt: 'desc'
            }
          }
        }
      });

      console.log("91 ==========================================>", findUser)
      if (findUser) {
        const dataStoredInToken = { id: findUser.id };
        const secretKey = process.env.secretKey
        const expiresIn = '1d';
        const token: any = sign(dataStoredInToken, secretKey, { expiresIn });

        const findUserToken = await this.tokens.findFirst({
          where: {
            user_id: findUser.id
          }
        })

        if (findUserToken) {
          const saveToekn = await this.tokens.updateMany({
            where: {
              user_id: findUser.id
            },
            data: {
              token: token
            },
          })
        }
        else {
          const saveToekn = await this.tokens.create({
            data: {
              token: token,
              user_id: findUser.id
            }
          });
        }

        if (findUser.isSSOuser == false) {
          console.log("124 ============================>", findUser.isSSOuser)

          let updateUserData = await this.users.updateMany({
            where: {
              email: email
            },
            data: {
              isSSOuser: true,
              googleId: data.id,
            }
          })

          console.log("135 =====================================>", updateUserData)

          let loginToServer = await this.thirdPartyLogin()

          try {
            var req = await unirest('POST', `https://api.orthoai.in/api/admin/user/${findUser.genId}`)
              .headers({
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${loginToServer.token}`
              })
              .send(JSON.stringify({
                "username": `${email}`,
                "password": `${data.id}`,
                "role": "default"
              }))
              .end(function (res) {
                if (res.error) {
                  console.log(res.error)
                }
                else {
                  console.log("151 ========================================>", res.raw_body);
                }
              });
          }
          catch (error) {
            console.log("144 =====================================>", error)
          }

          let serverLogin = await this.serverLogin(email, data.id)

          console.log("156 ============================>", serverLogin)

          if (serverLogin) {
            findUser.userType = findUser.userType ? findUser.userType : null
            console.log("139", `?token=${token}&chatToken=${serverLogin.token}&id=${findUser.id}&firstName=${findUser.firstName}&lastName=${findUser.lastName}&email=${email}&status=${findUser.status}&queryCount=${findUser.subscription[0]?.queryCount}&isPlanActive=${findUser.subscription[0]?.isPlanActive}&subscriptionType=${findUser.subscription[0]?.subscriptionType}&userType=${findUser.userType}`)
            return `?token=${token}&chatToken=${serverLogin.token}&id=${findUser.id}&firstName=${findUser.firstName}&lastName=${findUser.lastName}&email=${email}&status=${findUser.status}&queryCount=${findUser.subscription[0]?.queryCount}&isPlanActive=${findUser.subscription[0]?.isPlanActive}&subscriptionType=${findUser.subscription[0]?.subscriptionType}&userType=${findUser.userType}`
          }

        } else if (findUser.isSSOuser == true) {
          let serverLogin = await this.serverLogin(email, data.id)

          console.log("125", serverLogin)

          if (serverLogin) {
            console.log("169", findUser.userType)
            console.log("139", `?token=${token}&chatToken=${serverLogin.token}&id=${findUser.id}&firstName=${findUser.firstName}&lastName=${findUser.lastName}&email=${email}&status=${findUser.status}&queryCount=${findUser.subscription[0]?.queryCount}&isPlanActive=${findUser.subscription[0]?.isPlanActive}&subscriptionType=${findUser.subscription[0]?.subscriptionType}&userType=${findUser.userType}`)
            return `?token=${token}&chatToken=${serverLogin.token}&id=${findUser.id}&firstName=${findUser.firstName}&lastName=${findUser.lastName}&email=${email}&status=${findUser.status}&queryCount=${findUser.subscription[0]?.queryCount}&isPlanActive=${findUser.subscription[0]?.isPlanActive}&subscriptionType=${findUser.subscription[0]?.subscriptionType}&userType=${findUser.userType}`
          }

        }
      } else {
        const createUserData = await this.users.create({
          data: {
            email: email,
            firstName: data.firstName,
            lastName: data.lastName,
            status: true,
            isSSOuser: true,
            profilePic: data.picture,
            googleId: data.id
          }
        });

        const addfreeTier = await this.adduserSubscription(createUserData.id, "free")

        let loginToServer = await this.thirdPartyLogin()

        let addUserToGlobalServer = await this.addUserToGlobalServer(loginToServer.token, email, data.id)
        let globalUserId = addUserToGlobalServer.user.id
        console.log("globalUserId", globalUserId)

        const updateUserGenId = await this.users.update({
          where: {
            id: createUserData.id
          },
          data: {
            genId: globalUserId.toString()
          }
        })

        console.log("194 =========================>", updateUserGenId)

        let getGlobalUserList = await this.getGlobalUserList(loginToServer.token)

        for (let i = 0; i < getGlobalUserList.workspaces.length; i++) {
          //if (getGlobalUserList.workspaces[i].name == "orthoglobal1") {
          let newArray = getGlobalUserList.workspaces[i].userIds
          newArray.push(globalUserId)
          console.log("newArray 184 ====>", newArray)

          let updateArrays = await this.updateArray(loginToServer.token, newArray)
          console.log("updateArrays", updateArrays)

          let updateArraysforPatient = await this.updateArraysforPatient(loginToServer.token, newArray)
          console.log("updateArraysforPatient", updateArraysforPatient)
          //}
        }

        const serverLogin = await this.serverLogin(email, data.id)
        console.log(serverLogin)

        const dataStoredInToken = { id: createUserData.id };
        const secretKey = process.env.secretKey
        const expiresIn = '1d';
        const token: any = sign(dataStoredInToken, secretKey, { expiresIn });

        const findUserToken = await this.tokens.findFirst({
          where: {
            user_id: createUserData.id
          }
        })

        if (findUserToken) {
          const saveToekn = await this.tokens.updateMany({
            where: {
              user_id: createUserData.id
            },
            data: {
              token: token
            },
          })
        }
        else {
          const saveToekn = await this.tokens.create({
            data: {
              token: token,
              user_id: createUserData.id
            }
          });
        }

        const newserverLogin = await this.serverLogin(email, data.id)

        console.log(newserverLogin)

        const findUser: any = await this.users.findFirst({
          where: { email: email },
          include: {
            subscription: {
              take: 1,
              orderBy: {
                updatedAt: 'desc'
              }
            }
          }
        });

        console.log(`?token=${token}&chatToken=${serverLogin.token}&id=${findUser.id}&firstName=${findUser.firstName}&lastName=${findUser.lastName}&email=${email}&status=${findUser.status}&queryCount=${findUser.subscription[0]?.queryCount}&isPlanActive=${findUser.subscription[0]?.isPlanActive}&subscriptionType=${findUser.subscription[0]?.subscriptionType}`)
        return `?token=${token}&chatToken=${serverLogin.token}&id=${findUser.id}&firstName=${findUser.firstName}&lastName=${findUser.lastName}&email=${email}&status=${findUser.status}&queryCount=${findUser.subscription[0]?.queryCount}&isPlanActive=${findUser.subscription[0]?.isPlanActive}&subscriptionType=${findUser.subscription[0]?.subscriptionType}`
      }
    }
    catch (error) {
      console.log(error)
      return error
    }
  }

  public async saveQuestion(userId, question, workspaceId, url): Promise<any> {
    try {
      const findUser = await this.users.findFirst({
        where: {
          id: userId,
          status: true
        },
        include: {
          subscription: {
            take: 1,
            orderBy: {
              updatedAt: 'desc',
            }
          }
        }
      })


      if (!findUser) throw new HttpException(409, `user not found`);
      console.log(findUser)

      // if (findUser.subscription[0].isPlanActive == false) {
      //   throw new HttpException(409, `You've been navigating through the complexities of orthopaedics with OrthoAI, and we noticed you've reached your question limit for this month. Your thirst for knowledge is inspiring!
      //   To continue receiving evidence-based orthopaedic insights without interruption, consider upgrading your plan.`);
      // }

      // if (findUser.subscription[0].queryCount == 0) {
      //   throw new HttpException(409, `You've been navigating through the complexities of orthopaedics with OrthoAI, and we noticed you've reached your question limit for this month. Your thirst for knowledge is inspiring!
      //   To continue receiving evidence-based orthopaedic insights without interruption, consider upgrading your plan.`);
      // }

      let saveWorkSpace, saveQuestion, reduceQueryCount
      if (!workspaceId) {
        saveWorkSpace = await this.workspaces.create({
          data: {
            userId: userId
          }
        })

        console.log(saveWorkSpace.id, "saveWorkSpace.id")

        saveQuestion = await this.QA.create({
          data: {
            userId: userId,
            question: question,
            workspaceId: saveWorkSpace.id,
            url: url
          }
        })

        reduceQueryCount = await this.subscription.updateMany({
          where: {
            userId: userId,
            isPlanActive: true
          },
          data: {
            queryCount: findUser.subscription[0].queryCount - 1
          }
        })

        return { id: saveQuestion.id, balance: findUser.subscription[0].queryCount - 1, workspaceId: saveWorkSpace.id }
      }
      else {

        saveQuestion = await this.QA.create({
          data: {
            userId: userId,
            question: question,
            workspaceId: workspaceId,
            url: url
          }
        })

        console.log(saveQuestion.id, "saveQuestion")

        reduceQueryCount = await this.subscription.updateMany({
          where: {
            userId: userId,
            isPlanActive: true
          },
          data: {
            queryCount: findUser.subscription[0].queryCount - 1
          }
        })

        return { id: saveQuestion.id, balance: findUser.subscription[0].queryCount - 1, workspaceId: workspaceId }
      }
    }
    catch (error) {
      console.log(error);
      throw error;
    }
  }

  public async updateAnswerOrError(questionId, answer, error, workspaceId, vote, reason): Promise<any> {
    try {
      const findQuestion = await this.QA.findFirst({
        where: {
          id: questionId
        }
      });

      if (!findQuestion) throw new HttpException(409, `question not found`);

      const saveQuestion = await this.QA.update({
        where: {
          id: questionId
        },
        data: {
          answer: answer,
          error: error,
          workspaceId: workspaceId,
          vote: vote,
          reason: reason
        }
      })

      return saveQuestion

    }
    catch (error) {
      console.log(error);
      throw error;
    }
  }

  public async getSubsciptionPlan(): Promise<any> {
    try {
      const getSubsciptionPlan = await this.general_settings.findMany({
        select: {
          subscriptionAmount: true,
          subscriptionType: true,
          limit: true,
          offers: true
        }
      })
      return getSubsciptionPlan
    }

    catch (error) {
      console.log(error);
      throw error;
    }
  }

  public async getWorkspacesByUserId(userId): Promise<any> {
    try {
      console.log(userId, "userId")

      const getWorkspacesByUserId = await this.workspaces.findMany({
        where: {
          userId: userId,
          isDeleted: false
        },
        include: {
          QA: true
        },
        orderBy: {
          createdAt: 'desc',
        }
      })

      console.log(getWorkspacesByUserId, "getWorkspacesByUserId")

      return getWorkspacesByUserId
    }
    catch (error) {
      console.log(error);
      throw error;
    }
  }

  public async deleteWorkspaceId(workspaceId): Promise<any> {
    try {
      console.log(workspaceId)

      const deleteWorkspaceId = await this.workspaces.updateMany({
        where: {
          id: workspaceId
        },
        data: {
          isDeleted: true
        }
      })

      return deleteWorkspaceId

    } catch (error) {
      console.log(error)
      return error
    }
  }

  public async discover(data): Promise<any> {
    try {
      // Extract count, page, and tag from req.query
      const { count = 10, page = 1, tag } = data;

      // Parse count and page to integers
      const take = parseInt(count) || 10; // Limit the number of results (default to 10)
      const skip = (parseInt(page) - 1) * take; // Calculate the offset for pagination

      // Define where clause based on the tag, link, and imageUrl
      const whereClause = {
        link: { not: { equals: '' } },
        imageUrl: { not: { equals: '' } },
        ...(tag ? { tags: tag } : {}) // Filter by tag if provided
      };

      // Fetch discover records with pagination, tag filtering, and ordering
      const discovers = await prisma.discover.findMany({
        where: whereClause,
        take, // Limit the number of results
        skip, // Offset for pagination
        select: {
          tags: true,
          id: true,
          title: true,
          link: true,
          snippet: true,
          date: true,
          source: true,
          imageUrl: true,
          position: true,
          tags_discover_tagsTotags: {
            select: {
              name: true
            }
          }
        },
        orderBy: [
          { position: 'desc' }, // Order by position in descending order
          { createdAt: 'desc' } // Order by createdAt in descending order (as fallback)
        ]
      });

      // Count total records that match the filter
      const total = await prisma.discover.count({
        where: whereClause
      });

      // Respond with data and pagination info
      return {
        articles: discovers,
        pagination: {
          total, // Total number of records
          page: parseInt(page), // Current page
          count: take, // Number of records per page
          pages: Math.ceil(total / take) // Total number of pages
        }
      };
    } catch (error) {
      console.error('Error fetching discovers: ', error);
      return { error: 'Internal server error' };
    }
  }
}

export default UserService;