import { buildApp } from './src/app.js';

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '127.0.0.1';

console.log(`Testing server on ${HOST}:${PORT}...`);

buildApp()
  .then(async (app) => {
    console.log('buildApp OK, starting server...');
    
    try {
      await app.listen({ 
        port: PORT, 
        host: HOST 
      });
      console.log(`✅ Server started on http://${HOST}:${PORT}`);
      
      // Keep running for a moment then exit
      setTimeout(() => {
        console.log('Test complete, shutting down...');
        app.close().then(() => process.exit(0));
      }, 2000);
      
    } catch (error) {
      console.error('❌ Server listen ERROR:');
      console.error(error);
      process.exit(1);
    }
  })
  .catch(e => {
    console.error('❌ buildApp ERROR:');
    console.error(e);
    process.exit(1);
  });
