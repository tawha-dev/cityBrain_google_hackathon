import { seedResources } from './repository.js';
import { pool } from './pool.js';

async function seed() {
  console.log('Seeding resources...');
  await seedResources();
  console.log('Seed complete.');
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
