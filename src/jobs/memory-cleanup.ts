/**
 * Memory Cleanup Job
 * 
 * Runs daily at 3am to remove expired memories based on TTL.
 * Logs expiration events to the metrics system.
 */

import { expireSweep } from '../memory/store.js';
import { logMemoryEvent, now } from '../memory/metrics/logger.js';

/**
 * Start the memory cleanup job
 * Runs immediately, then schedules daily execution at 3am
 */
export function startMemoryCleanupJob(): void {
  console.log('🧹 Initializing memory cleanup job...');
  
  // Run cleanup function
  const runCleanup = async () => {
    try {
      console.log('🧹 Starting memory cleanup job...');
      const removed = await expireSweep();
      
      if (removed > 0) {
        // Log expiration event
        await logMemoryEvent({
          type: 'expire',
          userId: 'system',
          key: `${removed}_memories_expired`,
          ts: now()
        });
        
        console.log(`✅ Cleanup complete: ${removed} memories expired`);
      } else {
        console.log('✅ Cleanup complete: No memories expired');
      }
    } catch (error) {
      console.error('❌ Memory cleanup job failed:', error);
      
      // Log error event
      try {
        await logMemoryEvent({
          type: 'error',
          where: 'cleanup-job',
          message: error instanceof Error ? error.message : String(error),
          ts: now()
        });
      } catch (logError) {
        console.error('Failed to log cleanup error:', logError);
      }
    }
  };
  
  // Initial run on startup
  runCleanup();
  
  // Schedule daily at 3am
  const msUntil3am = getMillisecondsUntil(3, 0);
  console.log(`⏰ Next cleanup scheduled in ${Math.round(msUntil3am / 1000 / 60)} minutes`);
  
  setTimeout(() => {
    runCleanup();
    // Then run daily
    setInterval(runCleanup, 24 * 60 * 60 * 1000);
  }, msUntil3am);
}

/**
 * Calculate milliseconds until a specific time today or tomorrow
 */
function getMillisecondsUntil(hour: number, minute: number): number {
  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  
  // If target time has already passed today, schedule for tomorrow
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }
  
  return target.getTime() - now.getTime();
}
