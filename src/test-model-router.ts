/**
 * Quick test for the model router implementation
 */

import { chooseModel } from './ai/modelRouter.js';

console.log('🧪 Testing Model Router');
console.log('========================');

// Test 1: Default case (high confidence, short question)
console.log('\n1. High confidence, short question:');
const model1 = chooseModel(0.8, 50);
console.log(`   Result: ${model1}`);

// Test 2: Low confidence (should use strong model)
console.log('\n2. Low confidence, short question:');
const model2 = chooseModel(0.3, 50);
console.log(`   Result: ${model2}`);

// Test 3: Long question (should use strong model)
console.log('\n3. High confidence, long question:');
const model3 = chooseModel(0.8, 200);
console.log(`   Result: ${model3}`);

// Test 4: Both triggers (should use strong model)
console.log('\n4. Low confidence, long question:');
const model4 = chooseModel(0.4, 180);
console.log(`   Result: ${model4}`);

// Test 5: No parameters (should use default)
console.log('\n5. No parameters:');
const model5 = chooseModel();
console.log(`   Result: ${model5}`);

// Test 6: Only confidence parameter
console.log('\n6. Only confidence parameter (high):');
const model6 = chooseModel(0.7);
console.log(`   Result: ${model6}`);

// Test 7: Only question length parameter
console.log('\n7. Only question length parameter (long):');
const model7 = chooseModel(undefined, 170);
console.log(`   Result: ${model7}`);

console.log('\n✅ Model router test completed!');
