import { BaseResource } from './base.js';
import { Company, CompanyCreateData, CompanyUpdateData } from '../../core/types.js';

export class CompaniesAPI extends BaseResource {
  async create(data: CompanyCreateData): Promise<Company> {
    return this.client.post<Company>('/companies', data);
  }

  async update(companyId: number, data: CompanyUpdateData): Promise<Company> {
    return this.client.put<Company>(`/companies/${companyId}`, data);
  }

  async get(companyId: number): Promise<Company> {
    return this.client.get<Company>(`/companies/${companyId}`);
  }

  async list(options?: {
    page?: number;
    per_page?: number;
  }): Promise<Company[]> {
    const queryString = options ? this.buildQueryString(options) : '';
    return this.client.get<Company[]>(`/companies${queryString}`);
  }

  async delete(companyId: number): Promise<void> {
    return this.client.delete<void>(`/companies/${companyId}`);
  }

  async search(query: string, options?: {
    page?: number;
    per_page?: number;
  }): Promise<{ results: Company[]; total: number }> {
    const params = { query, ...options };
    const queryString = this.buildQueryString(params);
    return this.client.get<{ results: Company[]; total: number }>(`/search/companies${queryString}`);
  }
}