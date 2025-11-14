const axios = require('axios');

async function test() {
  try {
    // Primero login
    const loginRes = await axios.post('http://localhost:3002/api/v1/auth/login', {
      email: 'juan.perez@trabajador.com',
      password: 'trabajador123'
    });
    
    const token = loginRes.data.accessToken;
    const workerId = '89959707-32cf-495f-b6fc-01552b3064ab';
    
    console.log('Token:', token.substring(0, 30) + '...');
    console.log('WorkerId:', workerId);
    
    // Ahora llamar al endpoint
    const statsRes = await axios.get(
      `http://localhost:3002/api/v1/workers/${workerId}/dashboard-stats`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    console.log('Stats:', statsRes.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

test();
