/**
 * Freshdesk MCP E2E Test Suite
 *
 * Tests all 28 tool actions against a real Freshdesk account.
 * Run with: npm run test:e2e
 * Requires env: FRESHDESK_DOMAIN, FRESHDESK_API_KEY
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── mini test runner ────────────────────────────────────────────────────────

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, duration: Date.now() - start });
    process.stdout.write(`  ✓ ${name}\n`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, error, duration: Date.now() - start });
    process.stdout.write(`  ✗ ${name}\n    ${error}\n`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function suite(name: string): void {
  process.stdout.write(`\n${name}\n`);
}

// ─── helpers ────────────────────────────────────────────────────────────────

async function callTool(
  client: Client,
  tool: string,
  action: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const result = await client.callTool({ name: tool, arguments: { action, params } });
  const text = (result.content as Array<{ text: string }>)[0].text;
  return JSON.parse(text) as Record<string, unknown>;
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  const DOMAIN = process.env['FRESHDESK_DOMAIN'];
  const API_KEY = process.env['FRESHDESK_API_KEY'];

  if (!DOMAIN || !API_KEY) {
    console.error('ERROR: FRESHDESK_DOMAIN and FRESHDESK_API_KEY env vars are required.');
    process.exit(1);
  }

  const serverPath = path.resolve(__dirname, '../../src/index.ts');
  const tsxPath = path.resolve(__dirname, '../../node_modules/.bin/tsx');

  process.stdout.write('Starting MCP server...\n');

  const transport = new StdioClientTransport({
    command: tsxPath,
    args: [serverPath],
    env: {
      FRESHDESK_DOMAIN: DOMAIN,
      FRESHDESK_API_KEY: API_KEY,
      LOG_LEVEL: 'error',
      NODE_ENV: 'production',
      PATH: process.env['PATH'] ?? '',
      HOME: process.env['HOME'] ?? '',
    },
    stderr: 'ignore',
  });

  const client = new Client({ name: 'e2e-test', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);
  process.stdout.write('Connected.\n');

  // ── shared state ────────────────────────────────────────────────────────────
  const ts = Date.now();
  const testEmail = `e2e.test.${ts}@example.com`;
  const mergeEmail = `e2e.merge.${ts}@example.com`;

  let agentId = 0;
  let testCompanyId = 0;
  let testContactId = 0;
  let testTicketId = 0;
  let testReplyId = 0;
  let testNoteId = 0;

  // ── server ──────────────────────────────────────────────────────────────────
  suite('Server');

  await test('lists all 5 tools', async () => {
    const { tools } = await client.listTools();
    const names = (tools as Array<{ name: string }>).map(t => t.name);
    const expected = ['tickets_manage', 'contacts_manage', 'agents_manage', 'companies_manage', 'conversations_manage'];
    for (const name of expected) {
      assert(names.includes(name), `missing tool: ${name}`);
    }
  });

  // ── agents_manage ────────────────────────────────────────────────────────────
  suite('agents_manage');

  await test('get_current — returns authenticated agent', async () => {
    const res = await callTool(client, 'agents_manage', 'get_current', {});
    assert(res.success === true, `success=false: ${JSON.stringify(res)}`);
    const agent = res.agent as Record<string, unknown>;
    assert(typeof agent.id === 'number', 'agent.id should be number');
    agentId = agent.id as number;
  });

  await test('list — returns array of agents', async () => {
    const res = await callTool(client, 'agents_manage', 'list', {});
    assert(res.success === true, JSON.stringify(res));
    assert(Array.isArray(res.agents), 'agents should be array');
    assert((res.agents as unknown[]).length > 0, 'agents should not be empty');
  });

  await test('get — retrieves agent by ID', async () => {
    const res = await callTool(client, 'agents_manage', 'get', { agent_id: agentId });
    assert(res.success === true, JSON.stringify(res));
    assert((res.agent as Record<string, unknown>).id === agentId, 'agent.id mismatch');
  });

  await test('update — updates agent fields', async () => {
    const res = await callTool(client, 'agents_manage', 'update', {
      agent_id: agentId,
      occasional: false,
    });
    assert(res.success === true, JSON.stringify(res));
    assert((res.agent as Record<string, unknown>).occasional === false, 'occasional should be false');
  });

  await test('list_groups — returns groups array (may be empty)', async () => {
    const res = await callTool(client, 'agents_manage', 'list_groups', { agent_id: agentId });
    assert(res.success === true, JSON.stringify(res));
    assert(Array.isArray(res.groups), 'groups should be array');
  });

  await test('list_roles — returns roles with details', async () => {
    const res = await callTool(client, 'agents_manage', 'list_roles', { agent_id: agentId });
    assert(res.success === true, JSON.stringify(res));
    assert(Array.isArray(res.roles), 'roles should be array');
    assert((res.roles as unknown[]).length > 0, 'should have at least one role');
    const role = (res.roles as Array<Record<string, unknown>>)[0];
    assert(typeof role.id === 'number', 'role.id should be number');
    assert(typeof role.name === 'string', 'role.name should be string');
  });

  // ── companies_manage ─────────────────────────────────────────────────────────
  suite('companies_manage');

  await test('list — returns companies', async () => {
    const res = await callTool(client, 'companies_manage', 'list', {});
    assert(res.success === true, JSON.stringify(res));
    assert(Array.isArray(res.companies), 'companies should be array');
  });

  await test('create — creates test company', async () => {
    const res = await callTool(client, 'companies_manage', 'create', {
      name: 'E2E Test Company',
      description: 'Created by automated e2e test',
      domains: ['e2etest-mcp.example.com'],
    });
    assert(res.success === true, JSON.stringify(res));
    const company = res.company as Record<string, unknown>;
    assert(company.name === 'E2E Test Company', 'name mismatch');
    testCompanyId = company.id as number;
  });

  await test('get — retrieves created company', async () => {
    const res = await callTool(client, 'companies_manage', 'get', { company_id: testCompanyId });
    assert(res.success === true, JSON.stringify(res));
    assert((res.company as Record<string, unknown>).id === testCompanyId, 'id mismatch');
  });

  await test('update — updates company fields', async () => {
    const res = await callTool(client, 'companies_manage', 'update', {
      company_id: testCompanyId,
      note: 'Updated by e2e test',
      account_tier: 'Premium',
    });
    assert(res.success === true, JSON.stringify(res));
    const company = res.company as Record<string, unknown>;
    assert(company.note === 'Updated by e2e test', 'note mismatch');
    assert(company.account_tier === 'Premium', 'account_tier mismatch');
  });

  await test('search — finds company by domain (uses pre-existing data)', async () => {
    // Use pre-existing indexed data — freshly created records may not appear immediately
    const res = await callTool(client, 'companies_manage', 'search', {
      query: "domain:'freshdesk.com'",
    });
    assert(res.success === true, JSON.stringify(res));
    const companies = res.companies as Array<Record<string, unknown>>;
    assert(companies.length > 0, 'should find at least one company');
  });

  await test('list_contacts — returns contacts for company', async () => {
    const res = await callTool(client, 'companies_manage', 'list_contacts', { company_id: testCompanyId });
    assert(res.success === true, JSON.stringify(res));
    assert(Array.isArray(res.contacts), 'contacts should be array');
  });

  // ── contacts_manage ──────────────────────────────────────────────────────────
  suite('contacts_manage');

  await test('list — returns contacts', async () => {
    const res = await callTool(client, 'contacts_manage', 'list', {});
    assert(res.success === true, JSON.stringify(res));
    assert(Array.isArray(res.contacts), 'contacts should be array');
  });

  await test('create — creates test contact', async () => {
    const res = await callTool(client, 'contacts_manage', 'create', {
      name: 'E2E Test Contact',
      email: testEmail,
      phone: '1234567890',
      job_title: 'QA Engineer',
      company_id: testCompanyId,
    });
    assert(res.success === true, JSON.stringify(res));
    const contact = res.contact as Record<string, unknown>;
    assert(contact.name === 'E2E Test Contact', 'name mismatch');
    assert(contact.email === testEmail, 'email mismatch');
    testContactId = contact.id as number;
  });

  await test('get — retrieves created contact', async () => {
    const res = await callTool(client, 'contacts_manage', 'get', { contact_id: testContactId });
    assert(res.success === true, JSON.stringify(res));
    assert((res.contact as Record<string, unknown>).id === testContactId, 'id mismatch');
  });

  await test('update — updates contact fields', async () => {
    const res = await callTool(client, 'contacts_manage', 'update', {
      contact_id: testContactId,
      job_title: 'Senior QA Engineer',
      address: '1 Test Street',
    });
    assert(res.success === true, JSON.stringify(res));
    const contact = res.contact as Record<string, unknown>;
    assert(contact.job_title === 'Senior QA Engineer', 'job_title mismatch');
    assert(contact.address === '1 Test Street', 'address mismatch');
  });

  await test('search — finds contact by email (uses pre-existing data)', async () => {
    // Use pre-existing indexed data — freshly created records may not appear immediately
    const res = await callTool(client, 'contacts_manage', 'search', {
      query: "email:'emily.dean@globallearning.org'",
    });
    assert(res.success === true, JSON.stringify(res));
    const contacts = res.contacts as Array<Record<string, unknown>>;
    assert(contacts.length > 0, 'should find at least one contact');
  });

  await test('merge — merges a second contact into primary', async () => {
    // Create a second contact to merge
    const createRes = await callTool(client, 'contacts_manage', 'create', {
      name: 'E2E Merge Target',
      email: mergeEmail,
    });
    assert(createRes.success === true, JSON.stringify(createRes));
    const secondId = (createRes.contact as Record<string, unknown>).id as number;

    const res = await callTool(client, 'contacts_manage', 'merge', {
      primary_contact_id: testContactId,
      secondary_contact_ids: [secondId],
    });
    assert(res.success === true, JSON.stringify(res));
  });

  // ── tickets_manage ───────────────────────────────────────────────────────────
  suite('tickets_manage');

  await test('list — returns tickets', async () => {
    const res = await callTool(client, 'tickets_manage', 'list', {});
    assert(res.success === true, JSON.stringify(res));
    assert(Array.isArray(res.tickets), 'tickets should be array');
  });

  await test('create — creates test ticket', async () => {
    const res = await callTool(client, 'tickets_manage', 'create', {
      subject: 'E2E Test Ticket',
      description: '<p>Created by automated e2e test.</p>',
      email: testEmail,
      priority: 1,
      status: 2,
      tags: ['e2e-test'],
    });
    assert(res.success === true, JSON.stringify(res));
    const ticket = res.ticket as Record<string, unknown>;
    assert(ticket.subject === 'E2E Test Ticket', 'subject mismatch');
    testTicketId = ticket.id as number;
  });

  await test('get — retrieves ticket with description', async () => {
    const res = await callTool(client, 'tickets_manage', 'get', { ticket_id: testTicketId });
    assert(res.success === true, JSON.stringify(res));
    const ticket = res.ticket as Record<string, unknown>;
    assert(ticket.id === testTicketId, 'id mismatch');
    assert(typeof ticket.description === 'string', 'description should be string');
  });

  await test('update — updates ticket priority and status', async () => {
    const res = await callTool(client, 'tickets_manage', 'update', {
      ticket_id: testTicketId,
      priority: 2,
      status: 3,
      tags: ['e2e-test', 'updated'],
    });
    assert(res.success === true, JSON.stringify(res));
    const ticket = res.ticket as Record<string, unknown>;
    assert(ticket.priority === 2, 'priority mismatch');
    assert(ticket.status === 3, 'status mismatch');
  });

  await test('search — finds tickets by status (uses pre-existing data)', async () => {
    // Use pre-existing indexed data — freshly created/updated records may not appear immediately
    const res = await callTool(client, 'tickets_manage', 'search', { query: 'status:2' });
    assert(res.success === true, JSON.stringify(res));
    assert(Array.isArray(res.tickets), 'tickets should be array');
    assert((res.tickets as unknown[]).length > 0, 'should find open tickets');
  });

  // ── conversations_manage ─────────────────────────────────────────────────────
  suite('conversations_manage');

  await test('create_reply — adds public reply', async () => {
    const res = await callTool(client, 'conversations_manage', 'create_reply', {
      ticket_id: testTicketId,
      body: '<p>E2E test reply — please ignore.</p>',
    });
    assert(res.success === true, JSON.stringify(res));
    const conv = res.conversation as Record<string, unknown>;
    assert(conv.ticket_id === testTicketId, 'ticket_id mismatch');
    assert(conv.private !== true, 'reply should not be private');
    testReplyId = conv.id as number;
  });

  await test('create_note — adds private internal note', async () => {
    const res = await callTool(client, 'conversations_manage', 'create_note', {
      ticket_id: testTicketId,
      body: '<p>E2E internal note — please ignore.</p>',
      private: true,
    });
    assert(res.success === true, JSON.stringify(res));
    const conv = res.conversation as Record<string, unknown>;
    assert(conv.private === true, 'note should be private');
    testNoteId = conv.id as number;
  });

  await test('list — returns both reply and note', async () => {
    const res = await callTool(client, 'conversations_manage', 'list', { ticket_id: testTicketId });
    assert(res.success === true, JSON.stringify(res));
    const convs = res.conversations as Array<Record<string, unknown>>;
    assert(convs.length >= 2, `expected >= 2 conversations, got ${convs.length}`);
    const ids = convs.map(c => c.id);
    assert(ids.includes(testReplyId), 'reply not found in list');
    assert(ids.includes(testNoteId), 'note not found in list');
  });

  await test('get — retrieves reply by ID', async () => {
    const res = await callTool(client, 'conversations_manage', 'get', { conversation_id: testReplyId });
    assert(res.success === true, JSON.stringify(res));
    assert((res.conversation as Record<string, unknown>).id === testReplyId, 'id mismatch');
  });

  await test('update — updates note body', async () => {
    const res = await callTool(client, 'conversations_manage', 'update', {
      conversation_id: testNoteId,
      body: '<p>E2E note UPDATED.</p>',
    });
    assert(res.success === true, JSON.stringify(res));
    assert((res.conversation as Record<string, unknown>).id === testNoteId, 'id mismatch');
  });

  await test('delete reply', async () => {
    const res = await callTool(client, 'conversations_manage', 'delete', { conversation_id: testReplyId });
    assert(res.success === true, JSON.stringify(res));
    assert(typeof res.message === 'string' && res.message.includes('deleted'), 'unexpected message');
    testReplyId = 0;
  });

  await test('delete note', async () => {
    const res = await callTool(client, 'conversations_manage', 'delete', { conversation_id: testNoteId });
    assert(res.success === true, JSON.stringify(res));
    testNoteId = 0;
  });

  // ── cleanup ──────────────────────────────────────────────────────────────────
  suite('cleanup');

  await test('delete ticket', async () => {
    const res = await callTool(client, 'tickets_manage', 'delete', { ticket_id: testTicketId });
    assert(res.success === true, JSON.stringify(res));
    testTicketId = 0;
  });

  await test('delete contact (soft+hard delete to keep email free for reruns)', async () => {
    // Freshdesk requires soft-delete before hard-delete is allowed
    await callTool(client, 'contacts_manage', 'delete', { contact_id: testContactId });
    const res = await callTool(client, 'contacts_manage', 'delete', {
      contact_id: testContactId,
      permanent: true,
    });
    assert(res.success === true, JSON.stringify(res));
    testContactId = 0;
  });

  await test('delete company', async () => {
    const res = await callTool(client, 'companies_manage', 'delete', { company_id: testCompanyId });
    assert(res.success === true, JSON.stringify(res));
    testCompanyId = 0;
  });

  // ── summary ──────────────────────────────────────────────────────────────────
  await client.close().catch(() => {});

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  const totalMs = results.reduce((s, r) => s + r.duration, 0);

  process.stdout.write(`\n${'─'.repeat(50)}\n`);
  process.stdout.write(`Tests: ${passed} passed, ${failed} failed, ${total} total (${totalMs}ms)\n`);

  if (failed > 0) {
    process.stdout.write('\nFailed tests:\n');
    for (const r of results.filter(r => !r.passed)) {
      process.stdout.write(`  ✗ ${r.name}\n    ${r.error}\n`);
    }
    process.exit(1);
  } else {
    process.stdout.write('All tests passed.\n');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
