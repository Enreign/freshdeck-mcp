export enum AccessLevel {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  ADMIN = 'admin'
}

export enum Permission {
  // Ticket permissions
  TICKETS_READ = 'tickets:read',
  TICKETS_WRITE = 'tickets:write',
  TICKETS_DELETE = 'tickets:delete',
  
  // Contact permissions
  CONTACTS_READ = 'contacts:read',
  CONTACTS_WRITE = 'contacts:write',
  CONTACTS_DELETE = 'contacts:delete',
  
  // Agent permissions
  AGENTS_READ = 'agents:read',
  AGENTS_WRITE = 'agents:write',
  AGENTS_ADMIN = 'agents:admin',
  
  // Company permissions
  COMPANIES_READ = 'companies:read',
  COMPANIES_WRITE = 'companies:write',
  COMPANIES_DELETE = 'companies:delete',
  
  // Conversation permissions
  CONVERSATIONS_READ = 'conversations:read',
  CONVERSATIONS_WRITE = 'conversations:write',
  
  // Product permissions
  PRODUCTS_READ = 'products:read',
  PRODUCTS_WRITE = 'products:write',
  
  // Group permissions
  GROUPS_READ = 'groups:read',
  GROUPS_WRITE = 'groups:write',
  
  // Custom field permissions
  CUSTOM_FIELDS_READ = 'custom_fields:read',
  CUSTOM_FIELDS_WRITE = 'custom_fields:write',
  
  // Solution permissions
  SOLUTIONS_READ = 'solutions:read',
  SOLUTIONS_WRITE = 'solutions:write',
  
  // Time entry permissions
  TIME_ENTRIES_READ = 'time_entries:read',
  TIME_ENTRIES_WRITE = 'time_entries:write',
  
  // Analytics permissions
  ANALYTICS_READ = 'analytics:read',
  
  // Automation permissions
  AUTOMATIONS_READ = 'automations:read',
  AUTOMATIONS_WRITE = 'automations:write',
  
  // Export permissions
  EXPORT_DATA = 'export:data',
  
  // Search permissions
  SEARCH = 'search'
}

export interface UserPermissions {
  // Access levels
  accessLevel: AccessLevel;
  isReadOnly: boolean;
  canWrite: boolean;
  canDelete: boolean;
  isAdmin: boolean;
  
  // Specific permissions
  permissions: Set<Permission>;
  
  // Resource-specific capabilities
  capabilities: {
    tickets: {
      read: boolean;
      write: boolean;
      delete: boolean;
    };
    contacts: {
      read: boolean;
      write: boolean;
      delete: boolean;
    };
    agents: {
      read: boolean;
      write: boolean;
      admin: boolean;
    };
    companies: {
      read: boolean;
      write: boolean;
      delete: boolean;
    };
    conversations: {
      read: boolean;
      write: boolean;
    };
    products: {
      read: boolean;
      write: boolean;
    };
    groups: {
      read: boolean;
      write: boolean;
    };
    customFields: {
      read: boolean;
      write: boolean;
    };
    solutions: {
      read: boolean;
      write: boolean;
    };
    timeEntries: {
      read: boolean;
      write: boolean;
    };
    analytics: {
      read: boolean;
    };
    automations: {
      read: boolean;
      write: boolean;
    };
    export: {
      data: boolean;
    };
    search: {
      enabled: boolean;
    };
  };
}

export interface ToolPermissionMetadata {
  requiredPermissions: Permission[];
  minimumAccessLevel: AccessLevel;
  description: string;
}

export interface PermissionTestResult {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  success: boolean;
  statusCode: number;
  error?: string;
}