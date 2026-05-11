import cron, { ScheduledTask } from 'node-cron';
import { createLogger } from '@/utils/logger';
import { refreshDueProviders } from './refresh';

const logger = createLogger('provider-scheduler');

let schedulerTask: ScheduledTask | null = null;
let isTickRunning = false;

export function startProviderRefreshScheduler(): void {
  if (schedulerTask) {
    return;
  }

  schedulerTask = cron.schedule('* * * * *', async () => {
    if (isTickRunning) {
      logger.warn('Skipping provider refresh tick because previous tick is still running');
      return;
    }

    isTickRunning = true;

    try {
      await refreshDueProviders();
    } catch (error) {
      logger.error(error, 'Scheduled provider refresh tick failed');
    } finally {
      isTickRunning = false;
    }
  });

  logger.info('Provider refresh scheduler started');
}

export function stopProviderRefreshScheduler(): void {
  if (!schedulerTask) {
    return;
  }

  schedulerTask.stop();
  schedulerTask = null;
  logger.info('Provider refresh scheduler stopped');
}