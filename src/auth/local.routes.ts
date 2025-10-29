import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { RegisterSchema, LoginSchema } from './validators.js';
import { hashPassword, verifyPassword } from './password.js';
import { verifyAdminCredentials, isAdminEmail } from './admin.js';
import { createSession, destroySession, getSession, setSessionData } from './session.js';
import * as userRepo from '../users/user.repo.js';
import { requireAuth } from '../middleware/authGuard.js';
import { authRateLimit } from '../middleware/rateLimit.js';
import { recordRegister, recordFailedRegister, recordLogin, recordFailedLogin, recordLogout } from './audit.js';

/**
 * Register route handler
 */
async function registerHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Validate request body
    const validation = RegisterSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({
        error: 'validation_error',
        message: 'Invalid registration data',
        details: validation.error.errors
      });
    }

    const { email, password, displayName } = validation.data;

    // Check if user already exists
    const existingUser = await userRepo.findByEmail(email);
    if (existingUser) {
      // Record failed registration attempt
      await recordFailedRegister(
        email, 
        request.ip || 'unknown', 
        'user_already_exists',
        request.headers['user-agent']
      );
      
      return reply.status(409).send({
        error: 'user_exists',
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await userRepo.createUser({
      email,
      passwordHash,
      displayName
    });

    // Create session
    const sessionId = createSession(reply, user.id);
    
    // Add user data to session
    setSessionData(sessionId, {
      userId: user.id,
      user: {
        id: user.id,
        name: user.displayName || user.email,
        email: user.email
      }
    });

    // Record successful registration
    await recordRegister(
      user.id,
      email,
      request.ip || 'unknown',
      request.headers['user-agent']
    );

    // Return user data (without password hash)
    return reply.status(201).send({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    // Record failed registration attempt
    const requestBody = request.body as any;
    if (requestBody?.email) {
      await recordFailedRegister(
        requestBody.email,
        request.ip || 'unknown',
        'internal_error',
        request.headers['user-agent']
      );
    }
    
    return reply.status(500).send({
      error: 'internal_error',
      message: 'Registration failed'
    });
  }
}

/**
 * Login route handler
 */
async function loginHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Validate request body
    const validation = LoginSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({
        error: 'validation_error',
        message: 'Invalid login data',
        details: validation.error.errors
      });
    }

    const { email, password } = validation.data;

    // Check if it's the admin user first
    const adminUser = await verifyAdminCredentials(email, password);
    if (adminUser) {
      // Create session for admin
      const sessionId = createSession(reply, adminUser.id);
      
      // Add admin data to session
      setSessionData(sessionId, {
        userId: adminUser.id,
        user: {
          id: adminUser.id,
          name: adminUser.displayName,
          email: adminUser.email
        }
      });

      // Record successful admin login
      await recordLogin(
        adminUser.id,
        email,
        request.ip || 'unknown',
        request.headers['user-agent']
      );

      console.log('🔐 Admin login successful:', adminUser.email);

      // Return admin user data
      return reply.status(200).send({
        ok: true,
        user: {
          id: adminUser.id,
          email: adminUser.email,
          displayName: adminUser.displayName,
          isAdmin: true
        }
      });
    }

    // Find user in regular user repository
    const user = await userRepo.findByEmail(email);
    if (!user || !user.passwordHash) {
      // Record failed login attempt
      await recordFailedLogin(
        email,
        request.ip || 'unknown',
        'user_not_found',
        request.headers['user-agent']
      );
      
      return reply.status(401).send({
        error: 'invalid_credentials',
        message: 'Invalid email or password'
      });
    }

    // Verify password
    const isValidPassword = await verifyPassword(user.passwordHash, password);
    if (!isValidPassword) {
      // Record failed login attempt
      await recordFailedLogin(
        email,
        request.ip || 'unknown',
        'invalid_password',
        request.headers['user-agent']
      );
      
      return reply.status(401).send({
        error: 'invalid_credentials',
        message: 'Invalid email or password'
      });
    }

    // Create session
    const sessionId = createSession(reply, user.id);
    
    // Add user data to session
    setSessionData(sessionId, {
      userId: user.id,
      user: {
        id: user.id,
        name: user.displayName || user.email,
        email: user.email
      }
    });

    // Record successful login
    await recordLogin(
      user.id,
      email,
      request.ip || 'unknown',
      request.headers['user-agent']
    );

    // Return user data (without password hash)
    return reply.status(200).send({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    
    // Record failed login attempt
    const requestBody = request.body as any;
    if (requestBody?.email) {
      await recordFailedLogin(
        requestBody.email,
        request.ip || 'unknown',
        'internal_error',
        request.headers['user-agent']
      );
    }
    
    return reply.status(500).send({
      error: 'internal_error',
      message: 'Login failed'
    });
  }
}

/**
 * Logout route handler
 */
async function logoutHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Get current session
    const session = getSession(request);
    
    // Record logout attempt
    await recordLogout(
      session.userId,
      undefined, // We don't have email in session, could be added later
      request.ip || 'unknown',
      request.headers['user-agent'],
      session.sid
    );
    
    // Destroy session
    destroySession(reply, session.sid);

    return reply.status(200).send({
      ok: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    return reply.status(500).send({
      error: 'internal_error',
      message: 'Logout failed'
    });
  }
}

/**
 * Get current session info (for debugging)
 */
async function sessionInfoHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const session = getSession(request);
    
    if (!session.sid || !session.userId) {
      return reply.status(401).send({
        error: 'unauthorized',
        message: 'No active session'
      });
    }

    // Get user data
    const user = await userRepo.findById(session.userId);
    if (!user) {
      return reply.status(404).send({
        error: 'user_not_found',
        message: 'User not found'
      });
    }

    return reply.status(200).send({
      session: {
        id: session.sid,
        userId: session.userId
      },
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName
      }
    });

  } catch (error) {
    console.error('Session info error:', error);
    return reply.status(500).send({
      error: 'internal_error',
      message: 'Failed to get session info'
    });
  }
}

/**
 * Register local auth routes
 */
export async function registerLocalAuthRoutes(fastify: FastifyInstance): Promise<void> {
  // Register route
  fastify.post('/register', {
    preHandler: [authRateLimit],
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          displayName: { type: 'string' }
        }
      }
    }
  }, registerHandler);

  // Login route
  fastify.post('/login', {
    preHandler: [authRateLimit],
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 }
        }
      }
    }
  }, loginHandler);

  // Logout route
  fastify.post('/logout', logoutHandler);

  // Session info route (protected, for debugging)
  fastify.get('/session', {
    preHandler: requireAuth
  }, sessionInfoHandler);

  console.log('✅ Local auth routes registered');
}
