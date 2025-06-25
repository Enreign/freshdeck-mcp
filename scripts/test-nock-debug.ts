#!/usr/bin/env tsx

import nock from 'nock';
import axios from 'axios';

console.log('🧪 Testing nock interception...');

// Setup mock
const baseUrl = 'https://test-domain.freshdesk.com/api/v2';
const scope = nock(baseUrl)
  .get('/agents/me')
  .reply(200, { id: 1, name: 'Test Agent' });

console.log('🔧 Mock configured for:', baseUrl + '/agents/me');

// Test request
axios.get(baseUrl + '/agents/me', {
  headers: {
    'Authorization': 'Basic dGVzdC1hcGkta2V5Olg='
  }
})
.then(response => {
  console.log('✅ Request successful:', response.data);
  console.log('🎯 Nock intercepted the request!');
})
.catch(error => {
  console.log('❌ Request failed:', error.message);
  console.log('💡 Status:', error.response?.status);
  console.log('💡 Data:', error.response?.data);
})
.finally(() => {
  console.log('🔍 Pending mocks:', nock.pendingMocks());
  nock.cleanAll();
});