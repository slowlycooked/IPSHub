import path from 'path';
import fs from 'fs';
import { createLogger } from '../utils/logger';

const logger = createLogger('db');

interface StorageData {
  users: any[];
  providers: any[];
  nodes: any[];
  profiles: any[];
  refreshJobs: any[];
  accessLogs: any[];
}

let storageData: StorageData = {
  users: [],
  providers: [],
  nodes: [],
  profiles: [],
  refreshJobs: [],
  accessLogs: [],
};

let storagePath: string;

export function initDatabase(): void {
  const dbPath = process.env.DB_PATH || './data/ipshub.db.json';
  storagePath = dbPath;
  
  // Create directory if it doesn't exist
  const dir = path.dirname(storagePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Load existing data if it exists
  if (fs.existsSync(storagePath)) {
    try {
      const data = fs.readFileSync(storagePath, 'utf-8');
      storageData = JSON.parse(data);
      logger.info(`Database loaded from ${storagePath}`);
    } catch (error) {
      logger.error('Failed to load database, starting fresh');
      saveData();
    }
  } else {
    saveData();
  }

  logger.info(`Database initialized at ${storagePath}`);
}

function saveData(): void {
  if (!storagePath) return;
  try {
    fs.writeFileSync(storagePath, JSON.stringify(storageData, null, 2));
  } catch (error) {
    logger.error('Failed to save database', error);
  }
}

export function getDatabase() {
  return {
    users: {
      getAll: () => storageData.users,
      getById: (id: string) => storageData.users.find((u: any) => u.id === id),
      getByUsername: (username: string) => storageData.users.find((u: any) => u.username === username),
      insert: (user: any) => {
        storageData.users.push(user);
        saveData();
      },
      update: (id: string, updates: any) => {
        const user = storageData.users.find((u: any) => u.id === id);
        if (user) {
          Object.assign(user, updates, { updated_at: new Date().toISOString() });
          saveData();
        }
      },
    },
    providers: {
      getAll: () => storageData.providers,
      getById: (id: string) => storageData.providers.find((p: any) => p.id === id),
      insert: (provider: any) => {
        storageData.providers.push(provider);
        saveData();
      },
      update: (id: string, updates: any) => {
        const provider = storageData.providers.find((p: any) => p.id === id);
        if (provider) {
          Object.assign(provider, updates, { updated_at: new Date().toISOString() });
          saveData();
        }
      },
      delete: (id: string) => {
        const index = storageData.providers.findIndex((p: any) => p.id === id);
        if (index > -1) {
          storageData.providers.splice(index, 1);
          saveData();
        }
      },
    },
    nodes: {
      getAll: () => storageData.nodes,
      getByProviderId: (providerId: string) => storageData.nodes.filter((n: any) => n.provider_id === providerId),
      getById: (id: string) => storageData.nodes.find((n: any) => n.id === id),
      getByFingerprint: (fingerprint: string) => storageData.nodes.find((n: any) => n.fingerprint === fingerprint),
      insert: (node: any) => {
        storageData.nodes.push(node);
        saveData();
      },
      update: (id: string, updates: any) => {
        const node = storageData.nodes.find((n: any) => n.id === id);
        if (node) {
          Object.assign(node, updates, { updated_at: new Date().toISOString() });
          saveData();
        }
      },
      deleteByProviderId: (providerId: string) => {
        storageData.nodes = storageData.nodes.filter((n: any) => n.provider_id !== providerId);
        saveData();
      },
    },
    profiles: {
      getAll: () => storageData.profiles,
      getById: (id: string) => storageData.profiles.find((p: any) => p.id === id),
      getByName: (name: string) => storageData.profiles.find((p: any) => p.name === name),
      getByTokenHash: (tokenHash: string) => storageData.profiles.find((p: any) => p.token_hash === tokenHash),
      insert: (profile: any) => {
        storageData.profiles.push(profile);
        saveData();
      },
      update: (id: string, updates: any) => {
        const profile = storageData.profiles.find((p: any) => p.id === id);
        if (profile) {
          Object.assign(profile, updates, { updated_at: new Date().toISOString() });
          saveData();
        }
      },
      delete: (id: string) => {
        const index = storageData.profiles.findIndex((p: any) => p.id === id);
        if (index > -1) {
          storageData.profiles.splice(index, 1);
          saveData();
        }
      },
    },
    refreshJobs: {
      getAll: () => storageData.refreshJobs,
      getByProviderId: (providerId: string) => storageData.refreshJobs.filter((j: any) => j.provider_id === providerId),
      insert: (job: any) => {
        storageData.refreshJobs.push(job);
        saveData();
      },
      update: (id: string, updates: any) => {
        const job = storageData.refreshJobs.find((j: any) => j.id === id);
        if (job) {
          Object.assign(job, updates);
          saveData();
        }
      },
    },
    accessLogs: {
      getAll: () => storageData.accessLogs,
      getByProfileId: (profileId: string) => storageData.accessLogs.filter((l: any) => l.profile_id === profileId),
      insert: (log: any) => {
        storageData.accessLogs.push(log);
        saveData();
      },
    },
  };
}

export function closeDatabase(): void {
  saveData();
  logger.info('Database closed');
}

