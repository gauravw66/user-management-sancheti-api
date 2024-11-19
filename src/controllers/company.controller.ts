import { NextFunction, Request, Response } from 'express';
import CompanyService from '@services/company.service';

class CompanyController {
  public companyService = new CompanyService();

  // Create a new company
  public createCompany = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyData = req.body;
      const createCompanyData = await this.companyService.createCompany(companyData);
      res.status(201).json({ data: createCompanyData, message: 'Company created successfully' });
    } catch (error) {
      next(error);
    }
  };

  // Get a single company by ID
  public getCompanyById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = req.params.id;
      const company = await this.companyService.getCompanyById(companyId);
      res.status(200).json({ data: company, message: 'Company retrieved successfully' });
    } catch (error) {
      next(error);
    }
  };

  // Update an existing company
  public updateCompany = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = req.params.id;
      const companyData = req.body;
      const updatedCompany = await this.companyService.updateCompany(companyId, companyData);
      res.status(200).json({ data: updatedCompany, message: 'Company updated successfully' });
    } catch (error) {
      next(error);
    }
  };

  // Delete a company by ID
  public deleteCompany = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = req.params.id;
      await this.companyService.deleteCompany(companyId);
      res.status(200).json({ message: 'Company deleted successfully' });
    } catch (error) {
      next(error);
    }
  };

  // Get all companies
  public getAllCompanies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const allCompanies = await this.companyService.getAllCompanies();
      res.status(200).json({ data: allCompanies, message: 'Companies retrieved successfully' });
    } catch (error) {
      next(error);
    }
  };
}

export default CompanyController;
