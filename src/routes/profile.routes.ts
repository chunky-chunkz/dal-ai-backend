/**
 * Task: Add simple REST API for profiles.
 * - GET /api/profiles/:name -> returns all facts about person
 * - POST /api/profiles/:name {key,value} -> store/update fact
 * - Protect with requireAuth
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { requireAuth } from '../middleware/authGuard.js';
import { getProfile, setProfile } from '../memory/profileStore.js';

// Request/Response interfaces
interface ProfileParams {
  name: string;
}

interface SetProfileBody {
  key: string;
  value: string;
}

interface ProfileResponse {
  name: string;
  data: Record<string, string>;
  lastUpdated?: number;
}

interface SetProfileResponse {
  success: boolean;
  message: string;
  name: string;
  key: string;
  value: string;
}

interface ErrorResponse {
  error: string;
  statusCode: number;
}

export async function profileRoutes(fastify: FastifyInstance) {
  // Add auth protection for all routes in this file
  fastify.addHook('preHandler', requireAuth);

  // GET /api/profiles/:name - Get all facts about a person
  fastify.get<{
    Params: ProfileParams;
    Reply: ProfileResponse | ErrorResponse;
  }>('/profiles/:name', {
    schema: {
      params: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 }
        },
        required: ['name']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            data: { 
              type: 'object',
              additionalProperties: { type: 'string' }
            },
            lastUpdated: { type: 'number' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            statusCode: { type: 'number' }
          }
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            statusCode: { type: 'number' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: ProfileParams }>, reply: FastifyReply) => {
    try {
      const { name } = request.params;

      // Validate name parameter
      if (!name || name.trim().length === 0) {
        return reply.status(400).send({
          error: 'Name parameter is required and cannot be empty',
          statusCode: 400
        });
      }

      const profileData = getProfile(name.trim());
      
      return reply.status(200).send({
        name: name.trim(),
        data: profileData,
        lastUpdated: Date.now()
      });

    } catch (error) {
      console.error('Error getting profile:', error);
      return reply.status(500).send({
        error: 'Internal server error while retrieving profile',
        statusCode: 500
      });
    }
  });

  // POST /api/profiles/:name - Store/update a fact about a person
  fastify.post<{
    Params: ProfileParams;
    Body: SetProfileBody;
    Reply: SetProfileResponse | ErrorResponse;
  }>('/profiles/:name', {
    schema: {
      params: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 }
        },
        required: ['name']
      },
      body: {
        type: 'object',
        properties: {
          key: { type: 'string', minLength: 1 },
          value: { type: 'string', minLength: 1 }
        },
        required: ['key', 'value']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            name: { type: 'string' },
            key: { type: 'string' },
            value: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            statusCode: { type: 'number' }
          }
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            statusCode: { type: 'number' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: ProfileParams; Body: SetProfileBody }>, reply: FastifyReply) => {
    try {
      const { name } = request.params;
      const { key, value } = request.body;

      // Validate parameters
      if (!name || name.trim().length === 0) {
        return reply.status(400).send({
          error: 'Name parameter is required and cannot be empty',
          statusCode: 400
        });
      }

      if (!key || key.trim().length === 0) {
        return reply.status(400).send({
          error: 'Key is required and cannot be empty',
          statusCode: 400
        });
      }

      if (!value || value.trim().length === 0) {
        return reply.status(400).send({
          error: 'Value is required and cannot be empty',
          statusCode: 400
        });
      }

      // Store the profile fact
      await setProfile(name.trim(), key.trim(), value.trim());

      return reply.status(200).send({
        success: true,
        message: `Successfully stored ${key} for ${name}`,
        name: name.trim(),
        key: key.trim(),
        value: value.trim()
      });

    } catch (error) {
      console.error('Error setting profile:', error);
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Internal server error while setting profile',
        statusCode: 500
      });
    }
  });
}
