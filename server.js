const { createServer } = require('node:http');
const { promises: fs } = require('node:fs');
const path = require('node:path');
const {
  randomBytes,
  scrypt: scryptCallback,
  timingSafeEqual
} = require('node:crypto');
const { promisify } = require('node:util');
const readline = require('node:readline/promises');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

const scrypt = promisify(scryptCallback);
const ROOT = __dirname;
const AUTH_DIRECTORY = path.join(ROOT, '.auth');
const CREDENTIALS_FILE = path.join(AUTH_DIRECTORY, 'credentials.json');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 10;
const sessions = new Map();
const failedLogins = new Map();

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || null,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || null,
  password: process.env.MYSQL_PASSWORD || null,
  database: process.env.MYSQL_DATABASE || null
};

function hasUsableMysqlConfig() {
  const host = (MYSQL_CONFIG.host || '').trim();
  const user = (MYSQL_CONFIG.user || '').trim();
  const database = (MYSQL_CONFIG.database || '').trim();
  const password = (MYSQL_CONFIG.password || '').trim();
  if (!host || !user || !database) return false;
  if (password === 'your_mysql_password' || password === 'your_mysql_password!' || password === 'changeme') return false;
  return true;
}

const MYSQL_ENABLED = hasUsableMysqlConfig();
let mysqlPool = null;

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function sendJson(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    ...headers
  });
  response.end(JSON.stringify(body));
}

function sessionCookie(token, maxAge) {
  const secure = process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
  return `soft_manager_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}

function getSession(request) {
  const cookie = request.headers.cookie || '';
  const token = cookie.split(';').map((part) => part.trim())
    .find((part) => part.startsWith('soft_manager_session='))
    ?.slice('soft_manager_session='.length);
  if (!token) return null;

  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return { token, ...session };
}

function originIsAllowed(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}

async function readJsonBody(request, maximumSize = 16 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumSize) throw new Error('Request body is too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function getRateLimitKey(request) {
  return request.socket.remoteAddress || 'unknown';
}

function isRateLimited(request) {
  const entry = failedLogins.get(getRateLimitKey(request));
  if (!entry) return false;
  if (entry.resetAt <= Date.now()) {
    failedLogins.delete(getRateLimitKey(request));
    return false;
  }
  return entry.attempts >= MAX_LOGIN_ATTEMPTS;
}

function recordFailedLogin(request) {
  const key = getRateLimitKey(request);
  const now = Date.now();
  const entry = failedLogins.get(key);
  if (!entry || entry.resetAt <= now) {
    failedLogins.set(key, { attempts: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  entry.attempts += 1;
}

function getMysqlPool() {
  if (!MYSQL_ENABLED) return null;
  if (!mysqlPool) {
    mysqlPool = mysql.createPool({
      host: MYSQL_CONFIG.host,
      port: MYSQL_CONFIG.port,
      user: MYSQL_CONFIG.user,
      password: MYSQL_CONFIG.password,
      database: MYSQL_CONFIG.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return mysqlPool;
}

async function ensureDatabaseReady() {
  const pool = getMysqlPool();
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT NOT NULL AUTO_INCREMENT,
      username VARCHAR(128) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_users_username (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  const [userEmailColumns] = await pool.query("SHOW COLUMNS FROM users LIKE 'email'");
  if (userEmailColumns.length) {
    const [emailIndexes] = await pool.query("SHOW INDEX FROM users WHERE Key_name = 'uniq_users_email'");
    if (emailIndexes.length) await pool.query('ALTER TABLE users DROP INDEX uniq_users_email');
    await pool.query('ALTER TABLE users DROP COLUMN email');
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_items (
      id INT NOT NULL AUTO_INCREMENT,
      user_id INT NOT NULL,
      item_code VARCHAR(64) NOT NULL,
      item_name VARCHAR(200) NOT NULL,
      category VARCHAR(100) NULL,
      uom VARCHAR(50) NULL,
      quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
      unit_price DECIMAL(18,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_user_item_code (user_id, item_code),
      CONSTRAINT fk_inventory_items_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  const [inventoryUserColumns] = await pool.query("SHOW COLUMNS FROM inventory_items LIKE 'user_id'");
  let inventoryUserColumn = inventoryUserColumns[0] || null;
  if (!inventoryUserColumn) {
    await pool.query('ALTER TABLE inventory_items ADD COLUMN user_id INT NULL');
    const [newColumns] = await pool.query("SHOW COLUMNS FROM inventory_items LIKE 'user_id'");
    inventoryUserColumn = newColumns[0];
  }
  const [users] = await pool.query('SELECT id FROM users ORDER BY id LIMIT 1');
  if (users.length) {
    await pool.query('UPDATE inventory_items SET user_id = ? WHERE user_id IS NULL', [users[0].id]);
    const [indexes] = await pool.query("SHOW INDEX FROM inventory_items WHERE Key_name = 'uniq_item_code'");
    if (indexes.length) await pool.query('ALTER TABLE inventory_items DROP INDEX uniq_item_code');
    const [userIndexes] = await pool.query("SHOW INDEX FROM inventory_items WHERE Key_name = 'uniq_user_item_code'");
    if (!userIndexes.length) {
      await pool.query('ALTER TABLE inventory_items ADD UNIQUE KEY uniq_user_item_code (user_id, item_code)');
    }
    if (inventoryUserColumn.Null === 'YES') {
      await pool.query('ALTER TABLE inventory_items MODIFY user_id INT NOT NULL');
    }
    const [foreignKeys] = await pool.query(
      "SELECT CONSTRAINT_NAME FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_items' AND CONSTRAINT_NAME = 'fk_inventory_items_user'"
    );
    if (!foreignKeys.length) {
      await pool.query(
        'ALTER TABLE inventory_items ADD CONSTRAINT fk_inventory_items_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE'
      );
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id INT NOT NULL AUTO_INCREMENT,
      item_id INT NOT NULL,
      movement_type ENUM('IN', 'OUT', 'ADJUST') NOT NULL,
      quantity DECIMAL(12,3) NOT NULL,
      remarks TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_inventory_movements_item_id (item_id),
      CONSTRAINT fk_inventory_movements_item FOREIGN KEY (item_id) REFERENCES inventory_items (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_app_data (
      user_id INT NOT NULL,
      storage_key VARCHAR(191) NOT NULL,
      value_text LONGTEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, storage_key),
      CONSTRAINT fk_user_app_data_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function handleAppData(request, response, session, requestUrl) {
  if (!session) {
    sendJson(response, 401, { error: 'Authentication required.' });
    return;
  }
  if (!MYSQL_ENABLED) {
    sendJson(response, 503, { error: 'MySQL storage is not configured. Set MYSQL_* values in .env and restart the server.' });
    return;
  }
  if (!originIsAllowed(request)) {
    sendJson(response, 403, { error: 'Request origin is not allowed.' });
    return;
  }

  await ensureDatabaseReady();
  const pool = getMysqlPool();
  if (requestUrl.pathname === '/api/data/migrate' && request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed.' }, { Allow: 'POST' });
    return;
  }
  if (request.method === 'GET' && requestUrl.pathname === '/api/data') {
    const [rows] = await pool.query(
      'SELECT storage_key, value_text FROM user_app_data WHERE user_id = (SELECT id FROM users WHERE username = ? LIMIT 1)',
      [session.username]
    );
    const records = Object.fromEntries(rows.map((row) => [row.storage_key, row.value_text]));
    sendJson(response, 200, { records });
    return;
  }

  if (requestUrl.pathname !== '/api/data' && requestUrl.pathname !== '/api/data/migrate') {
    sendJson(response, 404, { error: 'Not found.' });
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/data/migrate') {
    let body;
    try {
      body = await readJsonBody(request, 2 * 1024 * 1024);
    } catch {
      sendJson(response, 400, { error: 'Could not read local data for migration.' });
      return;
    }
    const source = body?.records;
    const entries = source && typeof source === 'object' && !Array.isArray(source)
      ? Object.entries(source)
      : null;
    if (!entries || entries.length > 2000
        || entries.some(([key, value]) => !key || key.length > 191 || typeof value !== 'string')
        || entries.reduce((size, [key, value]) => size + Buffer.byteLength(key) + Buffer.byteLength(value), 0) > 2 * 1024 * 1024) {
      sendJson(response, 400, { error: 'Local data payload is invalid or too large to migrate.' });
      return;
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [users] = await connection.query(
        'SELECT id FROM users WHERE username = ? LIMIT 1 FOR UPDATE',
        [session.username]
      );
      if (!users.length) throw new Error('Authenticated MySQL user was not found.');
      const userId = users[0].id;
      const [existing] = await connection.query(
        'SELECT COUNT(*) AS record_count FROM user_app_data WHERE user_id = ?',
        [userId]
      );
      if (Number(existing[0].record_count) === 0) {
        for (const [key, value] of entries) {
          await connection.query(
            'INSERT INTO user_app_data (user_id, storage_key, value_text) VALUES (?, ?, ?)',
            [userId, key, value]
          );
        }
      }
      const [rows] = await connection.query(
        'SELECT storage_key, value_text FROM user_app_data WHERE user_id = ?',
        [userId]
      );
      await connection.commit();
      sendJson(response, 200, {
        imported: Number(existing[0].record_count) === 0 && entries.length > 0,
        records: Object.fromEntries(rows.map((row) => [row.storage_key, row.value_text]))
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return;
  }

  if (!['GET', 'PUT', 'DELETE'].includes(request.method)) {
    sendJson(response, 405, { error: 'Method not allowed.' }, { Allow: 'GET, PUT, DELETE' });
    return;
  }
  const key = requestUrl.searchParams.get('key');
  if (!key || key.length > 191) {
    sendJson(response, 400, { error: 'A valid storage key is required.' });
    return;
  }
  const [users] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [session.username]);
  if (!users.length) {
    sendJson(response, 401, { error: 'Authenticated MySQL user was not found.' });
    return;
  }

  if (request.method === 'GET') {
    const [rows] = await pool.query(
      'SELECT value_text FROM user_app_data WHERE user_id = ? AND storage_key = ? LIMIT 1',
      [users[0].id, key]
    );
    sendJson(response, 200, { value: rows[0]?.value_text ?? null });
    return;
  }

  if (request.method === 'PUT') {
    let body;
    try {
      body = await readJsonBody(request, 2 * 1024 * 1024);
    } catch {
      sendJson(response, 400, { error: 'Could not read the storage value.' });
      return;
    }
    if (typeof body?.value !== 'string' || Buffer.byteLength(body.value) > 2 * 1024 * 1024) {
      sendJson(response, 400, { error: 'Storage values must be strings smaller than 2 MB.' });
      return;
    }
    await pool.query(
      'INSERT INTO user_app_data (user_id, storage_key, value_text) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value_text = VALUES(value_text)',
      [users[0].id, key, body.value]
    );
    sendJson(response, 200, { ok: true });
    return;
  }
  if (request.method === 'DELETE') {
    await pool.query('DELETE FROM user_app_data WHERE user_id = ? AND storage_key = ?', [users[0].id, key]);
    sendJson(response, 200, { ok: true });
    return;
  }
  sendJson(response, 405, { error: 'Method not allowed.' }, { Allow: 'GET, POST, PUT, DELETE' });
}

async function getDatabaseUserByUsername(username) {
  const pool = getMysqlPool();
  if (!pool) return null;
  const [rows] = await pool.query('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
  return rows[0] || null;
}

async function saveDatabaseUser(username, passwordHash) {
  const pool = getMysqlPool();
  if (!pool) return;
  const [existing] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
  if (existing.length) {
    throw new Error(`A MySQL account named "${username}" already exists.`);
  }
  await pool.query('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, passwordHash]);
}

async function readDatabaseCredentials() {
  await ensureDatabaseReady();
  const pool = getMysqlPool();
  if (!pool) return null;
  const [rows] = await pool.query('SELECT username, password_hash FROM users ORDER BY id LIMIT 1');
  if (!rows.length) {
    throw new Error('No MySQL login is configured. Run "node server.js --setup" to create an account.');
  }
  const user = rows[0];
  return {
    username: user.username,
    source: 'mysql',
    passwordHash: user.password_hash,
    mysqlId: user.id
  };
}

async function login(request, response, credentials) {
  if (!originIsAllowed(request)) {
    sendJson(response, 403, { error: 'Request origin is not allowed.' });
    return;
  }
  if (isRateLimited(request)) {
    sendJson(response, 429, { error: 'Too many login attempts. Try again in 15 minutes.' });
    return;
  }

  let body;
  try {
    body = await readJsonBody(request);
  } catch {
    sendJson(response, 400, { error: 'Please submit a valid login request.' });
    return;
  }

  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (credentials.source === 'mysql') {
    const user = await getDatabaseUserByUsername(username);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      recordFailedLogin(request);
      sendJson(response, 401, { error: 'Incorrect username or password.' });
      return;
    }
    failedLogins.delete(getRateLimitKey(request));
    const token = randomBytes(32).toString('base64url');
    sessions.set(token, {
      username: user.username,
      expiresAt: Date.now() + SESSION_DURATION_MS
    });
    sendJson(response, 200, { username: user.username }, {
      'Set-Cookie': sessionCookie(token, SESSION_DURATION_MS / 1000)
    });
    return;
  }

  const usernameMatches = safeEqual(username, credentials.username);
  const passwordHash = await scrypt(password, credentials.salt, 64);
  const passwordMatches = safeEqual(passwordHash, credentials.passwordHash);
  if (!usernameMatches || !passwordMatches) {
    recordFailedLogin(request);
    sendJson(response, 401, { error: 'Incorrect username or password.' });
    return;
  }

  failedLogins.delete(getRateLimitKey(request));
  const token = randomBytes(32).toString('base64url');
  sessions.set(token, {
    username: credentials.username,
    expiresAt: Date.now() + SESSION_DURATION_MS
  });
  sendJson(response, 200, { username: credentials.username }, {
    'Set-Cookie': sessionCookie(token, SESSION_DURATION_MS / 1000)
  });
}

async function logout(request, response) {
  if (!originIsAllowed(request)) {
    sendJson(response, 403, { error: 'Request origin is not allowed.' });
    return;
  }
  const session = getSession(request);
  if (session) sessions.delete(session.token);
  sendJson(response, 200, { ok: true }, {
    'Set-Cookie': sessionCookie('', 0)
  });
}

function redirect(response, location) {
  response.writeHead(302, { Location: location, 'Cache-Control': 'no-store' });
  response.end();
}

function isLoginAsset(pathname) {
  return [
    '/css/index.css',
    '/css/skeuomorphic.css',
    '/images/background.jpg.png',
    '/images/login-wallpaper.png',
    '/js/login.js'
  ].includes(pathname);
}

async function listInventoryItems(request, response, username) {
  if (!MYSQL_ENABLED) {
    sendJson(response, 503, { error: 'Inventory API is unavailable until MySQL is configured.' });
    return;
  }
  await ensureDatabaseReady();
  const pool = getMysqlPool();
  const [rows] = await pool.query(
    'SELECT * FROM inventory_items WHERE user_id = (SELECT id FROM users WHERE username = ? LIMIT 1) ORDER BY item_name ASC',
    [username]
  );
  sendJson(response, 200, { items: rows });
}

async function createInventoryItem(request, response, username) {
  if (!MYSQL_ENABLED) {
    sendJson(response, 503, { error: 'Inventory API is unavailable until MySQL is configured.' });
    return;
  }
  await ensureDatabaseReady();
  let body;
  try {
    body = await readJsonBody(request);
  } catch {
    sendJson(response, 400, { error: 'Please submit a valid item payload.' });
    return;
  }
  const itemCode = typeof body?.itemCode === 'string' ? body.itemCode.trim() : '';
  const itemName = typeof body?.itemName === 'string' ? body.itemName.trim() : '';
  const quantity = Number(body?.quantity ?? 0);
  const unitPrice = Number(body?.unitPrice ?? 0);
  if (!itemCode || itemCode.length > 64 || !itemName || itemName.length > 200
      || !Number.isFinite(quantity) || quantity < 0
      || !Number.isFinite(unitPrice) || unitPrice < 0
      || (typeof body?.category === 'string' && body.category.length > 100)
      || (typeof body?.uom === 'string' && body.uom.length > 50)) {
    sendJson(response, 400, { error: 'Provide valid item details, quantity, and unit price.' });
    return;
  }
  const [result] = await getMysqlPool().query(
    'INSERT INTO inventory_items (user_id, item_code, item_name, category, uom, quantity, unit_price) VALUES ((SELECT id FROM users WHERE username = ? LIMIT 1), ?, ?, ?, ?, ?, ?)',
    [
      username,
      itemCode,
      itemName,
      typeof body?.category === 'string' ? body.category : null,
      typeof body?.uom === 'string' ? body.uom : null,
      quantity,
      unitPrice
    ]
  );
  sendJson(response, 201, { id: result.insertId, itemCode, itemName });
}

async function serveFile(request, response, pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    sendJson(response, 400, { error: 'Invalid URL path.' });
    return;
  }

  const resolvedPath = path.resolve(ROOT, `.${decodedPath}`);
  if (!resolvedPath.startsWith(`${ROOT}${path.sep}`)) {
    sendJson(response, 404, { error: 'Not found.' });
    return;
  }

  const allowedDirectory = ['css', 'html', 'images', 'js']
    .some((directory) => resolvedPath.startsWith(path.join(ROOT, directory) + path.sep));
  const extension = path.extname(resolvedPath).toLowerCase();
  if (!allowedDirectory || !MIME_TYPES[extension] || path.basename(resolvedPath).startsWith('.')) {
    sendJson(response, 404, { error: 'Not found.' });
    return;
  }

  try {
    const realPath = await fs.realpath(resolvedPath);
    if (!realPath.startsWith(`${ROOT}${path.sep}`)) {
      sendJson(response, 404, { error: 'Not found.' });
      return;
    }
    let file = await fs.readFile(realPath);
    if (extension === '.html' && pathname.startsWith('/html/') && pathname !== '/html/index.html') {
      const html = file.toString('utf8');
      file = Buffer.from(html.replace(/<\/head>/i, '<script src="/js/data-store.js"></script></head>'));
    }
    response.writeHead(200, {
      'Cache-Control': extension === '.html' ? 'no-store' : 'private, max-age=300',
      'Content-Length': file.length,
      'Content-Type': MIME_TYPES[extension],
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin'
    });
    response.end(request.method === 'HEAD' ? undefined : file);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') {
      sendJson(response, 404, { error: 'Not found.' });
      return;
    }
    console.error('Could not read requested app file.', error);
    sendJson(response, 500, { error: 'Could not load the requested page.' });
  }
}

async function readCredentials() {
  if (MYSQL_ENABLED) {
    try {
      const credentials = await readDatabaseCredentials();
      return credentials;
    } catch (error) {
      console.warn('MySQL auth is configured but unavailable; falling back to the local credentials file.', error.message);
    }
  }

  let contents;
  try {
    contents = await fs.readFile(CREDENTIALS_FILE, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('No login is configured. Run "node server.js --setup" to create an account.');
    }
    throw error;
  }
  const credentials = JSON.parse(contents);
  if (![1, 2].includes(credentials.version)
      || typeof credentials.username !== 'string'
      || typeof credentials.salt !== 'string'
      || typeof credentials.passwordHash !== 'string'
      || !/^[\da-f]{32}$/i.test(credentials.salt)
      || !/^[\da-f]{128}$/i.test(credentials.passwordHash)) {
    throw new Error('The saved login configuration is invalid. Run "node server.js --setup" to replace it.');
  }
  return {
    username: credentials.username,
    salt: Buffer.from(credentials.salt, 'hex'),
    passwordHash: Buffer.from(credentials.passwordHash, 'hex'),
    source: 'file'
  };
}

async function handleRequest(request, response, credentials) {
  const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const pathname = requestUrl.pathname;
  const session = getSession(request);

  if (pathname === '/healthz') {
    sendJson(response, 200, { ok: true });
    return;
  }
  if (pathname === '/api/auth/login') {
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'Method not allowed.' }, { Allow: 'POST' });
      return;
    }
    await login(request, response, credentials);
    return;
  }
  if (pathname === '/api/auth/logout') {
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'Method not allowed.' }, { Allow: 'POST' });
      return;
    }
    await logout(request, response);
    return;
  }
  if (pathname === '/api/auth/session') {
    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'Method not allowed.' }, { Allow: 'GET' });
      return;
    }
    if (!session) {
      sendJson(response, 401, { error: 'Authentication required.' });
      return;
    }
    sendJson(response, 200, { username: session.username });
    return;
  }
  if (pathname === '/api/data' || pathname === '/api/data/migrate') {
    await handleAppData(request, response, session, requestUrl);
    return;
  }
  if (pathname === '/api/items') {
    if (!session) {
      sendJson(response, 401, { error: 'Authentication required.' });
      return;
    }
    if (request.method === 'GET') {
      await listInventoryItems(request, response, session.username);
      return;
    }
    if (request.method === 'POST') {
      await createInventoryItem(request, response, session.username);
      return;
    }
    sendJson(response, 405, { error: 'Method not allowed.' }, { Allow: 'GET, POST' });
    return;
  }
  if (pathname === '/api/inventory') {
    if (!session) {
      sendJson(response, 401, { error: 'Authentication required.' });
      return;
    }
    if (request.method === 'GET') {
      await listInventoryItems(request, response, session.username);
      return;
    }
    if (request.method === 'POST') {
      await createInventoryItem(request, response, session.username);
      return;
    }
    sendJson(response, 405, { error: 'Method not allowed.' }, { Allow: 'GET, POST' });
    return;
  }
  if (!['GET', 'HEAD'].includes(request.method)) {
    sendJson(response, 405, { error: 'Method not allowed.' }, { Allow: 'GET, HEAD' });
    return;
  }

  if (pathname === '/' || pathname === '/index.html') {
    redirect(response, session ? '/html/dashboard.html' : '/html/index.html');
    return;
  }
  if (pathname === '/html/index.html' && session) {
    redirect(response, '/html/dashboard.html');
    return;
  }

  const isProtectedPage = pathname.startsWith('/html/') && pathname.endsWith('.html')
    && pathname !== '/html/index.html';
  const isProtectedAsset = ['/css/', '/images/', '/js/'].some((prefix) => pathname.startsWith(prefix))
    && !isLoginAsset(pathname);
  if ((isProtectedPage || isProtectedAsset) && !session) {
    if (isProtectedPage) redirect(response, '/html/index.html');
    else sendJson(response, 401, { error: 'Authentication required.' });
    return;
  }

  await serveFile(request, response, pathname);
}

function promptHidden(promptText) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
      reject(new Error('Password setup requires an interactive terminal.'));
      return;
    }

    let value = '';
    const onData = (chunk) => {
      for (const input of chunk.toString('utf8')) {
        if (input === '\u0003') {
          cleanup();
          reject(new Error('Password setup cancelled.'));
          return;
        }
        if (input === '\r' || input === '\n') {
          cleanup();
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (input === '\u007f' || input === '\b') {
          if (value) {
            value = [...value].slice(0, -1).join('');
            process.stdout.write('\b \b');
          }
          continue;
        }
        if (input >= ' ' && input !== '\u007f') {
          value += input;
          process.stdout.write('*');
        }
      }
    };
    const cleanup = () => {
      process.stdin.removeListener('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };

    process.stdin.setEncoding('utf8');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
    process.stdout.write(promptText);
  });
}

async function saveCredentials(credentials) {
  await fs.mkdir(AUTH_DIRECTORY, { recursive: true, mode: 0o700 });
  const temporaryFile = path.join(AUTH_DIRECTORY, `credentials-${randomBytes(8).toString('hex')}.tmp`);
  await fs.writeFile(temporaryFile, JSON.stringify(credentials, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
    flag: 'wx'
  });
  await fs.rename(temporaryFile, CREDENTIALS_FILE);
  await fs.chmod(AUTH_DIRECTORY, 0o700);
  await fs.chmod(CREDENTIALS_FILE, 0o600);
}

async function setupCredentials() {
  const pool = getMysqlPool();
  if (pool && MYSQL_ENABLED) {
    await ensureDatabaseReady();
    const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      const username = (await terminal.question('Choose a username: ')).trim();
      terminal.close();
      if (!username || username.length > 128) {
        throw new Error('Username must be between 1 and 128 characters.');
      }
      const password = await promptHidden('Choose a password (minimum 12 characters): ');
      const confirmation = await promptHidden('Confirm password: ');
      if (password.length < 12) throw new Error('Password must be at least 12 characters.');
      if (password !== confirmation) throw new Error('Passwords do not match.');
      const passwordHash = await bcrypt.hash(password, 12);
      await saveDatabaseUser(username, passwordHash);
      console.log(`MySQL login configured for "${username}".`);
    } finally {
      terminal.close();
    }
    return;
  }

  try {
    await fs.access(CREDENTIALS_FILE);
    throw new Error('A login is already configured.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const username = (await terminal.question('Choose a username: ')).trim();
    terminal.close();
    if (!username || username.length > 128) {
      throw new Error('Username must be between 1 and 128 characters.');
    }
    const password = await promptHidden('Choose a password (minimum 12 characters): ');
    const confirmation = await promptHidden('Confirm password: ');
    if (password.length < 12) throw new Error('Password must be at least 12 characters.');
    if (password !== confirmation) throw new Error('Passwords do not match.');

    const salt = randomBytes(16);
    const passwordHash = await scrypt(password, salt, 64);
    await saveCredentials({
      version: 1,
      username,
      salt: salt.toString('hex'),
      passwordHash: passwordHash.toString('hex')
    });
    console.log(`Login configured for "${username}". Start the app with "node server.js".`);
  } finally {
    terminal.close();
  }
}

async function startServer() {
  const credentials = await readCredentials();
  const server = createServer((request, response) => {
    handleRequest(request, response, credentials).catch((error) => {
      console.error('Request could not be completed.', error);
      if (!response.headersSent) sendJson(response, 500, { error: 'The request could not be completed.' });
      else response.destroy();
    });
  });

  server.listen(PORT, HOST, () => {
    const address = server.address();
    console.log(`Soft Manager running at http://${HOST}:${address.port}`);
    console.log('Press Ctrl+C to stop the server.');
  });
}

const command = process.argv[2];
if (command === '--setup') {
  setupCredentials()
    .then(() => process.stdin.unref())
    .catch((error) => {
      console.error(error.message);
      process.stdin.unref();
      process.exitCode = 1;
    });
} else if (command) {
  console.error('Usage: node server.js [--setup]');
  process.exitCode = 1;
} else {
  startServer().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
