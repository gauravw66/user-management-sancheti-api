import { NextFunction, Request, Response } from 'express';
import fileService from '../services/auth.service';
import prisma from "../lib/prisma";
import aws from 'aws-sdk';

const s3BucketPublic = 'orthoaifiles';

interface MulterRequest extends Request {
    files: any;
    file: any;
}

class fileController {
    public fileUploadService = new fileService()

    public upload = async (req: any, res: Response, next: NextFunction): Promise<void> => {
        try {
            console.log("here")
            const documentFile = (req as MulterRequest).files;
            const uploadData: any = await this.fileUploadService.upload(documentFile);

            let result: any = []

            for (let element of documentFile) {
                let obj = {
                    name: element.originalname,
                    url: element.location
                }
                result.push(obj)
            }

            res.status(200).json({ data: result, message: 'file uploaded' });
        } catch (error) {
            console.log(error)
            next(error);
        }
    };
}

export default fileController;