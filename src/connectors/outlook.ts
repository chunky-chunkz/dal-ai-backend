/**
 * Task: Outlook/Graph connector using a valid access token.
 * Requirements:
 * - export async function listNextEvents(accessToken, limit=3)
 *   GET https://graph.microsoft.com/v1.0/me/events?$top={limit}&$orderby=start/dateTime asc
 *   Map -> {subject, start, location?}
 * - export async function listUnreadMail(accessToken, limit=5)
 *   GET https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$filter=isRead eq false&$top={limit}
 *   Map -> {from, subject, received}
 * - Throw on non-200; handle 401 so caller can attempt refresh.
 */

// Microsoft Graph API base URL
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

// Event interface for calendar events
export interface CalendarEvent {
  subject: string;
  start: string; // ISO date string
  location?: string;
}

// Email interface for mail messages
export interface EmailMessage {
  from: string;
  subject: string;
  received: string; // ISO date string
}

// Raw Microsoft Graph event response interface
interface GraphEvent {
  subject: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName?: string;
  };
  id: string;
  webLink?: string;
  bodyPreview?: string;
  organizer?: {
    emailAddress?: {
      name?: string;
      address?: string;
    };
  };
}

// Raw Microsoft Graph message response interface
interface GraphMessage {
  subject: string;
  receivedDateTime: string;
  from: {
    emailAddress: {
      name?: string;
      address: string;
    };
  };
  id: string;
  webLink?: string;
  bodyPreview?: string;
  importance?: string;
  isRead: boolean;
}

// Custom error for authentication issues
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Make authenticated request to Microsoft Graph API
 * @param accessToken - Valid Microsoft access token
 * @param endpoint - API endpoint (relative to /v1.0)
 * @returns Response data
 * @throws AuthenticationError for 401, Error for other failures
 */
async function makeGraphRequest(accessToken: string, endpoint: string): Promise<any> {
  const url = `${GRAPH_API_BASE}${endpoint}`;
  
  console.log(`🔍 Making Graph API request: ${endpoint}`);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401) {
      console.warn('🔐 Authentication failed - token may be expired');
      throw new AuthenticationError('Access token is invalid or expired');
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Graph API error: ${response.status} - ${errorText}`);
      
      if (response.status === 403) {
        throw new Error('Insufficient permissions for this operation');
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded for Microsoft Graph API');
      } else {
        throw new Error(`Microsoft Graph API error: ${response.status} - ${errorText}`);
      }
    }

    const data = await response.json();
    console.log(`✅ Graph API request successful: ${endpoint}`);
    return data;

  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    } else if (error instanceof Error) {
      console.error(`❌ Error making Graph request to ${endpoint}:`, error.message);
      throw error;
    } else {
      console.error(`❌ Unknown error making Graph request to ${endpoint}:`, error);
      throw new Error('Failed to make Graph API request');
    }
  }
}

/**
 * List upcoming calendar events
 * @param accessToken - Valid Microsoft access token with Calendars.Read scope
 * @param limit - Maximum number of events to return (default: 3)
 * @returns Array of upcoming calendar events
 */
export async function listNextEvents(accessToken: string, limit: number = 3): Promise<CalendarEvent[]> {
  if (!accessToken) {
    throw new Error('Access token is required');
  }

  if (limit < 1 || limit > 50) {
    throw new Error('Limit must be between 1 and 50');
  }

  const now = new Date().toISOString();
  const endpoint = `/me/events?$top=${limit}&$orderby=start/dateTime asc&$filter=start/dateTime ge '${now}'`;

  try {
    const response = await makeGraphRequest(accessToken, endpoint);
    
    if (!response.value || !Array.isArray(response.value)) {
      throw new Error('Invalid response format from Graph API');
    }

    const events: CalendarEvent[] = response.value.map((event: GraphEvent) => {
      return {
        subject: event.subject || 'No Subject',
        start: event.start.dateTime,
        location: event.location?.displayName || undefined
      };
    });

    console.log(`📅 Retrieved ${events.length} upcoming events`);
    return events;

  } catch (error) {
    console.error('❌ Error fetching calendar events:', error);
    throw error;
  }
}

/**
 * List unread emails from inbox
 * @param accessToken - Valid Microsoft access token with Mail.Read scope
 * @param limit - Maximum number of emails to return (default: 5)
 * @returns Array of unread email messages
 */
export async function listUnreadMail(accessToken: string, limit: number = 5): Promise<EmailMessage[]> {
  if (!accessToken) {
    throw new Error('Access token is required');
  }

  if (limit < 1 || limit > 50) {
    throw new Error('Limit must be between 1 and 50');
  }

  const endpoint = `/me/mailFolders/Inbox/messages?$filter=isRead eq false&$top=${limit}&$orderby=receivedDateTime desc`;

  try {
    const response = await makeGraphRequest(accessToken, endpoint);
    
    if (!response.value || !Array.isArray(response.value)) {
      throw new Error('Invalid response format from Graph API');
    }

    const emails: EmailMessage[] = response.value.map((message: GraphMessage) => {
      const fromName = message.from.emailAddress.name;
      const fromAddress = message.from.emailAddress.address;
      const fromDisplay = fromName ? `${fromName} <${fromAddress}>` : fromAddress;

      return {
        from: fromDisplay,
        subject: message.subject || 'No Subject',
        received: message.receivedDateTime
      };
    });

    console.log(`📧 Retrieved ${emails.length} unread emails`);
    return emails;

  } catch (error) {
    console.error('❌ Error fetching unread emails:', error);
    throw error;
  }
}

/**
 * Get user's calendar details (bonus function)
 * @param accessToken - Valid Microsoft access token
 * @returns Calendar information
 */
export async function getCalendarInfo(accessToken: string): Promise<any> {
  if (!accessToken) {
    throw new Error('Access token is required');
  }

  try {
    const response = await makeGraphRequest(accessToken, '/me/calendar');
    console.log(`📅 Retrieved calendar info: ${response.name}`);
    return {
      name: response.name,
      id: response.id,
      owner: response.owner?.name || 'Unknown'
    };

  } catch (error) {
    console.error('❌ Error fetching calendar info:', error);
    throw error;
  }
}

/**
 * Get mail folder statistics (bonus function)
 * @param accessToken - Valid Microsoft access token
 * @returns Inbox statistics
 */
export async function getInboxStats(accessToken: string): Promise<any> {
  if (!accessToken) {
    throw new Error('Access token is required');
  }

  try {
    const response = await makeGraphRequest(accessToken, '/me/mailFolders/Inbox');
    console.log(`📊 Retrieved inbox stats: ${response.totalItemCount} total, ${response.unreadItemCount} unread`);
    
    return {
      totalItems: response.totalItemCount || 0,
      unreadItems: response.unreadItemCount || 0,
      displayName: response.displayName || 'Inbox'
    };

  } catch (error) {
    console.error('❌ Error fetching inbox stats:', error);
    throw error;
  }
}

/**
 * Format date for display (utility function)
 * @param isoString - ISO date string
 * @returns Formatted date string
 */
export function formatEventDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('de-DE', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.warn('⚠️ Error formatting date:', error);
    return isoString;
  }
}

/**
 * Test Microsoft Graph connectivity (utility function)
 * @param accessToken - Access token to test
 * @returns Boolean indicating if connection is working
 */
export async function testGraphConnectivity(accessToken: string): Promise<boolean> {
  try {
    await makeGraphRequest(accessToken, '/me');
    console.log('✅ Microsoft Graph connectivity test successful');
    return true;
  } catch (error) {
    console.error('❌ Microsoft Graph connectivity test failed:', error);
    return false;
  }
}
