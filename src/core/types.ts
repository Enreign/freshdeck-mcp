export interface FreshdeskConfig {
  domain: string;
  apiKey: string;
  maxRetries?: number;
  timeout?: number;
  rateLimitPerMinute?: number;
}

export interface PaginationParams {
  page?: number;
  per_page?: number;
}

export interface ListResponse<T> {
  data: T[];
  total?: number;
  page?: number;
  per_page?: number;
}

export interface ApiError {
  code: string;
  message: string;
  field?: string;
  errors?: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: Date;
}

export type Priority = 1 | 2 | 3 | 4;
export type Status = 2 | 3 | 4 | 5 | 6 | 7;
export type Source = 1 | 2 | 3 | 7 | 8 | 9 | 10;

export interface Ticket {
  id: number;
  subject: string;
  description_text: string;
  description: string;
  status: Status;
  priority: Priority;
  source: Source;
  requester_id: number;
  responder_id?: number;
  group_id?: number;
  company_id?: number;
  product_id?: number;
  type?: string;
  due_by?: string;
  fr_due_by?: string;
  is_escalated: boolean;
  created_at: string;
  updated_at: string;
  tags: string[];
  attachments: Attachment[];
  cc_emails: string[];
  fwd_emails: string[];
  reply_cc_emails: string[];
  custom_fields: Record<string, any>;
}

export interface Contact {
  id: number;
  name: string;
  email: string;
  phone?: string;
  mobile?: string;
  twitter_id?: string;
  unique_external_id?: string;
  other_emails: string[];
  company_id?: number;
  view_all_tickets: boolean;
  other_companies: number[];
  address?: string;
  avatar?: Avatar;
  active: boolean;
  description?: string;
  job_title?: string;
  language: string;
  time_zone: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  custom_fields: Record<string, any>;
}

export interface Agent {
  id: number;
  available: boolean;
  occasional: boolean;
  signature?: string;
  ticket_scope: number;
  created_at: string;
  updated_at: string;
  last_active_at?: string;
  available_since?: string;
  type: string;
  contact: {
    active: boolean;
    email: string;
    job_title?: string;
    language: string;
    mobile?: string;
    name: string;
    phone?: string;
    time_zone: string;
    created_at: string;
    updated_at: string;
  };
  role_ids: number[];
  group_ids: number[];
  skill_ids: number[];
}

export interface Company {
  id: number;
  name: string;
  description?: string;
  note?: string;
  domains: string[];
  created_at: string;
  updated_at: string;
  custom_fields: Record<string, any>;
  health_score?: string;
  account_tier?: string;
  renewal_date?: string;
  industry?: string;
}

export interface Conversation {
  id: number;
  user_id: number;
  from_email: string;
  to_emails: string[];
  cc_emails: string[];
  bcc_emails: string[];
  body: string;
  body_text: string;
  incoming: boolean;
  private: boolean;
  support_email?: string;
  ticket_id: number;
  created_at: string;
  updated_at: string;
  attachments: Attachment[];
}

export interface Attachment {
  id: number;
  name: string;
  content_type: string;
  size: number;
  created_at: string;
  updated_at: string;
  attachment_url: string;
  thumb_url?: string;
}

export interface Avatar {
  avatar_url?: string;
  content_type?: string;
  id: number;
  name: string;
  size: number;
  created_at: string;
  updated_at: string;
}