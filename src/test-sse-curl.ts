/**
 * Simple curl commands to test the SSE endpoint
 */

// Test valid streaming request
console.log('Test 1: Valid streaming request');
console.log('curl -N "http://localhost:3001/api/answer/stream?question=Wie%20kann%20ich%20meine%20Rechnung%20bezahlen%3F"');
console.log('');

// Test invalid question (too short)
console.log('Test 2: Invalid question validation');
console.log('curl "http://localhost:3001/api/answer/stream?question=hi"');
console.log('');

// Test missing question parameter
console.log('Test 3: Missing question parameter');
console.log('curl "http://localhost:3001/api/answer/stream"');
console.log('');

console.log('Expected behaviors:');
console.log('- Test 1: Should stream tokens and end with "data: [DONE]"');
console.log('- Test 2: Should return 400 with validation error');
console.log('- Test 3: Should return 400 with validation error');
console.log('');
console.log('Headers should include:');
console.log('- Content-Type: text/event-stream');
console.log('- Cache-Control: no-cache, no-transform');
console.log('- Connection: keep-alive');
console.log('- Access-Control-Allow-Origin: * (or from CORS_ORIGIN env)');
