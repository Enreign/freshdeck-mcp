import { FreshdeskClient } from '../api/client.js';
import { createLogger } from '../utils/logger.js';
import {
  UserPermissions,
  AccessLevel,
  Permission,
  PermissionTestResult,
} from './permissions.js';

export class PermissionDiscoveryService {
  private apiClient: FreshdeskClient;
  private logger;

  constructor(apiClient: FreshdeskClient) {
    this.apiClient = apiClient;
    this.logger = createLogger('permission-discovery');
  }

  async discoverUserPermissions(): Promise<UserPermissions> {
    this.logger.info('Starting permission discovery...');

    const testResults = await this.runPermissionTests();
    const permissions = this.analyzeTestResults(testResults);

    this.logger.info('Permission discovery completed', {
      accessLevel: permissions.accessLevel,
      permissionCount: permissions.permissions.size,
      capabilities: permissions.capabilities,
    });

    return permissions;
  }

  private async runPermissionTests(): Promise<PermissionTestResult[]> {
    const tests: Array<{
      endpoint: string;
      method: 'GET' | 'POST' | 'PUT' | 'DELETE';
      testData?: unknown;
      description: string;
    }> = [
      // Agent endpoint tests
      { endpoint: '/agents/me', method: 'GET', description: 'Read current agent' },
      { endpoint: '/agents', method: 'GET', description: 'List agents' },
      
      // Ticket endpoint tests
      { endpoint: '/tickets', method: 'GET', description: 'Read tickets' },
      {
        endpoint: '/tickets',
        method: 'POST',
        testData: {
          subject: 'Permission Test Ticket',
          description: 'Test',
          email: 'test@example.com',
          priority: 1,
          status: 2,
        },
        description: 'Create tickets',
      },
      
      // Contact endpoint tests
      { endpoint: '/contacts', method: 'GET', description: 'Read contacts' },
      {
        endpoint: '/contacts',
        method: 'POST',
        testData: {
          name: 'Permission Test Contact',
          email: 'permtest@example.com',
        },
        description: 'Create contacts',
      },
      
      // Company endpoint tests
      { endpoint: '/companies', method: 'GET', description: 'Read companies' },
      {
        endpoint: '/companies',
        method: 'POST',
        testData: {
          name: 'Permission Test Company',
        },
        description: 'Create companies',
      },
      
      // Product endpoint tests
      { endpoint: '/products', method: 'GET', description: 'Read products' },
      
      // Group endpoint tests
      { endpoint: '/groups', method: 'GET', description: 'Read groups' },
      
      // Solution endpoint tests
      { endpoint: '/solutions/categories', method: 'GET', description: 'Read solutions' },
      {
        endpoint: '/solutions/categories',
        method: 'POST',
        testData: {
          name: 'Test Category',
          description: 'Test',
        },
        description: 'Create solution categories',
      },
      
      // Custom field tests
      { endpoint: '/admin/ticket_fields', method: 'GET', description: 'Read custom fields' },
      
      // Time entry tests
      { endpoint: '/time_entries', method: 'GET', description: 'Read time entries' },
      
      // Search test
      { endpoint: '/search/tickets?query="test"', method: 'GET', description: 'Search functionality' },
      
      // Analytics/Reports tests (typically admin-only)
      { endpoint: '/reports/helpdesk_productivity', method: 'GET', description: 'Analytics access' },
      
      // Automation tests
      { endpoint: '/automations', method: 'GET', description: 'Read automations' },
    ];

    const results: PermissionTestResult[] = [];

    for (const test of tests) {
      try {
        this.logger.debug(`Testing ${test.method} ${test.endpoint}...`);

        let response;
        switch (test.method) {
          case 'GET':
            response = await this.apiClient.makeRequest(test.method, test.endpoint);
            break;
          case 'POST':
            response = await this.apiClient.makeRequest(test.method, test.endpoint, test.testData);
            break;
          case 'PUT':
            response = await this.apiClient.makeRequest(test.method, test.endpoint, test.testData);
            break;
          case 'DELETE':
            response = await this.apiClient.makeRequest(test.method, test.endpoint);
            break;
        }

        results.push({
          endpoint: test.endpoint,
          method: test.method,
          success: true,
          statusCode: 200,
        });

        this.logger.debug(`✓ ${test.description} - Success`);

        // If we created a test resource, try to clean it up
        if (test.method === 'POST' && response && typeof response === 'object' && 'id' in response) {
          try {
            const resourceId = (response as any).id;
            const baseEndpoint = test.endpoint.split('?')[0];
            await this.apiClient.makeRequest('DELETE', `${baseEndpoint}/${resourceId}`);
            this.logger.debug(`Cleaned up test resource: ${resourceId}`);
          } catch (cleanupError) {
            // Ignore cleanup errors
            this.logger.debug('Could not clean up test resource (non-critical)');
          }
        }
      } catch (error: any) {
        let statusCode = 500;
        let errorMessage = 'Unknown error';

        if (error.response?.status === 403) {
          statusCode = 403;
          errorMessage = 'Forbidden - insufficient permissions';
        } else if (error.response?.status === 404) {
          statusCode = 404;
          errorMessage = 'Not found - endpoint may not exist';
        } else if (error.response?.status === 400) {
          statusCode = 400;
          errorMessage = 'Validation error - invalid test data';
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }

        results.push({
          endpoint: test.endpoint,
          method: test.method,
          success: false,
          statusCode,
          error: errorMessage,
        });

        this.logger.debug(`✗ ${test.description} - ${errorMessage}`);
      }

      // Add small delay between tests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  private analyzeTestResults(testResults: PermissionTestResult[]): UserPermissions {
    const permissions = new Set<Permission>();
    
    // Helper function to check if an endpoint test succeeded
    const canAccess = (endpoint: string, method: string): boolean => {
      return testResults.some(
        result => 
          result.endpoint.includes(endpoint) && 
          result.method === method && 
          result.success
      );
    };

    // Analyze ticket permissions
    const ticketsRead = canAccess('/tickets', 'GET');
    const ticketsWrite = canAccess('/tickets', 'POST');
    if (ticketsRead) permissions.add(Permission.TICKETS_READ);
    if (ticketsWrite) permissions.add(Permission.TICKETS_WRITE);

    // Analyze contact permissions
    const contactsRead = canAccess('/contacts', 'GET');
    const contactsWrite = canAccess('/contacts', 'POST');
    if (contactsRead) permissions.add(Permission.CONTACTS_READ);
    if (contactsWrite) permissions.add(Permission.CONTACTS_WRITE);

    // Analyze agent permissions
    const agentsRead = canAccess('/agents', 'GET');
    const agentsWrite = canAccess('/agents', 'POST');
    if (agentsRead) permissions.add(Permission.AGENTS_READ);
    if (agentsWrite) permissions.add(Permission.AGENTS_WRITE);

    // Analyze company permissions
    const companiesRead = canAccess('/companies', 'GET');
    const companiesWrite = canAccess('/companies', 'POST');
    if (companiesRead) permissions.add(Permission.COMPANIES_READ);
    if (companiesWrite) permissions.add(Permission.COMPANIES_WRITE);

    // Analyze conversation permissions
    const conversationsRead = canAccess('/conversations', 'GET');
    const conversationsWrite = canAccess('/conversations', 'POST');
    if (conversationsRead) permissions.add(Permission.CONVERSATIONS_READ);
    if (conversationsWrite) permissions.add(Permission.CONVERSATIONS_WRITE);

    // Analyze product permissions
    const productsRead = canAccess('/products', 'GET');
    if (productsRead) permissions.add(Permission.PRODUCTS_READ);

    // Analyze group permissions
    const groupsRead = canAccess('/groups', 'GET');
    if (groupsRead) permissions.add(Permission.GROUPS_READ);

    // Analyze custom field permissions
    const customFieldsRead = canAccess('/admin/ticket_fields', 'GET');
    if (customFieldsRead) permissions.add(Permission.CUSTOM_FIELDS_READ);

    // Analyze solution permissions
    const solutionsRead = canAccess('/solutions', 'GET');
    const solutionsWrite = canAccess('/solutions', 'POST');
    if (solutionsRead) permissions.add(Permission.SOLUTIONS_READ);
    if (solutionsWrite) permissions.add(Permission.SOLUTIONS_WRITE);

    // Analyze time entry permissions
    const timeEntriesRead = canAccess('/time_entries', 'GET');
    if (timeEntriesRead) permissions.add(Permission.TIME_ENTRIES_READ);

    // Analyze search permissions
    const searchEnabled = canAccess('/search', 'GET');
    if (searchEnabled) permissions.add(Permission.SEARCH);

    // Analyze analytics permissions
    const analyticsRead = canAccess('/reports', 'GET');
    if (analyticsRead) permissions.add(Permission.ANALYTICS_READ);

    // Analyze automation permissions
    const automationsRead = canAccess('/automations', 'GET');
    if (automationsRead) permissions.add(Permission.AUTOMATIONS_READ);

    // Determine access level
    const canWrite = ticketsWrite || contactsWrite || companiesWrite || solutionsWrite;
    const canDelete = false; // We didn't test delete operations to avoid data loss
    const isAdmin = analyticsRead || customFieldsRead || automationsRead;

    let accessLevel: AccessLevel;
    if (isAdmin) {
      accessLevel = AccessLevel.ADMIN;
    } else if (canDelete) {
      accessLevel = AccessLevel.DELETE;
    } else if (canWrite) {
      accessLevel = AccessLevel.WRITE;
    } else {
      accessLevel = AccessLevel.READ;
    }

    // Build comprehensive capabilities object
    const capabilities = {
      tickets: {
        read: ticketsRead,
        write: ticketsWrite,
        delete: canDelete,
      },
      contacts: {
        read: contactsRead,
        write: contactsWrite,
        delete: canDelete,
      },
      agents: {
        read: agentsRead,
        write: agentsWrite,
        admin: isAdmin,
      },
      companies: {
        read: companiesRead,
        write: companiesWrite,
        delete: canDelete,
      },
      conversations: {
        read: conversationsRead,
        write: conversationsWrite,
      },
      products: {
        read: productsRead,
        write: false, // Usually read-only
      },
      groups: {
        read: groupsRead,
        write: false, // Usually read-only for non-admins
      },
      customFields: {
        read: customFieldsRead,
        write: false, // Admin only
      },
      solutions: {
        read: solutionsRead,
        write: solutionsWrite,
      },
      timeEntries: {
        read: timeEntriesRead,
        write: false,
      },
      analytics: {
        read: analyticsRead,
      },
      automations: {
        read: automationsRead,
        write: false, // Admin only
      },
      export: {
        data: ticketsRead, // Can export if can read tickets
      },
      search: {
        enabled: searchEnabled,
      },
    };

    return {
      accessLevel,
      isReadOnly: !canWrite,
      canWrite,
      canDelete,
      isAdmin,
      permissions,
      capabilities,
    };
  }
}