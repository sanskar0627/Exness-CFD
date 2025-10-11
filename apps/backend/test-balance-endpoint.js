import fetch from 'node-fetch';

async function testBalanceAPI() {
  try {
    console.log('=== TESTING BALANCE API ===');
    
    // Test login first to get a token
    const loginResponse = await fetch('http://localhost:5000/api/v1/user/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'abc@gmail.com',
        password: 'password123'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('Login response:', loginData);
    
    if (loginData.token) {
      // Test balance API
      const balanceResponse = await fetch('http://localhost:5000/api/v1/user/balance', {
        headers: {
          'Authorization': `Bearer ${loginData.token}`,
          'Content-Type': 'application/json',
        }
      });
      
      const balanceData = await balanceResponse.json();
      console.log('\n=== BALANCE API RESPONSE ===');
      console.log('Status:', balanceResponse.status);
      console.log('Response:', balanceData);
      
      if (balanceData.usd_balance) {
        console.log('usd_balance in cents:', balanceData.usd_balance);
        console.log('usd_balance in dollars:', balanceData.usd_balance / 100);
      }
      
      if (balanceData.balance) {
        console.log('balance in dollars:', balanceData.balance);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testBalanceAPI();