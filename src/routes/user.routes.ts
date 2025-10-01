/**
 * Task: User routes including both local auth and Microsoft integration.
 * Routes (prefixed with /api from app.ts registration):
 * - GET /me -> returns {id, email, displayName, providers:{local:boolean,microsoft:boolean}}
 * - GET /auth/providers -> returns {local:true, microsoft:true}
 * - GET /outlook/events -> returns next events (Microsoft users only)
 * - GET /outlook/unread -> returns unread mails (Microsoft users only)
 * - GET /outlook/summary -> returns combined summary data (Microsoft users only)
 */

import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/authGuard';
import { getValidAccessToken } from '../auth/token.store';
import { getMeExtended } from '../auth/userinfo';
import { listNextEvents, listUnreadMail, AuthenticationError, formatEventDate } from '../connectors/outlook';
import * as userRepo from '../users/user.repo';

// Response interfaces
interface UserResponse {
  id: string;
  displayName: string;
  email: string;
  providers?: {
    local: boolean;
    microsoft: boolean;
  };
  jobTitle?: string;
  officeLocation?: string;
}

interface EventsResponse {
  events: Array<{
    subject: string;
    start: string;
    formattedStart: string;
    location?: string;
  }>;
  count: number;
}

interface UnreadMailResponse {
  emails: Array<{
    from: string;
    subject: string;
    received: string;
    formattedReceived: string;
  }>;
  count: number;
}

interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
}

/**
 * Register protected user routes
 * @param fastify - Fastify instance
 */
export async function registerUserRoutes(fastify: FastifyInstance) {
  // Add preHandler for all routes in this scope
  await fastify.register(async function protectedRoutes(fastify) {
    fastify.addHook('preHandler', requireAuth);

    /**
     * GET /me - Get current user profile
     * Returns user information with provider info
     */
    fastify.get<{
      Reply: UserResponse | ErrorResponse;
    }>('/me', async (request, reply) => {
      try {
        // userId is guaranteed to exist after requireAuth
        const userId = request.userId!;
        console.log('🔍 Fetching user profile for userId:', userId);

        // Get user from store
        const user = await userRepo.findById(userId);
        if (!user) {
          return reply.code(404).send({
            error: 'User Not Found',
            message: 'User profile not found'
          });
        }

        // Determine authentication providers
        const providers = {
          local: !!user.passwordHash, // Has local password
          microsoft: !!user.msOid     // Has Microsoft OID
        };

        // Try to get enhanced Microsoft profile if user has Microsoft auth
        let response: UserResponse;
        
        if (user.msOid && request.sid) {
          try {
            const accessToken = await getValidAccessToken(request.sid);
            if (accessToken) {
              const msProfile = await getMeExtended(accessToken);
              response = {
                id: user.id,
                email: user.email,
                displayName: user.displayName || msProfile.displayName,
                providers,
                jobTitle: msProfile.jobTitle,
                officeLocation: msProfile.officeLocation
              };
            } else {
              // Fallback to local user data
              response = {
                id: user.id,
                email: user.email,
                displayName: user.displayName || 'User',
                providers
              };
            }
          } catch (error) {
            // If Microsoft fails, use local data
            response = {
              id: user.id,
              email: user.email,
              displayName: user.displayName || 'User',
              providers
            };
          }
        } else {
          // Local user only
          response = {
            id: user.id,
            email: user.email,
            displayName: user.displayName || 'User',
            providers
          };
        }

        console.log('✅ User profile retrieved successfully:', response.displayName);
        return reply.send(response);

      } catch (error) {
        console.error('❌ Error fetching user profile:', error);
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch user profile'
        });
      }
    });

    /**
     * GET /outlook/events - Get upcoming calendar events
     * Returns user's next calendar events
     */
    fastify.get<{
      Querystring: { limit?: string };
      Reply: EventsResponse | ErrorResponse;
    }>('/outlook/events', async (request, reply) => {
      try {
        const query = request.query as { limit?: string };
        const limit = parseInt(query.limit || '5', 10);
        
        if (limit < 1 || limit > 20) {
          return reply.code(400).send({
            error: 'Invalid Parameter',
            message: 'Limit must be between 1 and 20'
          });
        }

        const sid = request.sid!;
        console.log(`📅 Fetching ${limit} upcoming events for session:`, sid);

        // Get valid access token
        const accessToken = await getValidAccessToken(sid);
        if (!accessToken) {
          console.warn('⚠️ No valid access token found');
          return reply.code(502).send({
            error: 'Authentication Required',
            message: 'Please log in again to access your calendar',
            code: 'TOKEN_EXPIRED'
          });
        }

        // Fetch calendar events
        const events = await listNextEvents(accessToken, limit);
        
        const response: EventsResponse = {
          events: events.map(event => ({
            subject: event.subject,
            start: event.start,
            formattedStart: formatEventDate(event.start),
            location: event.location
          })),
          count: events.length
        };

        console.log(`✅ Retrieved ${response.count} calendar events`);
        return reply.send(response);

      } catch (error) {
        console.error('❌ Error fetching calendar events:', error);

        if (error instanceof AuthenticationError) {
          return reply.code(502).send({
            error: 'Authentication Required',
            message: 'Please log in again to access your calendar',
            code: 'AUTH_EXPIRED'
          });
        }

        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch calendar events'
        });
      }
    });

    /**
     * GET /outlook/unread - Get unread emails
     * Returns user's unread emails from inbox
     */
    fastify.get<{
      Querystring: { limit?: string };
      Reply: UnreadMailResponse | ErrorResponse;
    }>('/outlook/unread', async (request, reply) => {
      try {
        const query = request.query as { limit?: string };
        const limit = parseInt(query.limit || '10', 10);
        
        if (limit < 1 || limit > 50) {
          return reply.code(400).send({
            error: 'Invalid Parameter',
            message: 'Limit must be between 1 and 50'
          });
        }

        const sid = request.sid!;
        console.log(`📧 Fetching ${limit} unread emails for session:`, sid);

        // Get valid access token
        const accessToken = await getValidAccessToken(sid);
        if (!accessToken) {
          console.warn('⚠️ No valid access token found');
          return reply.code(502).send({
            error: 'Authentication Required',
            message: 'Please log in again to access your emails',
            code: 'TOKEN_EXPIRED'
          });
        }

        // Fetch unread emails
        const emails = await listUnreadMail(accessToken, limit);
        
        const response: UnreadMailResponse = {
          emails: emails.map(email => ({
            from: email.from,
            subject: email.subject,
            received: email.received,
            formattedReceived: formatEventDate(email.received)
          })),
          count: emails.length
        };

        console.log(`✅ Retrieved ${response.count} unread emails`);
        return reply.send(response);

      } catch (error) {
        console.error('❌ Error fetching unread emails:', error);

        if (error instanceof AuthenticationError) {
          return reply.code(502).send({
            error: 'Authentication Required',
            message: 'Please log in again to access your emails',
            code: 'AUTH_EXPIRED'
          });
        }

        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch unread emails'
        });
      }
    });

    /**
     * GET /outlook/summary - Get Outlook summary (bonus endpoint)
     * Returns combined calendar and email information
     */
    fastify.get<{
      Reply: {
        user: UserResponse;
        upcomingEvents: number;
        unreadEmails: number;
        nextEvent?: {
          subject: string;
          start: string;
          formattedStart: string;
        };
      } | ErrorResponse;
    }>('/outlook/summary', async (request, reply) => {
      try {
        const sid = request.sid!;
        console.log('📊 Fetching Outlook summary for session:', sid);

        // Get valid access token
        const accessToken = await getValidAccessToken(sid);
        if (!accessToken) {
          console.warn('⚠️ No valid access token found');
          return reply.code(502).send({
            error: 'Authentication Required',
            message: 'Please log in again to access your Outlook summary',
            code: 'TOKEN_EXPIRED'
          });
        }

        // Fetch data in parallel
        const [userProfile, events, emails] = await Promise.all([
          getMeExtended(accessToken),
          listNextEvents(accessToken, 1),
          listUnreadMail(accessToken, 1)
        ]);

        const user: UserResponse = {
          id: userProfile.id,
          displayName: userProfile.displayName,
          email: userProfile.mail || userProfile.userPrincipalName || 'Unknown',
          jobTitle: userProfile.jobTitle,
          officeLocation: userProfile.officeLocation
        };

        const response = {
          user,
          upcomingEvents: events.length,
          unreadEmails: emails.length,
          nextEvent: events.length > 0 ? {
            subject: events[0].subject,
            start: events[0].start,
            formattedStart: formatEventDate(events[0].start)
          } : undefined
        };

        console.log('✅ Outlook summary retrieved successfully');
        return reply.send(response);

      } catch (error) {
        console.error('❌ Error fetching Outlook summary:', error);

        if (error instanceof AuthenticationError) {
          return reply.code(502).send({
            error: 'Authentication Required',
            message: 'Please log in again to access your Outlook summary',
            code: 'AUTH_EXPIRED'
          });
        }

        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch Outlook summary'
        });
      }
    });

  });

  // Public route for auth providers
  fastify.get('/auth/providers', async (_request, reply) => {
    try {
      return reply.send({
        local: true,      // Local email/password auth is always available
        microsoft: true   // Microsoft auth remains available but optional
      });
    } catch (error) {
      console.error('❌ Error getting auth providers:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get auth providers'
      });
    }
  });
}

// Export route registration function
export default registerUserRoutes;
