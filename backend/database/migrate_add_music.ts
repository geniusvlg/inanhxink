import db from '../config/database';

async function migrate() {
  try {
    console.log('Running migration: Add music fields...');
    
    // Add music_link column if it doesn't exist
    await db.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='orders' AND column_name='music_link') THEN
          ALTER TABLE orders ADD COLUMN music_link VARCHAR(500);
        END IF;
      END $$;
    `);
    
    // Add music_added column if it doesn't exist
    await db.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='orders' AND column_name='music_added') THEN
          ALTER TABLE orders ADD COLUMN music_added BOOLEAN DEFAULT false;
        END IF;
      END $$;
    `);
    
    // Add keychain_price column if it doesn't exist
    await db.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='orders' AND column_name='keychain_price') THEN
          ALTER TABLE orders ADD COLUMN keychain_price DECIMAL(10, 2) DEFAULT 0;
        END IF;
      END $$;
    `);
    
    console.log('✓ Migration completed successfully');
  } catch (error) {
    const err = error as Error;
    console.error('Error running migration:', err);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('Migration complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export default migrate;

