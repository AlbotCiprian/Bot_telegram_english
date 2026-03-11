import fs from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { config } from "../../utils/config.js";
import { logger } from "../../utils/logger.js";

type LocalMigration = {
  id: string;
  sql: string;
};

async function loadMigrations(): Promise<LocalMigration[]> {
  const migrationsDir = path.resolve(process.cwd(), "src", "db", "prisma", "migrations");
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  const folders = entries.filter((entry) => entry.isDirectory()).sort((left, right) => left.name.localeCompare(right.name));

  const migrations: LocalMigration[] = [];
  for (const folder of folders) {
    const filePath = path.join(migrationsDir, folder.name, "migration.sql");
    const sql = await fs.readFile(filePath, "utf8");
    migrations.push({
      id: folder.name,
      sql,
    });
  }

  return migrations;
}

async function ensureMigrationTable(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "_local_migrations" (
      "id" TEXT PRIMARY KEY,
      "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function main(): Promise<void> {
  const client = new Client({
    connectionString: config.DATABASE_URL,
  });

  await client.connect();
  await ensureMigrationTable(client);

  const appliedRows = await client.query<{ id: string }>(`SELECT "id" FROM "_local_migrations"`);
  const applied = new Set(appliedRows.rows.map((row: { id: string }) => row.id));
  const migrations = await loadMigrations();

  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      continue;
    }

    logger.info({ migration: migration.id }, "Aplic migratia locala.");
    await client.query("BEGIN");
    try {
      await client.query(migration.sql);
      await client.query(`INSERT INTO "_local_migrations" ("id") VALUES ($1)`, [migration.id]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  await client.end();
  logger.info("Migratiile locale au fost aplicate.");
}

main().catch((error) => {
  logger.error({ err: error }, "Aplicarea migratiilor a esuat.");
  process.exit(1);
});
