import { buildApp } from './src/app.js';

console.log('Testing buildApp...');
buildApp()
  .then(() => console.log('buildApp OK'))
  .catch(e => {
    console.error('buildApp ERROR:');
    console.error(e);
    process.exit(1);
  });
