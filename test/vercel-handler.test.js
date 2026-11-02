const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { spawnSync } = require('node:child_process');

process.env.VERCEL = '1';
process.env.APP_USERNAME = 'test-admin';
process.env.APP_PASSWORD = 'test-password-long-enough';
process.env.SESSION_SECRET = 'test-session-signing-secret-that-is-at-least-32-chars';
for (const name of ['MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE', 'MYSQLHOST', 'MYSQLPORT', 'MYSQLUSER', 'MYSQLPASSWORD', 'MYSQLDATABASE']) {
  process.env[name] = '';
}

const vercelHandler = require('../server');

test('Vercel handler routes requests and signs sessions across requests', async (context) => {
  const server = createServer(vercelHandler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}/api/index?__path=`;
  const request = (pathname, options = {}) => fetch(`${baseUrl}${encodeURIComponent(pathname)}`, options);

  const loginResponse = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'test-admin', password: 'test-password-long-enough' })
  });
  assert.equal(loginResponse.status, 200);
  const cookie = loginResponse.headers.get('set-cookie');
  assert.match(cookie, /; Secure/);
  assert.match(cookie, /; HttpOnly/);

  const sessionCookie = cookie.split(';', 1)[0];
  const sessionResponse = await request('/api/auth/session', {
    headers: { Cookie: sessionCookie }
  });
  assert.equal(sessionResponse.status, 200);
  assert.deepEqual(await sessionResponse.json(), { username: 'test-admin' });

  const landingResponse = await request('/', {
    headers: { Cookie: sessionCookie },
    redirect: 'manual'
  });
  assert.equal(landingResponse.status, 302);
  assert.equal(landingResponse.headers.get('location'), '/html/dashboard.html');

  const [name, token] = sessionCookie.split('=');
  const [payload, signature] = token.split('.');
  const tamperedToken = `${payload}.${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`;
  const invalidSession = await request('/api/auth/session', {
    headers: { Cookie: `${name}=${tamperedToken}` }
  });
  assert.equal(invalidSession.status, 401);
});

test('public Vercel routes work without credentials and login fails explicitly without writing locally', () => {
  const environment = { ...process.env, VERCEL: '1', DOTENV_CONFIG_PATH: '/nonexistent/.env' };
  for (const name of ['APP_USERNAME', 'APP_PASSWORD', 'SESSION_SECRET', 'MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE', 'MYSQLHOST', 'MYSQLPORT', 'MYSQLUSER', 'MYSQLPASSWORD', 'MYSQLDATABASE']) {
    delete environment[name];
  }

  const script = `
    const fs = require('node:fs');
    let mkdirCalls = 0;
    fs.promises.mkdir = async () => { mkdirCalls += 1; };
    console.error = () => {};
    const vercelHandler = require('./server');
    async function run(url, method = 'GET') {
      const currentResponse = {
        headersSent: false,
        writeHead(statusCode, headers = {}) { this.statusCode = statusCode; this.headers = headers; },
        end(body) { this.body = body; },
        destroy() {}
      };
      await vercelHandler({ url, method, headers: { host: 'example.test' } }, currentResponse);
      return currentResponse;
    }
    Promise.all([
      run('/api/index?__path=%2Fhealthz'),
      run('/api/index?__path=%2F'),
      run('/api/index?__path=%2Fapi%2Fauth%2Flogin', 'POST')
    ]).then(([health, home, login]) => {
      const body = JSON.parse(login.body);
      console.log(health.statusCode, home.statusCode, login.statusCode, mkdirCalls, body.error);
    });
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: environment
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^200 302 500 0 Vercel requires APP_USERNAME and APP_PASSWORD/);
});
