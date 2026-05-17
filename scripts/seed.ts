import { db } from '../src/lib/db'

async function seed() {
  console.log('Seeding database...')
  console.log('No seed data - use Excel import to populate data')
  console.log('Seeding complete!')
}

seed()
  .catch(console.error)
  .finally(() => db.$disconnect())
