const { MongoClient } = require('mongodb');
(async () => {
  const c = await MongoClient.connect('mongodb://127.0.0.1:27017/?directConnection=true');
  const admin = c.db('admin');
  try {
    const r = await admin.command({ replSetInitiate: { _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27017' }] } });
    console.log('initiated:', JSON.stringify(r));
  } catch (e) { console.error('init err:', e.message); }
  await c.close();
})();
