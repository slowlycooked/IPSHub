#!/usr/bin/env node
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = resolve(__dirname, '../data/ipshub.db');

console.log(`Opening database at: ${dbPath}`);
const db = new Database(dbPath);

try {
  // Get the admin user ID
  const admin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!admin) {
    throw new Error('Admin user not found. Please run the app to create the admin user first.');
  }

  const userId = admin.id;
  console.log(`Using admin user ID: ${userId}`);

  // Create some test nodes
  const testNodes = [
    {
      protocol: 'ss',
      name: 'Test SS Node 1',
      server: '1.2.3.4',
      port: 8388,
      cipher: 'aes-256-gcm',
      password: 'testpass123',
    },
    {
      protocol: 'vmess',
      name: 'Test Vmess Node',
      server: '5.6.7.8',
      port: 443,
      uuid: '550e8400-e29b-41d4-a716-446655440000',
      alterId: 0,
      tls: 'tls',
      host: 'example.com',
      transport: 'ws',
      path: '/vmess',
    },
    {
      protocol: 'trojan',
      name: 'Test Trojan Node',
      server: '9.10.11.12',
      port: 443,
      password: 'trojanpass123',
      host: 'trojan.example.com',
      allowInsecure: true,
    },
    {
      protocol: 'vless',
      name: 'Test VLESS Node',
      server: '13.14.15.16',
      port: 443,
      uuid: '660e8400-e29b-41d4-a716-446655440001',
      tls: 'tls',
      host: 'vless.example.com',
      transport: 'tcp',
    },
  ];

  // Get the first provider ID (xsus)
  const provider = db.prepare('SELECT id FROM providers LIMIT 1').get();
  if (!provider) {
    throw new Error('No providers found. Please add a provider first.');
  }

  const providerId = provider.id;
  console.log(`Using provider ID: ${providerId}`);

  // Insert test nodes
  const insertNode = db.prepare(`
    INSERT INTO nodes (
      id, fingerprint, provider_id, protocol, name, server, port,
      uuid, cipher, password, tls, tls_insecure, enabled, tag,
      extra_data, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = Date.now();
  const insertedNodes = [];

  for (const node of testNodes) {
    const fingerprint = crypto
      .createHash('md5')
      .update(JSON.stringify(node))
      .digest('hex');

    const nodeId = uuidv4();
    try {
      insertNode.run(
        nodeId,
        fingerprint,
        providerId,
        node.protocol,
        node.name,
        node.server,
        node.port,
        node.uuid || null,
        node.cipher || null,
        node.password || null,
        node.tls || null,
        node.allowInsecure ? 1 : 0,
        1, // enabled
        null,
        JSON.stringify({}),
        now,
        now
      );
      insertedNodes.push({ id: nodeId, name: node.name });
      console.log(`✓ Created node: ${node.name}`);
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        console.log(`⊘ Node already exists: ${node.name}`);
      } else {
        throw err;
      }
    }
  }

  // Get existing profile or create new one
  let profile = db.prepare('SELECT id FROM profiles WHERE user_id = ? AND name = ?').get(userId, 'clash testing');
  let profileId;

  if (profile) {
    profileId = profile.id;
    console.log(`✓ Using existing profile: clash testing`);
  } else {
    profileId = uuidv4();
    db.prepare(`
      INSERT INTO profiles (
        id, user_id, name, description, output_format,
        include_protocols, exclude_keywords, access_count,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      profileId,
      userId,
      'clash testing',
      'Test profile for Clash subscription',
      'clash',
      JSON.stringify(['ss', 'vmess', 'trojan', 'vless']),
      JSON.stringify([]),
      0,
      now,
      now
    );
    console.log(`✓ Created profile: clash testing`);
  }

  // Create/regenerate token for profile
  const profileToken = crypto.randomBytes(32).toString('hex');
  const profileTokenHash = crypto.createHash('sha256').update(profileToken).digest('hex');

  db.prepare(`
    INSERT INTO profile_tokens (id, profile_id, token_hash, created_at)
    VALUES (?, ?, ?, ?)
  `).run(uuidv4(), profileId, profileTokenHash, now);

  console.log(`✓ Generated new token`);

  // Print the subscription URL
  const subUrl = `http://localhost:8118/sub/clash/clash%20testing?token=${profileToken}`;
  console.log(`\n✅ Test data ready! Subscription URL:\n${subUrl}`);
  console.log('\nYou can now try importing this URL into your Clash app!');
  console.log('\nNote: The server runs on port 8118 (not 5173, which is the frontend)');

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
} finally {
  db.close();
}
