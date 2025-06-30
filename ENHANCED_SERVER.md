# Enhanced Freshdesk MCP Server

The Enhanced Freshdesk MCP Server is an improved version of the original server with advanced features inspired by the Productboard MCP implementation.

## Key Features

### 1. **Permission-Based Tool Discovery**
- Automatically discovers user permissions by testing API endpoints
- Only registers tools that the user has permission to use
- Provides detailed information about missing permissions

### 2. **Enhanced Architecture**
- Modular design with separate resource APIs
- Tool registry system for dynamic tool management
- Health monitoring and metrics collection
- Improved error handling with custom error types

### 3. **Advanced Tools**
All tools have been enhanced with:
- Permission metadata
- Better parameter validation
- Consistent response formatting
- Comprehensive error handling

Available tools:
- `tickets_manage` - Full ticket management (create, update, list, get, delete, search)
- `contacts_manage` - Contact management with merge capability
- `agents_manage` - Agent management and current agent info
- `companies_manage` - Company management with search
- `conversations_manage` - Conversation management (replies, notes)
- `discovery` - Tool discovery and capability information

### 4. **Discovery Tool**
A special tool that provides information about:
- Available tools based on permissions
- Current user permissions
- API capabilities

## Usage

### Environment Variables

Required:
- `FRESHDESK_DOMAIN` - Your Freshdesk domain (e.g., "yourcompany")
- `FRESHDESK_API_KEY` - Your Freshdesk API key

Optional:
- `FRESHDESK_MAX_RETRIES` - Maximum retry attempts (default: 3)
- `FRESHDESK_TIMEOUT` - Request timeout in ms (default: 30000)
- `FRESHDESK_RATE_LIMIT` - Rate limit per minute (default: 50)
- `SKIP_CONNECTION_TEST` - Skip API connection test (default: false)
- `SKIP_PERMISSION_DISCOVERY` - Skip permission discovery (default: false)

### Running the Enhanced Server

1. **Development Mode:**
```bash
npm run dev:enhanced
```

2. **Production Mode:**
```bash
npm run build
npm run start:enhanced
```

3. **Using Launch Script:**
```bash
./scripts/launch-enhanced.sh
```

### Example Tool Usage

#### Discover Available Tools
```json
{
  "tool": "discovery",
  "arguments": {
    "action": "list_tools"
  }
}
```

#### Create a Ticket
```json
{
  "tool": "tickets_manage",
  "arguments": {
    "action": "create",
    "params": {
      "subject": "Test Ticket",
      "description": "This is a test ticket",
      "email": "customer@example.com",
      "priority": 2,
      "status": 2
    }
  }
}
```

#### Search Contacts
```json
{
  "tool": "contacts_manage",
  "arguments": {
    "action": "search",
    "params": {
      "query": "john@example.com"
    }
  }
}
```

## Architecture

### Core Components

1. **EnhancedFreshdeskServer** (`src/server/enhanced-server.ts`)
   - Main server class with MCP protocol handling
   - Manages tool registration and execution
   - Handles metrics and health monitoring

2. **Permission System** (`src/auth/`)
   - `PermissionDiscoveryService` - Tests API endpoints to discover permissions
   - `permissions.ts` - Permission enums and types

3. **Tool Registry** (`src/core/registry.ts`)
   - Manages tool registration and lookup
   - Filters tools based on permissions

4. **Resource APIs** (`src/api/resources/`)
   - Modular API clients for each resource type
   - Consistent interface for all API operations

5. **Enhanced Tools** (`src/tools/*-enhanced.ts`)
   - Extended from `EnhancedBaseTool`
   - Include permission metadata
   - Standardized parameter validation

### Permission Discovery Process

1. Server starts and validates API connection
2. PermissionDiscoveryService tests various API endpoints
3. Results are analyzed to determine access levels
4. Tools are registered based on available permissions
5. Discovery tool provides visibility into permissions

### Error Handling

Custom error types provide better debugging:
- `ServerError` - Server initialization/startup errors
- `ProtocolError` - MCP protocol violations
- `ToolExecutionError` - Tool-specific execution errors
- `ValidationError` - Parameter validation errors

## Comparison with Original Server

| Feature | Original Server | Enhanced Server |
|---------|----------------|-----------------|
| Tool Discovery | No | Yes |
| Permission System | No | Yes |
| Dynamic Tool Registration | No | Yes |
| Health Monitoring | No | Yes |
| Metrics Collection | No | Yes |
| Resource APIs | Combined in client | Modular |
| Error Handling | Basic | Advanced with custom types |
| Tool Information | Static | Dynamic with discovery |

## Development

### Adding New Tools

1. Create a new tool class extending `EnhancedBaseTool`
2. Define the schema using Zod
3. Set permission metadata
4. Implement the `execute` method
5. Add to the tool registration in `enhanced-server.ts`

Example:
```typescript
export class MyToolEnhanced extends EnhancedBaseTool {
  constructor(client: FreshdeskClient) {
    super(
      'my_tool',
      'Description of my tool',
      MyToolSchema,
      {
        requiredPermissions: [Permission.MY_PERMISSION],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Permission description',
      },
      client
    );
  }

  async execute(args: any): Promise<any> {
    // Implementation
  }
}
```

### Testing

The enhanced server includes comprehensive test coverage:
- Unit tests for all components
- Integration tests for API operations
- End-to-end tests for MCP protocol
- Permission discovery tests

Run tests:
```bash
npm test
```

## Troubleshooting

### Permission Discovery Fails
- Check API key has sufficient permissions
- Some endpoints may not be available on your plan
- Server will use default permissions if discovery fails

### Tools Not Available
- Use the discovery tool to check permissions
- Verify API key has required access
- Check tool registration logs during startup

### Connection Issues
- Verify FRESHDESK_DOMAIN is correct (without .freshdesk.com)
- Check API key is valid
- Look for rate limiting errors

## Future Enhancements

- [ ] Caching layer for improved performance
- [ ] Webhook support for real-time updates
- [ ] Bulk operations for better efficiency
- [ ] Custom field management tools
- [ ] Advanced search capabilities
- [ ] OAuth2 authentication support