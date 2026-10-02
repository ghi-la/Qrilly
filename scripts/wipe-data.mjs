// DESTRUCTIVE. Deletes every user not listed in KEEP_EMAILS, and ALL content
// (presets, clients, invoices, work entries, logos) of every user - including
// the kept ones. Only the kept user documents themselves survive.
//
//   npm run wipe             dry run: only prints what would be deleted
//   npm run wipe -- --apply  actually deletes
import mongoose from 'mongoose';

// Accounts that are NOT deleted (compared lowercase).
const KEEP_EMAILS = ['matteo.ghilardini@gmail.com'];

// Collections holding user content; all of them are emptied.
const CONTENT_COLLECTIONS = ['presets', 'clients', 'invoices', 'workentries', 'fileassets'];

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is not set (run through the npm script so .env.local is loaded).');
const apply = process.argv.includes('--apply');
const keep = KEEP_EMAILS.map((email) => email.toLowerCase().trim());

await mongoose.connect(uri);
const db = mongoose.connection.db;
console.log(`Database: ${db.databaseName}`);

const users = db.collection('users');
const kept = await users.find({ email: { $in: keep } }, { projection: { email: 1 } }).toArray();
const missing = keep.filter((email) => !kept.some((u) => u.email === email));
if (missing.length > 0) {
  // Refuse to continue: a typo here would wipe every account.
  console.error(`Aborting - no user found for: ${missing.join(', ')}`);
  await mongoose.disconnect();
  process.exit(1);
}

const userFilter = { email: { $nin: keep } };
console.log(`Keeping ${kept.length} user(s): ${kept.map((u) => u.email).join(', ')}`);
console.log(`Users to delete: ${await users.countDocuments(userFilter)}`);
for (const name of CONTENT_COLLECTIONS) {
  console.log(`${name} to delete: ${await db.collection(name).countDocuments({})}`);
}

if (!apply) {
  console.log('\nDry run - nothing was deleted. Re-run with --apply to delete.');
} else {
  for (const name of CONTENT_COLLECTIONS) {
    const { deletedCount } = await db.collection(name).deleteMany({});
    console.log(`Deleted ${deletedCount} from ${name}.`);
  }
  const { deletedCount } = await users.deleteMany(userFilter);
  console.log(`Deleted ${deletedCount} users.`);
}

await mongoose.disconnect();
