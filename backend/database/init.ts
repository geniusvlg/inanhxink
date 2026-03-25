import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import db from '../config/database';

dotenv.config();

async function init() {
  // Run all migration SQL files in version order
  const migrationDir = __dirname;
  const sqlFiles = fs
    .readdirSync(migrationDir)
    .filter(f => /^V\d+__.*\.sql$/.test(f))
    .sort();

  for (const file of sqlFiles) {
    const sql = fs.readFileSync(path.join(migrationDir, file), 'utf-8');
    console.log(`Running migration: ${file}`);
    await db.query(sql);
  }

  // Seed default admin user
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'changeme123';
  const hash = await bcrypt.hash(adminPassword, 12);
  await db.query(
    `INSERT INTO admin_users (username, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (username) DO NOTHING`,
    [adminUsername, hash]
  );
  console.log(`✓ Admin user '${adminUsername}' ready`);
  console.log('✓ Database initialised');
  process.exit(0);
}

init().catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});
