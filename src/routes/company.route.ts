import { Router } from 'express';
import CompanyController from '@controllers/company.controller';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';

class CompanyRoute implements Routes {
  public path = '/company';
  public router = Router();
  public companyController = new CompanyController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}`, this.companyController.createCompany); // Create a new company
    this.router.get(`${this.path}/:id`, this.companyController.getCompanyById); // Get a single company by ID
    this.router.put(`${this.path}/:id`, this.companyController.updateCompany); // Update company by ID
    this.router.delete(`${this.path}/:id`, this.companyController.deleteCompany); // Delete company by ID
    this.router.get(`${this.path}`, this.companyController.getAllCompanies); // Get all companies
  }
}

export default CompanyRoute;
