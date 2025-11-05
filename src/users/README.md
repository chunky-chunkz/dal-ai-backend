# User Management System

This project uses a simple JSON file-based storage for user management.

## JSON File Store

**File**: `src/users/user.repo.ts`

Simple JSON file-based storage for all environments.

### Usage:
```typescript
import * as userRepo from './users/user.repo';

// Create a user
const user = await userRepo.createUser({
  email: 'user@example.com',
  passwordHash: 'hashed_password',
  displayName: 'John Doe'
});

// Find by email (case-insensitive)
const foundUser = await userRepo.findByEmail('user@example.com');

// Find by ID
const userById = await userRepo.findById(user.id);

// Find by Microsoft OID
const msUser = await userRepo.findByMsOid('microsoft-oid-12345');

// Update user
const updatedUser = await userRepo.updateUser(user.id, {
  displayName: 'John Smith'
});
```

### Features:
- ✅ Case-insensitive email lookup
- ✅ Unique email constraint
- ✅ JSON persistence to `data/users.json`
- ✅ Auto-generated IDs (32-char hex)
- ✅ TypeScript support
- ✅ Microsoft OID mapping
- ✅ No database setup required

## Environment Variables

Add to your `.env` file:

```env
# Required for password hashing
PASSWORD_HASH_MEMORY=19456
PASSWORD_HASH_TIME=2
PASSWORD_HASH_PARALLELISM=1
```

## User Model

```typescript
interface User {
  id: string;           // Auto-generated
  email: string;        // Unique, case-insensitive
  passwordHash: string; // For local auth
  displayName?: string; // User's display name
  msOid?: string;       // Microsoft Graph OID (unique)
  createdAt: string;    // ISO timestamp
}
```

## Testing

```bash
# Test user repository
npm test src/tests/user.repo.test.ts

# Test all
npm test
```

## Data Storage

- **Location**: `data/users.json`
- **Format**: JSON array of user objects
- **Backup**: Automatically created on startup if missing
- **Performance**: Suitable for up to 10,000 users
