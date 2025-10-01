# Session Management & Authentication Middleware

This module provides secure session management and authentication middleware for your DAL-AI Fastify application.

## Features

### 🔐 Session Management (`session.ts`)
- **Signed cookies** with HMAC verification using SESSION_SECRET
- **In-memory storage** (easily replaceable with Redis)
- **Automatic expiration** and cleanup
- **User ID tracking** in sessions
- **Secure cookie configuration** (httpOnly, sameSite, secure in production)

### 🛡️ Authentication Middleware (`authGuard.ts`)
- **requireAuth** - Blocks unauthorized requests with 401
- **optionalAuth** - Attaches user info if available
- **Rate limiting** protection
- **TypeScript integration** with request augmentation

## Quick Start

```typescript
import { createSession, getSession, destroySession } from './auth/session';
import { requireAuth, optionalAuth } from './middleware/authGuard';

// Create session after successful login
app.post('/login', async (request, reply) => {
  // ... validate credentials ...
  const sessionId = createSession(reply, user.id);
  return { success: true, sessionId };
});

// Protected route
app.get('/profile', { preHandler: requireAuth }, async (request, reply) => {
  const userId = request.userId; // Available after requireAuth
  // ... fetch user data ...
});

// Optional auth route
app.get('/posts', { preHandler: optionalAuth }, async (request, reply) => {
  const userId = request.userId; // Might be undefined
  // ... return posts, personalized if logged in ...
});
```

## API Reference

### Session Management

#### `createSession(reply: FastifyReply, userId: string): string`
Creates a new session and sets secure cookie.

```typescript
const sessionId = createSession(reply, 'user123');
```

#### `getSession(request: FastifyRequest): { sid?: string; userId?: string }`
Retrieves session data from request cookie.

```typescript
const { sid, userId } = getSession(request);
if (userId) {
  // User is authenticated
}
```

#### `destroySession(reply: FastifyReply, sid?: string): void`
Destroys session and clears cookie.

```typescript
destroySession(reply, sessionId);
```

### Authentication Middleware

#### `requireAuth(request, reply): Promise<void>`
Requires valid authentication, attaches `userId` to request.

```typescript
// Use as preHandler
app.get('/protected', { preHandler: requireAuth }, handler);

// Access userId in handler
async function handler(request: FastifyRequest) {
  const userId = request.userId; // string (guaranteed after requireAuth)
}
```

#### `optionalAuth(request, reply): Promise<void>`
Optionally attaches `userId` if session exists.

```typescript
// Use as preHandler
app.get('/public', { preHandler: optionalAuth }, handler);

// Conditionally access userId
async function handler(request: FastifyRequest) {
  if (request.userId) {
    // User is logged in
  } else {
    // Anonymous user
  }
}
```

## Environment Configuration

Required environment variables:

```env
# Session security (CRITICAL - change in production!)
SESSION_SECRET=your_secure_random_string_here

# Application URLs
APP_URL=http://localhost:8080
FRONTEND_ORIGIN=http://localhost:5173

# Environment
NODE_ENV=development  # or 'production'
```

### Session Cookie Configuration

Automatically configured based on environment:

| Setting | Development | Production |
|---------|-------------|------------|
| `httpOnly` | ✅ true | ✅ true |
| `secure` | ❌ false | ✅ true |
| `sameSite` | lax | lax |
| `maxAge` | 24 hours | 24 hours |

## TypeScript Integration

The middleware automatically extends Fastify's request interface:

```typescript
declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;  // Available after auth middleware
    sid?: string;     // Session ID
  }
}
```

## Complete Authentication Flow Example

```typescript
import Fastify from 'fastify';
import { RegisterSchema, LoginSchema, hashPassword, verifyPassword } from './auth';
import { createSession, destroySession } from './auth/session';
import { requireAuth } from './middleware/authGuard';
import { createUser, findByEmail } from './users';

const app = Fastify({ logger: true });

// Register endpoint
app.post('/auth/register', async (request, reply) => {
  // Validate input
  const validation = RegisterSchema.safeParse(request.body);
  if (!validation.success) {
    return reply.status(400).send({ error: 'validation_failed', details: validation.error.errors });
  }

  const { email, password, displayName } = validation.data;

  try {
    // Check if user exists
    const existingUser = await findByEmail(email);
    if (existingUser) {
      return reply.status(409).send({ error: 'user_exists' });
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const user = await createUser({ email, passwordHash, displayName });

    // Create session
    const sessionId = createSession(reply, user.id);

    return {
      success: true,
      user: { id: user.id, email: user.email, displayName: user.displayName },
      sessionId
    };
  } catch (error) {
    console.error('Registration error:', error);
    return reply.status(500).send({ error: 'registration_failed' });
  }
});

// Login endpoint
app.post('/auth/login', async (request, reply) => {
  const validation = LoginSchema.safeParse(request.body);
  if (!validation.success) {
    return reply.status(400).send({ error: 'validation_failed' });
  }

  const { email, password } = validation.data;

  try {
    // Find user
    const user = await findByEmail(email);
    if (!user) {
      return reply.status(401).send({ error: 'invalid_credentials' });
    }

    // Verify password
    const isValid = await verifyPassword(user.passwordHash, password);
    if (!isValid) {
      return reply.status(401).send({ error: 'invalid_credentials' });
    }

    // Create session
    const sessionId = createSession(reply, user.id);

    return {
      success: true,
      user: { id: user.id, email: user.email, displayName: user.displayName },
      sessionId
    };
  } catch (error) {
    console.error('Login error:', error);
    return reply.status(500).send({ error: 'login_failed' });
  }
});

// Logout endpoint
app.post('/auth/logout', { preHandler: requireAuth }, async (request, reply) => {
  destroySession(reply, request.sid);
  return { success: true };
});

// Protected profile endpoint
app.get('/profile', { preHandler: requireAuth }, async (request, reply) => {
  const user = await findById(request.userId!);
  if (!user) {
    return reply.status(404).send({ error: 'user_not_found' });
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt
  };
});

// Start server
app.listen({ port: 8080 }, (err) => {
  if (err) throw err;
  console.log('🚀 Server running on http://localhost:8080');
});
```

## Security Considerations

### ✅ Implemented Security Features
- HMAC-signed session cookies prevent tampering
- HttpOnly cookies prevent XSS attacks
- Secure cookies in production (HTTPS only)
- SameSite=lax prevents CSRF attacks
- Automatic session expiration
- Rate limiting support

### ⚠️ Production Checklist
- [ ] **Change SESSION_SECRET** to a cryptographically secure random value
- [ ] Enable HTTPS in production
- [ ] Implement session storage with Redis for scalability
- [ ] Add brute force protection for login endpoints
- [ ] Implement account lockout mechanisms
- [ ] Set up monitoring and alerting
- [ ] Regular security audits

### 🔧 Advanced Configuration

```typescript
// Custom session cleanup interval
import { cleanupExpiredSessions } from './auth/session';
setInterval(cleanupExpiredSessions, 15 * 60 * 1000); // Every 15 minutes

// Custom rate limiting
import { rateLimit } from './middleware/authGuard';
app.register(async (fastify) => {
  fastify.addHook('preHandler', rateLimit(50, 10 * 60 * 1000)); // 50 req/10min
});
```

## Testing

```bash
# Test session functionality
npm test src/tests/simple-auth.test.ts

# Run session demo
npx tsx src/auth/session-demo.ts

# Test complete auth flow
npm test src/tests/session-auth.test.ts
```

## Migration to Redis (Production)

For production scalability, replace the in-memory session store:

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Replace session storage methods
export async function setSessionData(sid: string, data: SessionData): Promise<void> {
  await redis.setex(`session:${sid}`, SESSION_MAX_AGE / 1000, JSON.stringify(data));
}

export async function getSessionData(sid: string): Promise<SessionData | null> {
  const data = await redis.get(`session:${sid}`);
  return data ? JSON.parse(data) : null;
}
```

## Troubleshooting

### Common Issues

**Session not persisting**: Check that SESSION_SECRET is set and consistent
**401 errors**: Verify cookie is being sent and signed correctly
**CORS issues**: Ensure credentials are allowed in CORS configuration
**Memory leaks**: Enable session cleanup in production

### Debug Mode

```typescript
// Enable session debugging
process.env.DEBUG_SESSIONS = 'true';

// Check session statistics
import { getSessionStats } from './auth/session';
console.log(getSessionStats());
```
