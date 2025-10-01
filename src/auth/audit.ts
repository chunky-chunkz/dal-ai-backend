/**
 * Task: Log auth events (safe).
 * - recordAuthEvent({type:"register"|"login"|"logout", userId?, email?, ip, ua, ok:boolean, reason?})
 * - Append to src/data/auth.log (JSONL). Never log passwords/tokens.
 */

import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to auth log file
const AUTH_LOG_PATH = join(__dirname, '..', 'data', 'auth.log');

/**
 * Authentication event types
 */
export type AuthEventType = 'register' | 'login' | 'logout' | 'failed_login' | 'failed_register';

/**
 * Authentication event data structure
 */
export interface AuthEvent {
  type: AuthEventType;
  userId?: string;
  email?: string;
  ip: string;
  userAgent?: string;
  ok: boolean;
  reason?: string;
  timestamp: string;
  sessionId?: string;
}

/**
 * Safe authentication event data (for recording)
 * Excludes any potentially sensitive information
 */
export interface SafeAuthEventData {
  type: AuthEventType;
  userId?: string;
  email?: string;
  ip: string;
  ua?: string; // User agent (shortened property name)
  ok: boolean;
  reason?: string;
  sessionId?: string;
}

/**
 * Sanitize email for logging (keep domain, mask local part)
 * Example: "user@example.com" -> "u***@example.com"
 */
function sanitizeEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return '[invalid_email]';
  
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }
  
  return `${localPart[0]}${'*'.repeat(localPart.length - 2)}${localPart[localPart.length - 1]}@${domain}`;
}

/**
 * Sanitize user agent string (remove detailed version info)
 */
function sanitizeUserAgent(userAgent: string): string {
  // Keep browser name but remove detailed versions and system info
  return userAgent
    .replace(/\d+\.\d+[\d.]*\w*/g, 'X.X') // Replace version numbers
    .replace(/\([^)]*\)/g, '(...)') // Replace system info in parentheses
    .substring(0, 100); // Limit length
}

/**
 * Sanitize IP address for privacy (mask last octet for IPv4)
 */
function sanitizeIP(ip: string): string {
  // For IPv4, mask the last octet
  if (ip.includes('.') && !ip.includes(':')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
    }
  }
  
  // For IPv6 or other formats, mask the last part
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length > 1) {
      return parts.slice(0, -1).join(':') + ':***';
    }
  }
  
  // For localhost or unknown formats, keep as is
  if (ip === '127.0.0.1' || ip === 'localhost' || ip === '::1') {
    return ip;
  }
  
  return '[masked_ip]';
}

/**
 * Ensure the data directory exists
 */
async function ensureDataDirectory(): Promise<void> {
  const dataDir = dirname(AUTH_LOG_PATH);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

/**
 * Record an authentication event to the audit log
 * @param eventData - Authentication event data (passwords/tokens are never logged)
 */
export async function recordAuthEvent(eventData: SafeAuthEventData): Promise<void> {
  try {
    // Ensure data directory exists
    await ensureDataDirectory();

    // Create safe audit log entry
    const auditEvent: AuthEvent = {
      type: eventData.type,
      userId: eventData.userId,
      email: eventData.email ? sanitizeEmail(eventData.email) : undefined,
      ip: sanitizeIP(eventData.ip),
      userAgent: eventData.ua ? sanitizeUserAgent(eventData.ua) : undefined,
      ok: eventData.ok,
      reason: eventData.reason,
      timestamp: new Date().toISOString(),
      sessionId: eventData.sessionId
    };

    // Convert to JSONL format (one JSON object per line)
    const logLine = JSON.stringify(auditEvent) + '\n';

    // Append to log file
    await fs.appendFile(AUTH_LOG_PATH, logLine, 'utf8');

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Auth Event:', {
        type: auditEvent.type,
        email: auditEvent.email,
        ip: auditEvent.ip,
        ok: auditEvent.ok,
        reason: auditEvent.reason
      });
    }

  } catch (error) {
    // Never throw errors from audit logging - just log the error
    console.error('Failed to record auth event:', error);
  }
}

/**
 * Helper function to record successful login
 */
export async function recordLogin(userId: string, email: string, ip: string, userAgent?: string, sessionId?: string): Promise<void> {
  await recordAuthEvent({
    type: 'login',
    userId,
    email,
    ip,
    ua: userAgent,
    ok: true,
    sessionId
  });
}

/**
 * Helper function to record failed login
 */
export async function recordFailedLogin(email: string, ip: string, reason: string, userAgent?: string): Promise<void> {
  await recordAuthEvent({
    type: 'failed_login',
    email,
    ip,
    ua: userAgent,
    ok: false,
    reason
  });
}

/**
 * Helper function to record successful registration
 */
export async function recordRegister(userId: string, email: string, ip: string, userAgent?: string): Promise<void> {
  await recordAuthEvent({
    type: 'register',
    userId,
    email,
    ip,
    ua: userAgent,
    ok: true
  });
}

/**
 * Helper function to record failed registration
 */
export async function recordFailedRegister(email: string, ip: string, reason: string, userAgent?: string): Promise<void> {
  await recordAuthEvent({
    type: 'failed_register',
    email,
    ip,
    ua: userAgent,
    ok: false,
    reason
  });
}

/**
 * Helper function to record logout
 */
export async function recordLogout(userId?: string, email?: string, ip?: string, userAgent?: string, sessionId?: string): Promise<void> {
  await recordAuthEvent({
    type: 'logout',
    userId,
    email,
    ip: ip || 'unknown',
    ua: userAgent,
    ok: true,
    sessionId
  });
}

/**
 * Read recent auth events from the log file
 * @param limit - Maximum number of events to return (default: 100)
 * @returns Array of auth events, most recent first
 */
export async function getRecentAuthEvents(limit: number = 100): Promise<AuthEvent[]> {
  try {
    // Check if log file exists
    try {
      await fs.access(AUTH_LOG_PATH);
    } catch {
      return []; // File doesn't exist yet
    }

    // Read the log file
    const logContent = await fs.readFile(AUTH_LOG_PATH, 'utf8');
    
    // Parse JSONL format
    const lines = logContent.trim().split('\n').filter(line => line.trim());
    const events: AuthEvent[] = [];

    // Parse each line as JSON
    for (const line of lines) {
      try {
        const event = JSON.parse(line) as AuthEvent;
        events.push(event);
      } catch (parseError) {
        console.error('Failed to parse log line:', parseError);
      }
    }

    // Return most recent events first, limited by the specified count
    return events.reverse().slice(0, limit);

  } catch (error) {
    console.error('Failed to read auth events:', error);
    return [];
  }
}

/**
 * Get auth events for a specific user
 * @param userId - User ID to filter by
 * @param limit - Maximum number of events to return (default: 50)
 * @returns Array of auth events for the user, most recent first
 */
export async function getUserAuthEvents(userId: string, limit: number = 50): Promise<AuthEvent[]> {
  const allEvents = await getRecentAuthEvents(1000); // Get more events to filter
  
  return allEvents
    .filter(event => event.userId === userId)
    .slice(0, limit);
}

/**
 * Get failed authentication attempts from a specific IP
 * @param ip - IP address to check
 * @param timeWindowMs - Time window in milliseconds (default: 1 hour)
 * @returns Array of failed auth events from the IP
 */
export async function getFailedAttemptsFromIP(ip: string, timeWindowMs: number = 60 * 60 * 1000): Promise<AuthEvent[]> {
  const allEvents = await getRecentAuthEvents(500);
  const cutoffTime = new Date(Date.now() - timeWindowMs).toISOString();
  const sanitizedIP = sanitizeIP(ip);

  return allEvents.filter(event => 
    event.ip === sanitizedIP &&
    !event.ok &&
    event.timestamp >= cutoffTime
  );
}

/**
 * Clear old log entries (for maintenance)
 * @param olderThanDays - Remove entries older than this many days (default: 90)
 */
export async function cleanupOldLogs(olderThanDays: number = 90): Promise<number> {
  try {
    const allEvents = await getRecentAuthEvents(10000); // Get many events
    const cutoffTime = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000)).toISOString();
    
    // Filter to keep only recent events
    const recentEvents = allEvents.filter(event => event.timestamp >= cutoffTime);
    
    // Rewrite the log file with only recent events
    const newLogContent = recentEvents
      .reverse() // Back to chronological order
      .map(event => JSON.stringify(event))
      .join('\n') + '\n';

    await fs.writeFile(AUTH_LOG_PATH, newLogContent, 'utf8');
    
    const removedCount = allEvents.length - recentEvents.length;
    console.log(`Cleaned up ${removedCount} old auth log entries`);
    
    return removedCount;

  } catch (error) {
    console.error('Failed to cleanup old logs:', error);
    return 0;
  }
}

/**
 * Get audit log statistics
 */
export async function getAuditStats(): Promise<{
  totalEvents: number;
  eventsByType: Record<AuthEventType, number>;
  successfulLogins: number;
  failedLogins: number;
  recentActivity: number; // Last 24 hours
}> {
  const allEvents = await getRecentAuthEvents(1000);
  const last24Hours = new Date(Date.now() - (24 * 60 * 60 * 1000)).toISOString();

  const stats = {
    totalEvents: allEvents.length,
    eventsByType: {
      register: 0,
      login: 0,
      logout: 0,
      failed_login: 0,
      failed_register: 0
    } as Record<AuthEventType, number>,
    successfulLogins: 0,
    failedLogins: 0,
    recentActivity: 0
  };

  for (const event of allEvents) {
    stats.eventsByType[event.type]++;
    
    if (event.type === 'login' && event.ok) {
      stats.successfulLogins++;
    }
    
    if ((event.type === 'login' || event.type === 'failed_login') && !event.ok) {
      stats.failedLogins++;
    }
    
    if (event.timestamp >= last24Hours) {
      stats.recentActivity++;
    }
  }

  return stats;
}
