import 'dotenv/config';

console.log('🔧 Starting debug script...');

try {
  console.log('📦 Importing buildApp...');
  const { buildApp } = await import('./dist/app.js');
  
  console.log('🏗️ Building app...');
  const app = await buildApp();
  
  console.log('✅ App built successfully!');
  console.log('🚀 Starting server...');
  
  await app.listen({ 
    port: 3021, 
    host: '127.0.0.1' 
  });
  
  console.log('✅ Server started successfully!');
  
} catch (error) {
  console.error('❌ Error occurred:');
  console.error('Name:', error.name);
  console.error('Message:', error.message);
  console.error('Stack:', error.stack);
  
  if (error.cause) {
    console.error('Cause:', error.cause);
  }
  
  process.exit(1);
}
