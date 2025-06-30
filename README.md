# Freshdesk MCP Server

A Model Context Protocol (MCP) server implementation for Freshdesk API v2 integration. This server provides tools for managing tickets, contacts, agents, companies, and conversations through the MCP interface.

## Features

- **Complete Freshdesk API v2 Integration**: Full support for core Freshdesk resources
- **Built-in Authentication**: Secure API key-based authentication
- **Rate Limiting**: Automatic rate limit handling with configurable limits
- **Error Handling**: Comprehensive error handling with retry logic
- **Type Safety**: Full TypeScript implementation with strict typing
- **Logging**: Structured logging with Pino
- **Enhanced Server Option**: Advanced server with permission discovery and tool management (see [ENHANCED_SERVER.md](ENHANCED_SERVER.md))

## Installation

```bash
npm install
npm run build
```

## Configuration

Create a `.env` file in the project root with the following variables:

```env
# Required
FRESHDESK_DOMAIN=yourcompany.freshdesk.com  # or just "yourcompany"
FRESHDESK_API_KEY=your_api_key_here

# Optional
FRESHDESK_MAX_RETRIES=3          # Maximum retry attempts (default: 3)
FRESHDESK_TIMEOUT=30000          # Request timeout in ms (default: 30000)
FRESHDESK_RATE_LIMIT=50          # Rate limit per minute (default: 50)
LOG_LEVEL=info                   # Log level: debug, info, warn, error
```

## Usage

### Starting the Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

### MCP Client Configuration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "freshdesk": {
      "command": "node",
      "args": ["/path/to/freshdesk-mcp/dist/index.js"],
      "env": {
        "FRESHDESK_DOMAIN": "yourcompany.freshdesk.com",
        "FRESHDESK_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Available Tools

### 1. tickets_manage
Manage Freshdesk tickets - create, update, list, get, delete, and search tickets.

**Actions:**
- `create`: Create a new ticket
- `update`: Update an existing ticket
- `list`: List tickets with filters
- `get`: Get a specific ticket
- `delete`: Delete a ticket
- `search`: Search tickets with query

### 2. contacts_manage
Manage Freshdesk contacts - create, update, list, get, delete, search, and merge contacts.

**Actions:**
- `create`: Create a new contact
- `update`: Update an existing contact
- `list`: List contacts with filters
- `get`: Get a specific contact
- `delete`: Delete a contact
- `search`: Search contacts
- `merge`: Merge multiple contacts

### 3. agents_manage
Manage Freshdesk agents - list, get, update agents, and view their groups and roles.

**Actions:**
- `list`: List all agents
- `get`: Get a specific agent
- `update`: Update agent details
- `get_current`: Get current authenticated agent
- `list_groups`: List agent's groups
- `list_roles`: List agent's roles

### 4. companies_manage
Manage Freshdesk companies - create, update, list, get, delete, search companies, and list company contacts.

**Actions:**
- `create`: Create a new company
- `update`: Update an existing company
- `list`: List companies
- `get`: Get a specific company
- `delete`: Delete a company
- `search`: Search companies
- `list_contacts`: List contacts in a company

### 5. conversations_manage
Manage Freshdesk ticket conversations - create replies and notes, list, get, update, and delete conversations.

**Actions:**
- `create_reply`: Add a reply to a ticket
- `create_note`: Add a note to a ticket
- `list`: List ticket conversations
- `get`: Get a specific conversation
- `update`: Update a conversation
- `delete`: Delete a conversation

## Example Usage

### Create a Ticket
```json
{
  "tool": "tickets_manage",
  "arguments": {
    "action": "create",
    "params": {
      "subject": "Need help with login",
      "description": "I cannot log into my account",
      "email": "customer@example.com",
      "priority": 2,
      "status": 2,
      "tags": ["login", "urgent"]
    }
  }
}
```

### Search Contacts
```json
{
  "tool": "contacts_manage",
  "arguments": {
    "action": "search",
    "params": {
      "query": "john@example.com",
      "page": 1,
      "per_page": 10
    }
  }
}
```

### Add Reply to Ticket
```json
{
  "tool": "conversations_manage",
  "arguments": {
    "action": "create_reply",
    "params": {
      "ticket_id": 12345,
      "body": "<p>Thank you for contacting us. We'll help you resolve this issue.</p>"
    }
  }
}
```

## Development

### Running Tests
```bash
npm test
npm run test:watch
npm run test:coverage
```

### Linting and Formatting
```bash
npm run lint
npm run lint:fix
npm run format
npm run format:check
```

### Type Checking
```bash
npm run typecheck
```

## Architecture

```
src/
├── api/          # API client implementation
├── auth/         # Authentication logic
├── core/         # Core types and interfaces
├── tools/        # MCP tool implementations
├── utils/        # Utility functions (logging, errors, rate limiting)
└── index.ts      # Main server entry point
```

## Error Handling

The server implements comprehensive error handling:

- **Network Errors**: Automatic retry with exponential backoff
- **Rate Limiting**: Respects Freshdesk API rate limits with automatic throttling
- **Authentication Errors**: Clear error messages for invalid API keys
- **Validation Errors**: Input validation with detailed error messages
- **API Errors**: Proper error mapping from Freshdesk API responses

## Security

- API keys are never logged or exposed
- All inputs are validated using Zod schemas
- Secure HTTPS connections to Freshdesk API
- Environment-based configuration

## License

MIT