import { Router } from 'express';
import fileController from '../controllers/upload.controller';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import multer from 'multer';
import { S3Client } from '@aws-sdk/client-s3'; // Use the new S3Client
import multerS3 from 'multer-s3';
import { HttpException } from '@/exceptions/HttpException';
const aws = require('aws-sdk');

aws.config.update({
    secretAccessKey: process.env.secretAccessKey,
    accessKeyId: process.env.accessKeyId,
    region: process.env.region
  });
  const s3 = new aws.S3();
  const maxSize =  50 * 1048576

const s3BucketPublic = process.env.PUBLIC_BUCKET_NAME;

// Set up multer for file uploads to S3
const upload = multer({
    storage: multerS3({
      s3: s3,
      bucket: s3BucketPublic,
      contentType: multerS3.AUTO_CONTENT_TYPE,
      acl: 'public-read',
      metadata: (req, file, cb) => {
        cb(null, { fieldName: file.fieldname });
      },
      key: (req, file, cb) => {
        cb(null, Date.now().toString() + file.originalname);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10MB
  });
  

class fileRoute implements Routes {
  public path = '/';
  public router = Router();
  public fileController = new fileController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`/upload/public`, upload.array('file'), this.fileController.upload);
  }
}

export default fileRoute;
