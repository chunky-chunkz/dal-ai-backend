/**
 * Example usage of auth utilities
 * This file demonstrates how to use the password and validation utilities
 */

import { hashPassword, verifyPassword, validatePassword } from './password.js';
import { RegisterSchema, LoginSchema, isValidEmail, isValidPassword } from './validators.js';

async function demonstrateAuthUtilities() {
  console.log('=== Auth Utilities Demo ===\n');

  // 1. Password validation
  console.log('1. Password Validation:');
  const passwords = ['weak', 'password', '12345678', 'strongPass123'];
  
  passwords.forEach(pwd => {
    const validation = validatePassword(pwd);
    console.log(`  "${pwd}" -> ${validation.valid ? 'Valid' : 'Invalid'} ${validation.message || ''}`);
  });

  // 2. Password hashing and verification
  console.log('\n2. Password Hashing & Verification:');
  const testPassword = 'mySecurePassword123';
  
  try {
    const hash = await hashPassword(testPassword);
    console.log(`  Hash created: ${hash.substring(0, 50)}...`);
    
    const isCorrect = await verifyPassword(hash, testPassword);
    console.log(`  Verification (correct): ${isCorrect}`);
    
    const isWrong = await verifyPassword(hash, 'wrongPassword');
    console.log(`  Verification (wrong): ${isWrong}`);
  } catch (error) {
    console.error('  Error:', error);
  }

  // 3. Schema validation
  console.log('\n3. Schema Validation:');
  
  // Valid registration
  const validRegistration = {
    email: 'USER@EXAMPLE.COM', // Will be normalized
    password: 'securePass123',
    displayName: '  John Doe  ' // Will be trimmed
  };
  
  const regResult = RegisterSchema.safeParse(validRegistration);
  if (regResult.success) {
    console.log('  Valid registration:', regResult.data);
  } else {
    console.log('  Registration errors:', regResult.error.errors);
  }

  // Invalid registration
  const invalidRegistration = {
    email: 'invalid-email',
    password: 'weak'
  };
  
  const invalidResult = RegisterSchema.safeParse(invalidRegistration);
  if (!invalidResult.success) {
    console.log('  Invalid registration errors:');
    invalidResult.error.errors.forEach(err => {
      console.log(`    - ${err.path.join('.')}: ${err.message}`);
    });
  }

  // 4. Helper functions
  console.log('\n4. Helper Functions:');
  console.log(`  isValidEmail('test@example.com'): ${isValidEmail('test@example.com')}`);
  console.log(`  isValidEmail('invalid'): ${isValidEmail('invalid')}`);
  console.log(`  isValidPassword('strongPass123'): ${isValidPassword('strongPass123')}`);
  console.log(`  isValidPassword('weak'): ${isValidPassword('weak')}`);

  // 5. Login validation
  console.log('\n5. Login Validation:');
  const loginData = {
    email: 'TEST@EXAMPLE.COM',
    password: 'anyPassword'
  };
  
  const loginResult = LoginSchema.safeParse(loginData);
  if (loginResult.success) {
    console.log('  Valid login data:', loginResult.data);
  }
}

// Run the demo 
demonstrateAuthUtilities()
  .then(() => console.log('\n=== Demo Complete ==='))
  .catch(console.error);

export default demonstrateAuthUtilities;
