import { buildApp } from './src/app.js';

console.log('Starting server test...');

try {
  const app = await buildApp();
  console.log('✅ App built successfully');
  
  await app.listen({ 
    port: 8080, 
    host: '127.0.0.1' 
  });
  
  console.log('✅ Server started successfully on http://127.0.0.1:8080');
  
} catch (error) {
  console.error('❌ Error starting server:');
  console.error('Error message:', error.message);
  console.error('Error stack:', error.stack);
  process.exit(1);
}
