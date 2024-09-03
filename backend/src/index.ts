import { serve } from '@hono/node-server';
import cron from 'node-cron';

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate as pgMigrate } from 'drizzle-orm/node-postgres/migrator';
import { migrate as pgliteMigrate } from 'drizzle-orm/pglite/migrator';
import { resetDb } from '#/cron/manage-db';
import { db } from '#/db/db';
import ascii from '#/lib/ascii';
import { env } from '../env';
import app from './server';

// Set i18n instance before starting server
import './lib/i18n';
import { config } from 'config';
// import { sdk } from './tracing';

const isNodePgDatabase = (_db: unknown): _db is NodePgDatabase => config.mode === 'production';

const main = async () => {
  // Reset db every Sunday at midnight
  cron.schedule('0 0 * * 0', resetDb, { scheduled: true, timezone: 'UTC' }).start();

  // Migrate db
  const migrateConfig = {
    migrationsFolder: 'drizzle',
    migrationsSchema: 'drizzle-backend',
  };
  if (isNodePgDatabase(db)) {
    await pgMigrate(db, migrateConfig);
  } else {
    await pgliteMigrate(db, migrateConfig);
  }

  // Start server
  serve(
    {
      fetch: app.fetch,
      hostname: '0.0.0.0',
      port: Number(env.PORT ?? '4004'),
    },
    (info) => {
      console.info(`Listening on http://${info.address}:${info.port}`);
      ascii();
    },
  );
};

// sdk.start();
main().catch((e) => {
  console.error('Failed to start server');
  console.error(e);
  process.exit(1);
});
