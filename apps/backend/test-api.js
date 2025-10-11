// Simple test using only built-in Node.js modules
import { request } from 'http';
import { URL } from 'url';

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    
    const req = request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function testAPI() {
  try {
    console.log('=== TESTING API ENDPOINTS ===\n');
    
    // Test 1: Login to get token
    console.log('🔑 Testing login...');
    const loginResult = await makeRequest('http://localhost:5000/api/v1/user/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'akash@gmail.com',
        password: 'password'
      })
    });
    
    console.log('Login result:', loginResult);
    
    if (loginResult.status !== 200 || !loginResult.data.token) {
      console.log('❌ Login failed');
      return;
    }
    
    const token = loginResult.data.token;
    console.log('✅ Login successful, token obtained\n');
    
    // Test 2: Get open trades
    console.log('📊 Testing /api/v1/trades/open...');
    const openTradesResult = await makeRequest('http://localhost:5000/api/v1/trades/open', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Open trades result:', openTradesResult);
    
    // Test 3: Get closed trades
    console.log('\n📈 Testing /api/v1/trades...');
    const closedTradesResult = await makeRequest('http://localhost:5000/api/v1/trades', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Closed trades result:', closedTradesResult);
    
  } catch (error) {
    console.error('❌ API test error:', error);
  }
}

testAPI();