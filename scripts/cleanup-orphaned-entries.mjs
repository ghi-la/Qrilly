// One-off cleanup: removes billed work entries whose invoice no longer exists
// (left behind by invoices deleted before deleting an invoice also removed its
// hours). Run with:  npm run cleanup:orphans            (dry run)
//                    npm run cleanup:orphans -- --apply
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is not set (run through the npm script so .env.local is loaded).');
const apply = process.argv.includes('--apply');

await mongoose.connect(uri);
const db = mongoose.connection.db;
const entries = db.collection('workentries');
const invoices = db.collection('invoices');

const invoiceIds = await entries.distinct('invoiceId', { billed: true });
const existing = new Set(
  (await invoices.find({ _id: { $in: invoiceIds.filter(Boolean) } }, { projection: { _id: 1 } }).toArray()).map((i) =>
    String(i._id),
  ),
);
const orphaned = invoiceIds.filter((id) => !id || !existing.has(String(id)));
const filter = { billed: true, invoiceId: { $in: orphaned } };
const count = await entries.countDocuments(filter);

if (apply) {
  const { deletedCount } = await entries.deleteMany(filter);
  console.log(`Deleted ${deletedCount} orphaned entries.`);
} else {
  console.log(`${count} orphaned entries would be deleted. Re-run with --apply to delete them.`);
}
await mongoose.disconnect();
