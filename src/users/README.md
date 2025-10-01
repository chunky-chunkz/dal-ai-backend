# User Management System

This project includes two user storage implementations:

## 1. JSON File Store (Development/Quick Setup)

**File**: `src/users/user.store.ts`

Simple JSON file-based storage for development purposes.

### Usage:
```typescript
import * as userStore from './users/user.store';

// Create a user
const user = await userStore.createUser({
  email: 'user@example.com',
  passwordHash: 'hashed_password',
  displayName: 'John Doe'
});

// Find by email (case-insensitive)
const foundUser = await userStore.findByEmail('user@example.com');

// Update user
const updatedUser = await userStore.updateUser(user.id, {
  displayName: 'John Smith'
});
```

### Features:
- ✅ Case-insensitive email lookup
- ✅ Unique email constraint
- ✅ JSON persistence to `src/data/users.json`
- ✅ Auto-generated IDs
- ✅ TypeScript support

## 2. Prisma Database Repository (Production)

**File**: `src/users/user.repo.ts`  
**Schema**: `prisma/schema.prisma`

Database-backed storage using Prisma ORM with SQLite (dev) / PostgreSQL (prod).

### Setup:
```bash
# Install dependencies (already done)
npm install

# Generate Prisma client
npm run db:generate

# Run initial migration
npm run db:migrate

# Open Prisma Studio (optional)
npm run db:studio
```

### Usage:
```typescript
import * as userRepo from './users/user.repo';

// Same API as user.store.ts
const user = await userRepo.createUser({
  email: 'user@example.com',
  passwordHash: 'hashed_password',
  displayName: 'John Doe',
  msOid: 'microsoft-oid-12345' // Optional MS Graph ID
});
```

### Features:
- ✅ All features from JSON store
- ✅ Database transactions
- ✅ Microsoft OID mapping
- ✅ Better performance
- ✅ ACID compliance
- ✅ Easy migration to PostgreSQL

## Environment Variables

Add to your `.env` file:

```env
# Required for Prisma
DATABASE_URL="file:./dev.db"

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
# Test JSON store
npm test src/tests/user.store.test.ts

# Test Prisma repository
npm test src/tests/user.repo.test.ts

# Test all
npm test
```

## Migration Path

Start with JSON store for rapid development, then migrate to Prisma for production:

1. Use `user.store.ts` during development
2. Switch to `user.repo.ts` when ready for production
3. Both implementations share the same API interface
4. Export data from JSON and import into database if needed

## Production Database

For production, update `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"  // Change from "sqlite"
  url      = env("DATABASE_URL")
}
```

And set `DATABASE_URL` to your PostgreSQL connection string.
