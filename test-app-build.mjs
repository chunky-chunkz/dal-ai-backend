import { buildApp } from './src/app.js';

console.log('Starting app test...');

try {
  const app = await buildApp();
  console.log('✅ App built successfully');
  await app.close();
  console.log('✅ App closed successfully');
} catch (error) {
  console.error('❌ Error building app:');
  console.error('Error message:', error.message);
  console.error('Error stack:', error.stack);
  process.exit(1);
}
