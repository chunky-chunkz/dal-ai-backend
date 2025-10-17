// Test pdf-parse import
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

console.log('Type:', typeof pdfParse);
console.log('Keys:', Object.keys(pdfParse));
console.log('Is function:', typeof pdfParse === 'function');
console.log('Has default:', 'default' in pdfParse);
console.log('Default type:', typeof pdfParse.default);
