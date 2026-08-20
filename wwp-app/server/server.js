#!/usr/bin/env node
/*
 * WWP Board server — the shared backend the front end auto-upgrades to.
 *
 *   node server.js            (port 8787, or PORT env)
 *
 * Zero dependencies beyond Express. Storage is a JSON file written
 * atomically — right-sized for a crew-scale prototype and trivially
 * swappable for a real database on the production host.
 *
 * Access codes live in config.json (copy config.example.json). Each
 * organization gets a code; the admin code edits everything. The server
 * — not the browser — enforces that an organization can only write its
 * own rows, and stamps who/when on every write.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA, 'db.json');
const CONF_FILE = path.join(ROOT, 'config.json');

if (!fs.existsSync(CONF_FILE)) {
  console.error('No config.json — copy config.example.json and set your codes.');
  process.exit(1);
}
const CONF = JSON.parse(fs.readFileSync(CONF_FILE, 'utf8'));
fs.mkdirSync(DATA, { recursive: true });

let db = fs.existsSync(DB_FILE)
  ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
  : { version: 1, weeks: {}, tokens: {} };
function flush() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(ROOT, '..', 'web')));

function auth(req) {
  const t = req.get('X-Token');
  return (t && db.tokens[t]) || null;
}

app.get('/api/ping', (_q, r) => r.json({ ok: true }));

app.post('/api/login', (req, res) => {
  const { name, code } = req.body || {};
  if (!name || !code) return res.status(400).json({ error: 'name and code required' });
  let user = null;
  if (code === CONF.adminCode) user = { name, role: 'admin', org: null };
  else {
    const org = Object.keys(CONF.orgCodes || {}).find(o => CONF.orgCodes[o] === code);
    if (org) user = { name, role: 'org', org };
  }
  if (!user) return res.status(401).json({ error: 'unknown access code' });
  const token = crypto.randomBytes(24).toString('hex');
  db.tokens[token] = { ...user, at: new Date().toISOString() };
  flush();
  res.json({ token, user });
});

app.get('/api/me', (req, res) => {
  const u = auth(req);
  if (!u) return res.status(401).json({ error: 'not signed in' });
  res.json(u);
});

app.get('/api/week/:monday', (req, res) => {
  res.json({ version: db.version, activities: db.weeks[req.params.monday] || [] });
});

app.post('/api/activity', (req, res) => {
  const u = auth(req);
  if (!u) return res.status(401).json({ error: 'sign in to edit' });
  const a = req.body;
  if (!a || !a.id || !a.week || !a.desc) return res.status(400).json({ error: 'bad activity' });
  const list = (db.weeks[a.week] = db.weeks[a.week] || []);
  const i = list.findIndex(x => x.id === a.id);
  const existing = i >= 0 ? list[i] : null;
  if (u.role !== 'admin') {
    if (existing && existing.org !== u.org)
      return res.status(403).json({ error: 'your organization cannot edit this row' });
    if (a.org !== u.org)
      return res.status(403).json({ error: 'you can only file work under ' + u.org });
  }
  const stamp = { by: u.name + (u.org ? ' (' + u.org + ')' : ' (Admin)'), at: new Date().toISOString() };
  if (existing) { a.created = existing.created; a.updated = stamp; list[i] = a; }
  else { a.created = stamp; a.updated = null; list.push(a); }
  db.version++; flush();
  res.json(a);
});

app.delete('/api/activity/:id', (req, res) => {
  const u = auth(req);
  if (!u) return res.status(401).json({ error: 'sign in to edit' });
  const w = req.query.week;
  const list = db.weeks[w] || [];
  const a = list.find(x => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: 'not found' });
  if (u.role !== 'admin' && a.org !== u.org)
    return res.status(403).json({ error: 'your organization cannot delete this row' });
  db.weeks[w] = list.filter(x => x.id !== req.params.id);
  db.version++; flush();
  res.json({ ok: true });
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => console.log('WWP Board on http://localhost:' + PORT));
