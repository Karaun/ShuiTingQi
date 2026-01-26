const path = require('path');
const fs = require('fs');
const Datastore = require('nedb-promises');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const pois = Datastore.create({ filename: path.join(dataDir, 'pois.db'), autoload: true });
const routes = Datastore.create({ filename: path.join(dataDir, 'routes.db'), autoload: true });
const logs = Datastore.create({ filename: path.join(dataDir, 'logs.db'), autoload: true });
const stats = Datastore.create({ filename: path.join(dataDir, 'stats.db'), autoload: true });

async function logOp(type, detailObj) {
  try {
    await logs.insert({ type, detail: detailObj || {}, ts: new Date().toISOString() });
  } catch (e) {}
}

async function incRequest(pathname, method) {
  try {
    await stats.update(
      { path: pathname, method },
      { $inc: { count: 1 } },
      { upsert: true }
    );
  } catch (e) {}
}

module.exports = { pois, routes, logs, stats, logOp, incRequest };
