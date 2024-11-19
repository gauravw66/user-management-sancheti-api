import '@/index';
import config from 'config';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import morgan from 'morgan';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Routes } from '@interfaces/routes.interface';
import errorMiddleware from '@middlewares/error.middleware';
import { logger, stream } from '@utils/logger';
import multer from 'multer';
import passport from 'passport';
const session = require('express-session');
import moment from 'moment';
import cron from 'node-cron';
import prisma from './lib/prisma';

class App {
  public app: express.Application;
  public port: string | number;
  public env: string;
  public subscription = prisma.subscription

  constructor(routes: Routes[]) {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.env = process.env.NODE_ENV || 'development';

    this.initializeMiddlewares();
    this.initializeRoutes(routes);
    this.initializeSwagger();
    this.initializeErrorHandling();
  }

  public listen() {
    this.app.listen(this.port, () => {
      logger.info(`=================================`);
      logger.info(`======= ENV: ${this.env} =======`);
      logger.info(`🚀 App listening on the port ${this.port}`);
      logger.info(`=================================`);
    });

    // cron.schedule('0 1 * * *', async () => {
    //   console.log("every second")
    //   const subscription = await this.subscription.findMany({
    //     where: {
    //       isPlanActive: true
    //     },
    //     select: {
    //       id: true,
    //       subscriptionEndDate : true
    //     }
    //   })

    //   for(let i = 0; i < subscription.length; i++) {
        
    //     const endDate = moment(subscription[i].subscriptionEndDate)
    //     const currentDate = moment()
    //     const diff = endDate.diff(currentDate, 'days')

    //     console.log(endDate,currentDate,diff)

    //     if(diff <= 0) {
    //       await this.subscription.update({
    //         where: {
    //           id: subscription[i].id
    //         },
    //         data: {
    //           isPlanActive: false
    //         }
    //       })
    //     }
    //   }
    // })
  }

  public sess = {
    secret: 'ortho chat gpt',
    cookie: {}
  }

  public getServer() {
    return this.app;
  }

  private initializeMiddlewares() {
    this.app.use(morgan(config.get('log.format'), { stream }));
    // this.app.use('/*', function (req, res, next) {
    //   res.header("Access-Control-Allow-Origin", "*");
    //   res.header("Access-Control-Allow-Headers", "X-Requested-With");
    //   res.header('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS');
    //   res.header('Access-Control-Allow-Headers: Origin, Content-Type, X-Auth-Token');
    //   res.header("Access-Control-Allow-Headers", "content-type, accept");
    //   res.header("Access-Control-Allow-Credentials", "true");
    //   res.header("Access-Control-Allow-Headers", "Content-Type, X-Requested-With, X-PINGOTHER, X-File-Name");
    //   res.header("Cache-Control", "no-cache, no-store, must-revalidate")
    //   res.header("Pragma", "no-cache")
    //   res.header("Expires", "0")
    //   next();
    // })
    this.app.use(cors())
    //this.app.use(cors({ origin: config.get('cors.origin'), credentials: config.get('cors.credentials') }));
    this.app.use(hpp());
    this.app.use(helmet());
    this.app.use(compression());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cookieParser());
    this.app.use((session(this.sess)));
    //this.app.use(multer().any()); // Initialize Passport.js and session for storing user data
    this.app.use(passport.initialize());
    this.app.use(passport.session());
  }

  private initializeRoutes(routes: Routes[]) {
    routes.forEach(route => {
      this.app.use('/', route.router);
    });
  }

  private initializeSwagger() {
    const options = {
      swaggerDefinition: {
        info: {
          title: 'REST API',
          version: '1.0.0',
          description: 'Example docs',
        },
      },
      apis: ['swagger.yaml'],
    };

    const specs = swaggerJSDoc(options);
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
  }

  private initializeErrorHandling() {
    this.app.use(errorMiddleware);
  }
}

export default App;
