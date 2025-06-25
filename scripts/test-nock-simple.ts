#!/usr/bin/env tsx

import nock from 'nock';
import axios from 'axios';

console.log('🧪 Simple nock test...');

// Disable real HTTP requests
nock.disableNetConnect();

// Setup mock  
const scope = nock('https://test-domain.freshdesk.com')
  .get('/api/v2/agents/me')
  .reply(200, { id: 1, name: 'Test Agent' });

console.log('🔧 Mock configured, pending mocks:', nock.pendingMocks());

// Test request
try {
  const response = await axios.get('https://test-domain.freshdesk.com/api/v2/agents/me');
  console.log('✅ Request successful:', response.data);
  console.log('🎯 Nock intercepted the request!');
} catch (error: any) {
  console.log('❌ Request failed:', error.message);
  console.log('💡 Code:', error.code);
  if (error.response) {
    console.log('💡 Status:', error.response.status);
  }
}

console.log('🔍 Pending mocks after request:', nock.pendingMocks());
nock.cleanAll();