# Authentication Module

This module provides secure password hashing, validation, and schema validation for authentication in your DAL-AI application.

## Features

### 🔐 Password Security
- **Argon2** hashing with environment-based tuning (primary)
- **bcrypt** fallback for compatibility
- Configurable memory, time, and parallelism costs
- Automatic salt generation

### ✅ Input Validation
- **Zod** schemas for type-safe validation
- Email normalization (lowercase, trimmed)
- Strong password requirements
- Comprehensive error messages

### 🛡️ Security Policies
- Minimum 8 characters
- Must contain letters and digits
- Email format validation
- Case-insensitive email handling

## Quick Start

```typescript
import { hashPassword, verifyPassword } from './auth/password';
import { RegisterSchema, LoginSchema } from './auth/validators';

// Hash a password
const hash = await hashPassword('userPassword123');

// Verify a password
const isValid = await verifyPassword(hash, 'userPassword123');

// Validate registration data
const result = RegisterSchema.safeParse({
  email: 'user@example.com',
  password: 'securePass123',
  displayName: 'John Doe'
});
```

## Environment Configuration

Add these variables to your `.env` file:

```env
# Password hashing configuration
PASSWORD_HASH_MEMORY=19456    # Memory cost (KB)
PASSWORD_HASH_TIME=2          # Time cost (iterations)
PASSWORD_HASH_PARALLELISM=1   # Parallelism factor
```

### Tuning Guidelines

| Use Case | Memory | Time | Parallelism | Notes |
|----------|--------|------|-------------|-------|
| Development | 4096 | 1 | 1 | Fast, low security |
| Production | 19456 | 2 | 1 | Balanced |
| High Security | 65536 | 3 | 2 | Slow, very secure |

## API Reference

### Password Utilities (`password.ts`)

#### `hashPassword(plainPassword: string): Promise<string>`
Hash a password using Argon2 or bcrypt fallback.

```typescript
const hash = await hashPassword('myPassword123');
// Returns: $argon2id$v=19$m=19456,t=2,p=1$...
```

#### `verifyPassword(hash: string, plainPassword: string): Promise<boolean>`
Verify a password against its hash.

```typescript
const isValid = await verifyPassword(hash, 'myPassword123');
// Returns: true or false
```

#### `validatePassword(password: string): { valid: boolean; message?: string }`
Validate password strength before hashing.

```typescript
const result = validatePassword('weak');
// Returns: { valid: false, message: "Password must be at least 8 characters long" }
```

#### Utility Functions
- `isArgon2Hash(hash: string): boolean` - Detect Argon2 hashes
- `isBcryptHash(hash: string): boolean` - Detect bcrypt hashes

### Validation Schemas (`validators.ts`)

#### `RegisterSchema`
Validates user registration data.

```typescript
const schema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).refine(...), // Letter + digit required
  displayName: z.string().trim().min(1).max(100).optional()
});
```

#### `LoginSchema`
Validates login credentials.

```typescript
const schema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1)
});
```

#### Other Schemas
- `ChangePasswordSchema` - Password change requests
- `PasswordResetRequestSchema` - Password reset initiation
- `PasswordResetConfirmSchema` - Password reset completion
- `UpdateProfileSchema` - Profile updates

### Helper Functions

```typescript
// Quick validation helpers
isValidEmail('test@example.com'); // true
isValidPassword('strongPass123'); // true
```

## Usage Examples

### Complete Registration Flow

```typescript
import { RegisterSchema, hashPassword } from './auth';
import { createUser } from './users';

async function registerUser(body: unknown) {
  // 1. Validate input
  const validation = RegisterSchema.safeParse(body);
  if (!validation.success) {
    throw new Error('Invalid registration data');
  }
  
  const { email, password, displayName } = validation.data;
  
  // 2. Hash password
  const passwordHash = await hashPassword(password);
  
  // 3. Create user
  const user = await createUser({
    email,
    passwordHash,
    displayName
  });
  
  return user;
}
```

### Login Flow

```typescript
import { LoginSchema, verifyPassword } from './auth';
import { findByEmail } from './users';

async function loginUser(body: unknown) {
  // 1. Validate input
  const validation = LoginSchema.safeParse(body);
  if (!validation.success) {
    throw new Error('Invalid login data');
  }
  
  const { email, password } = validation.data;
  
  // 2. Find user
  const user = await findByEmail(email);
  if (!user) {
    throw new Error('Invalid credentials');
  }
  
  // 3. Verify password
  const isValid = await verifyPassword(user.passwordHash, password);
  if (!isValid) {
    throw new Error('Invalid credentials');
  }
  
  return user;
}
```

### Password Change

```typescript
import { ChangePasswordSchema, verifyPassword, hashPassword } from './auth';
import { updateUser } from './users';

async function changePassword(userId: string, body: unknown) {
  const validation = ChangePasswordSchema.safeParse(body);
  if (!validation.success) {
    throw new Error('Invalid password change data');
  }
  
  const { currentPassword, newPassword } = validation.data;
  const user = await findById(userId);
  
  // Verify current password
  const isCurrentValid = await verifyPassword(user.passwordHash, currentPassword);
  if (!isCurrentValid) {
    throw new Error('Current password is incorrect');
  }
  
  // Hash new password
  const newPasswordHash = await hashPassword(newPassword);
  
  // Update user
  return await updateUser(userId, { passwordHash: newPasswordHash });
}
```

## Testing

```bash
# Test password utilities
npm test src/tests/password.test.ts

# Test validation schemas
npm test src/tests/validators.test.ts

# Run demo
npx tsx src/auth/demo.ts
```

## Security Considerations

### ✅ Best Practices Implemented
- Salted password hashing
- Configurable work factors
- Input validation and sanitization
- Type-safe schemas
- Graceful error handling

### ⚠️ Important Notes
- Never log or store plain passwords
- Use HTTPS in production
- Implement rate limiting for auth endpoints
- Consider implementing account lockouts
- Use secure session management

### 🔧 Production Checklist
- [ ] Set strong `PASSWORD_HASH_*` values
- [ ] Use HTTPS everywhere
- [ ] Implement rate limiting
- [ ] Add brute force protection
- [ ] Set up monitoring/alerting
- [ ] Regular security audits

## Integration with User Store

This auth module works seamlessly with both user storage options:

```typescript
// With JSON store
import { userStore } from '../users';
import { hashPassword } from '../auth';

const user = await userStore.createUser({
  email: 'user@example.com',
  passwordHash: await hashPassword('password123'),
  displayName: 'John Doe'
});

// With Prisma repository
import { userRepo } from '../users';
// Same API, different implementation
```

## Troubleshooting

### Common Issues

**Argon2 compilation errors**: Falls back to bcrypt automatically
**Validation errors**: Check the error messages in the Zod result
**Password too weak**: Ensure minimum 8 chars with letters and digits
**Email not normalized**: Schemas automatically lowercase and trim emails

### Debug Tips

```typescript
// Enable detailed error logging
process.env.NODE_ENV = 'development';

// Test password validation
const result = validatePassword('yourPassword');
console.log(result);

// Test schema validation
const validation = RegisterSchema.safeParse(yourData);
if (!validation.success) {
  console.log(validation.error.errors);
}
```
