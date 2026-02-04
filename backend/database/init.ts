import db from '../config/database';
import fs from 'fs';
import path from 'path';

async function initDatabase() {
  try {
    console.log('Initializing database...');
    
    // Read and execute schema
    const schemaSQL = fs.readFileSync(
      path.join(__dirname, 'schema.sql'),
      'utf8'
    );
    await db.query(schemaSQL);
    console.log('✓ Schema created successfully');
    
    // Read and execute seed data
    const seedSQL = fs.readFileSync(
      path.join(__dirname, 'seed.sql'),
      'utf8'
    );
    await db.query(seedSQL);
    console.log('✓ Seed data inserted successfully');
    
    console.log('Database initialization complete!');
  } catch (error) {
    const err = error as Error;
    console.error('Error initializing database:', err);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  initDatabase()
    .then(() => {
      console.log('Database setup complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Database setup failed:', error);
      process.exit(1);
    });
}

export default initDatabase;

