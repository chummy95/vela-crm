const Database = require('better-sqlite3');
const path = require('path');

let db;

function getDB() {
  if (!db) db = new Database(path.join(__dirname, '../vela.db'));
  return db;
}

function initDB() {
  const db = getDB();
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL, name TEXT NOT NULL,
      studio_name TEXT, studio_tagline TEXT, website TEXT, instagram TEXT, location TEXT, currency TEXT DEFAULT 'GBP',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      name TEXT NOT NULL, contact TEXT, email TEXT, location TEXT, industry TEXT, color TEXT DEFAULT '#1B2B4B',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, client_id TEXT NOT NULL,
      service TEXT NOT NULL, value TEXT, stage INTEGER DEFAULT 0,
      start_date TEXT, timeline TEXT, budget TEXT, status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (client_id) REFERENCES clients(id)
    );
    CREATE TABLE IF NOT EXISTS stage_files (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, stage_index INTEGER NOT NULL,
      name TEXT NOT NULL, file_type TEXT, uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
    CREATE TABLE IF NOT EXISTS stage_signoffs (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, stage_index INTEGER NOT NULL,
      signed_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (project_id) REFERENCES projects(id)
    );
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, client_id TEXT NOT NULL, project_id TEXT,
      description TEXT, amount TEXT, due_date TEXT, status TEXT DEFAULT 'unpaid',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (client_id) REFERENCES clients(id)
    );
    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, client_id TEXT, client_name TEXT,
      service TEXT, date TEXT, value TEXT, template TEXT DEFAULT 'A',
      primary_color TEXT DEFAULT '#1B2B4B', accent_color TEXT DEFAULT '#C9A84C',
      intro TEXT, overview TEXT, packages TEXT, deliverables TEXT,
      timeline TEXT, terms TEXT, process TEXT, status TEXT DEFAULT 'draft',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, client_id TEXT, client_name TEXT,
      client_email TEXT, client_address TEXT, service TEXT, value TEXT,
      start_date TEXT, duration TEXT, date TEXT,
      primary_color TEXT DEFAULT '#1B2B4B', accent_color TEXT DEFAULT '#C9A84C',
      clauses TEXT, signed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, client_id TEXT,
      title TEXT NOT NULL, event_type TEXT, date TEXT NOT NULL,
      time TEXT, duration TEXT, meeting_link TEXT, color TEXT DEFAULT '#3B82F6',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS form_fields (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, label TEXT NOT NULL,
      field_type TEXT NOT NULL, required INTEGER DEFAULT 0, options TEXT, sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS form_submissions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, data TEXT NOT NULL,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, client_id TEXT NOT NULL,
      text TEXT NOT NULL, outbound INTEGER DEFAULT 1,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (client_id) REFERENCES clients(id)
    );
  `);
  console.log('Database initialised');
}

module.exports = { getDB, initDB };
