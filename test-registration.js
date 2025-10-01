// Test script for user registration
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testRegistration() {
  console.log('🧪 Testing user registration...');
  
  try {
    // Test API endpoint
    const response = await fetch('http://127.0.0.1:8080/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'testuser@example.com',
        password: 'securepassword123',
        displayName: 'Test User'
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Registration successful:', result);
      
      // Check database
      const users = await prisma.user.findMany();
      console.log('📊 Users in database:', users.length);
      console.log('👤 Latest user:', users[users.length - 1]);
      
    } else {
      console.log('❌ Registration failed:', result);
    }
    
  } catch (error) {
    console.error('🚨 Error during test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRegistration();
