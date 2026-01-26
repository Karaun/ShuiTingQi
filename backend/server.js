const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Paths
const frontDir = path.join(__dirname, 'travel+');
const dataDir = path.join(__dirname, 'data');
const poisFile = path.join(dataDir, 'pois.json');
const routesFile = path.join(dataDir, 'routes.json');
const logsFile = path.join(dataDir, 'logs.json');
const statsFile = path.join(dataDir, 'stats.json');
const attractionsFile = path.join(dataDir, 'attractions.json');
const hydrophoneFile = path.join(dataDir, 'hydrophone.json');
const hydroHistoryFile = path.join(dataDir, 'hydro_history.json');

// Ensure data directory and file exist
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
// Ensure JSON files exist
for (const f of [poisFile, routesFile, logsFile, statsFile, attractionsFile, hydrophoneFile, hydroHistoryFile]) {
  if (!fs.existsSync(f)) fs.writeFileSync(f, f === statsFile ? '{}' : '[]', 'utf-8');
}

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Static serving of front-end
app.use('/', express.static(frontDir));
// Serve admin static pages
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Helpers for JSON file storage
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch (e) { return fallback; }
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}
function incRequest(pathname, method) {
  const stats = readJson(statsFile, {});
  const key = method + ' ' + pathname;
  stats[key] = (stats[key] || 0) + 1;
  writeJson(statsFile, stats);
}
function logOp(type, detail) {
  const logs = readJson(logsFile, []);
  logs.unshift({ id: Date.now(), type, detail: detail || {}, ts: new Date().toISOString() });
  if (logs.length > 500) logs.length = 500;
  writeJson(logsFile, logs);
}
function readPois() { return readJson(poisFile, []); }
function writePois(list) { writeJson(poisFile, list); }
function readRoutes() { return readJson(routesFile, []); }
function writeRoutes(list) { writeJson(routesFile, list); }
function readAttractions() { return readJson(attractionsFile, []); }
function writeAttractions(list) { writeJson(attractionsFile, list); }
function readHydrophone() {
  const v = readJson(hydrophoneFile, {});
  return v && typeof v === 'object' ? v : {};
}
function writeHydrophone(obj) { writeJson(hydrophoneFile, obj || {}); }
function readHydroHistory() { return readJson(hydroHistoryFile, []); }
function writeHydroHistory(list) { writeJson(hydroHistoryFile, Array.isArray(list) ? list : []); }

// Basic request stats middleware
app.use((req, res, next) => { incRequest(req.path, req.method); next(); });

// Routes CRUD (file-based)
app.get('/api/routes', (req, res) => {
  const list = readRoutes().sort((a,b)=> (a.createdAt < b.createdAt ? 1 : -1));
  res.json(list);
});

app.post('/api/routes', (req, res) => {
  const { name, coords } = req.body || {};
  if (!name || !Array.isArray(coords) || coords.length === 0) {
    return res.status(400).json({ message: 'Invalid payload' });
  }
  const list = readRoutes();
  const item = { id: Date.now().toString(36), name, coords, createdAt: new Date().toISOString() };
  list.push(item);
  writeRoutes(list);
  logOp('route_create', { id: item.id, name });
  res.status(201).json(item);
});

app.put('/api/routes/:id', (req, res) => {
  const { id } = req.params;
  const list = readRoutes();
  const idx = list.findIndex(x=>x.id===id);
  if (idx === -1) return res.status(404).json({ message: 'Not found' });
  const cur = list[idx];
  const next = { ...cur };
  if (req.body.name !== undefined) next.name = req.body.name;
  if (req.body.coords !== undefined) next.coords = req.body.coords;
  list[idx] = next;
  writeRoutes(list);
  logOp('route_update', { id });
  res.json(next);
});

app.delete('/api/routes/:id', (req, res) => {
  const { id } = req.params;
  const list = readRoutes();
  const next = list.filter(x=>x.id!==id);
  if (next.length === list.length) return res.status(404).json({ message: 'Not found' });
  writeRoutes(next);
  logOp('route_delete', { id });
  res.status(204).end();
});

// POIs CRUD (file-based)
app.get('/api/pois', (req, res) => {
  const list = readPois().sort((a,b)=> a.name.localeCompare(b.name));
  res.json(list);
});

app.post('/api/pois', (req, res) => {
  const { name, lng, lat, address = '', tags = [] } = req.body || {};
  if (!name || typeof lng !== 'number' || typeof lat !== 'number') {
    return res.status(400).json({ message: 'Invalid payload' });
  }
  const list = readPois();
  const item = { id: Date.now().toString(36), name, lng, lat, address, tags };
  list.push(item);
  writePois(list);
  logOp('poi_create', { id: item.id, name });
  res.status(201).json(item);
});

app.put('/api/pois/:id', (req, res) => {
  const { id } = req.params;
  const list = readPois();
  const idx = list.findIndex(x=>x.id===id);
  if (idx === -1) return res.status(404).json({ message: 'Not found' });
  const cur = list[idx];
  const next = { ...cur };
  if (req.body.name !== undefined) next.name = req.body.name;
  if (req.body.lng !== undefined) next.lng = req.body.lng;
  if (req.body.lat !== undefined) next.lat = req.body.lat;
  if (req.body.address !== undefined) next.address = req.body.address;
  if (req.body.tags !== undefined) next.tags = req.body.tags;
  list[idx] = next;
  writePois(list);
  logOp('poi_update', { id });
  res.json(next);
});

app.delete('/api/pois/:id', (req, res) => {
  const { id } = req.params;
  const list = readPois();
  const next = list.filter(x=>x.id!==id);
  if (next.length === list.length) return res.status(404).json({ message: 'Not found' });
  writePois(next);
  logOp('poi_delete', { id });
  res.status(204).end();
});

// Attractions CRUD (file-based) — 景点列表管理
app.get('/api/attractions', (req, res) => {
  const list = readAttractions().sort((a,b)=> a.name.localeCompare(b.name));
  res.json(list);
});

app.post('/api/attractions', (req, res) => {
  const { name, lng, lat, address = '', tags = [], desc = '' } = req.body || {};
  if (!name) return res.status(400).json({ message: 'Invalid payload' });
  const list = readAttractions();
  const item = { id: Date.now().toString(36), name, lng, lat, address, tags, desc };
  list.push(item);
  writeAttractions(list);
  logOp('attraction_create', { id: item.id, name });
  res.status(201).json(item);
});

app.put('/api/attractions/:id', (req, res) => {
  const { id } = req.params;
  const list = readAttractions();
  const idx = list.findIndex(x=>x.id===id);
  if (idx === -1) return res.status(404).json({ message: 'Not found' });
  const cur = list[idx];
  const next = { ...cur };
  ['name','lng','lat','address','tags','desc'].forEach(k=>{ if (req.body[k] !== undefined) next[k] = req.body[k]; });
  list[idx] = next;
  writeAttractions(list);
  logOp('attraction_update', { id });
  res.json(next);
});

app.delete('/api/attractions/:id', (req, res) => {
  const { id } = req.params;
  const list = readAttractions();
  const next = list.filter(x=>x.id!==id);
  if (next.length === list.length) return res.status(404).json({ message: 'Not found' });
  writeAttractions(next);
  logOp('attraction_delete', { id });
  res.status(204).end();
});

// Hydrophone endpoints — 最新水听器数据
app.get('/api/hydrophone/latest', (req, res) => {
  const data = readHydrophone();
  res.json(data);
});

app.post('/api/hydrophone/update', (req, res) => {
  const {
    longitude,
    latitude,
    heading,
    temperature,
    humidity,
    pressure,
    salinity,
    shipDetected,
    shipType,
    timestamp
  } = req.body || {};

  // Basic validation: longitude/latitude required & numeric if provided
  if (typeof longitude !== 'number' || typeof latitude !== 'number') {
    return res.status(400).json({ message: 'Invalid payload: longitude/latitude must be numbers' });
  }

  const payload = {
    longitude,
    latitude,
    heading: typeof heading === 'number' ? heading : null,
    temperature: typeof temperature === 'number' ? temperature : null,
    humidity: typeof humidity === 'number' ? humidity : null,
    pressure: typeof pressure === 'number' ? pressure : null,
    salinity: typeof salinity === 'number' ? salinity : null,
    shipDetected: typeof shipDetected === 'boolean' ? shipDetected : !!shipDetected,
    shipType: shipType || '',
    timestamp: timestamp || new Date().toISOString()
  };

  writeHydrophone(payload);
  logOp('hydrophone_update', { ts: payload.timestamp });
  res.status(201).json({ ok: true });
});

// Hydrophone history CRUD
app.get('/api/hydro/history', (req, res) => {
  const list = readHydroHistory().sort((a,b)=> (a.createdAt < b.createdAt ? 1 : -1));
  res.json(list);
});

app.post('/api/hydro/history', (req, res) => {
  const {
    longitude,
    latitude,
    heading = null,
    temperature = null,
    humidity = null,
    pressure = null,
    salinity = null,
    shipDetected = false,
    shipType = '',
    timestamp = null,
    name = ''
  } = req.body || {};
  if (typeof longitude !== 'number' || typeof latitude !== 'number') {
    return res.status(400).json({ message: 'Invalid payload: longitude/latitude must be numbers' });
  }
  const list = readHydroHistory();
  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
    name: name || '未命名',
    longitude, latitude, heading, temperature, humidity, pressure, salinity,
    shipDetected: !!shipDetected, shipType: shipType || '',
    timestamp: timestamp || new Date().toISOString(),
    createdAt: new Date().toISOString(),
    sentAt: null
  };
  list.push(item);
  writeHydroHistory(list);
  logOp('hydro_history_create', { id: item.id, name: item.name });
  res.status(201).json(item);
});

app.delete('/api/hydro/history/:id', (req, res) => {
  const { id } = req.params;
  const list = readHydroHistory();
  const next = list.filter(x=> x.id !== id);
  if (next.length === list.length) return res.status(404).json({ message: 'Not found' });
  writeHydroHistory(next);
  logOp('hydro_history_delete', { id });
  res.status(204).end();
});

// Send a saved record to current hydrophone
app.post('/api/hydro/history/:id/send', (req, res) => {
  const { id } = req.params;
  const list = readHydroHistory();
  const item = list.find(x=> x.id === id);
  if (!item) return res.status(404).json({ message: 'Not found' });
  const payload = {
    longitude: item.longitude,
    latitude: item.latitude,
    heading: item.heading,
    temperature: item.temperature,
    humidity: item.humidity,
    pressure: item.pressure,
    salinity: item.salinity,
    shipDetected: !!item.shipDetected,
    shipType: item.shipType || '',
    timestamp: new Date().toISOString()
  };
  writeHydrophone(payload);
  // mark sentAt
  item.sentAt = payload.timestamp;
  writeHydroHistory(list);
  logOp('hydro_history_send', { id, ts: payload.timestamp });
  res.json({ ok: true, applied: payload });
});

// Stats and logs
app.get('/api/stats', (req, res) => {
  res.json(readJson(statsFile, {}));
});

app.get('/api/logs', (req, res) => {
  res.json(readJson(logsFile, []));
});

// Fallback to index.html for SPA-like navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(frontDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
