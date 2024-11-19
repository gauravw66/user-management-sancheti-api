import { PrismaClient } from '@prisma/client';
import { HttpException } from '@exceptions/HttpException';
import { isEmpty } from '@utils/util';
import prisma from '../lib/prisma';

class CompanyService {
  public company = prisma.company;

  // Create a new company
  public async createCompany(companyData): Promise<any> {
    if (isEmpty(companyData)) throw new HttpException(400, 'Company data is empty');

    // Check if the company already exists (based on a unique identifier like name or GST)
    const findCompany = await this.company.findMany({
      where: { gst: companyData.gst }, // You can change this based on what field is unique in your schema
    });

    if (findCompany.length>0) throw new HttpException(409, `Company with GST ${companyData.gst} already exists`);

    // Create new company
    const createCompanyData = await this.company.create({ data: { ...companyData } });
    return createCompanyData;
  }

  // Update an existing company
  public async updateCompany(companyId: string, companyData): Promise<any> {
    if (isEmpty(companyData)) throw new HttpException(400, 'Company data is empty');

    // Check if the company exists
    const findCompany = await this.company.findUnique({ where: { id: companyId } });
    if (!findCompany) throw new HttpException(404, `Company with ID ${companyId} not found`);

    // Update company
    const updateCompanyData = await this.company.update({
      where: { id: companyId },
      data: { ...companyData },
    });

    return updateCompanyData;
  }

  // Get a single company by ID
  public async getCompanyById(companyId: string): Promise<any> {
    const findCompany = await this.company.findUnique({ where: { id: companyId } });
    if (!findCompany) throw new HttpException(404, `Company with ID ${companyId} not found`);

    return findCompany;
  }

  // Delete a company by ID
  public async deleteCompany(companyId: string): Promise<any> {
    const findCompany = await this.company.findUnique({ where: { id: companyId } });
    if (!findCompany) throw new HttpException(404, `Company with ID ${companyId} not found`);

    await this.company.delete({ where: { id: companyId } });
    return { message: 'Company deleted successfully' };
  }

  // Fetch all companies
  public async getAllCompanies(): Promise<any> {
    const allCompanies = await this.company.findMany();
    return allCompanies;
  }
}

export default CompanyService;
