const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { spawnSync } = require('node:child_process');
const vercelConfig = require('../vercel.json');

process.env.VERCEL = '1';
process.env.APP_USERNAME = 'test-admin';
process.env.APP_PASSWORD = 'test-password-long-enough';
process.env.SESSION_SECRET = 'test-session-signing-secret-that-is-at-least-32-chars';
for (const name of ['MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE', 'MYSQLHOST', 'MYSQLPORT', 'MYSQLUSER', 'MYSQLPASSWORD', 'MYSQLDATABASE']) {
  process.env[name] = '';
}

const vercelHandler = require('../server');

test('unauthenticated New Indent route preserves the requested form after login', async () => {
  const response = {
    headersSent: false,
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = headers;
      this.headersSent = true;
    },
    end(body) {
      this.body = body;
    },
    destroy() {}
  };
  await vercelHandler({
    url: '/api/index?__path=%2Fhtml%2Fpurchase-indent.html%3Fview%3Dnew',
    method: 'GET',
    headers: { host: 'example.test' }
  }, response);

  assert.equal(response.statusCode, 302);
  assert.equal(
    response.headers.Location,
    '/html/index.html?next=%2Fhtml%2Fpurchase-indent.html%3Fview%3Dnew'
  );
});

test('direct API entrypoint requests return health instead of a static-file 404', async () => {
  const response = {
    headersSent: false,
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = headers;
      this.headersSent = true;
    },
    end(body) {
      this.body = body;
    },
    destroy() {}
  };
  await vercelHandler({
    url: '/api/index',
    method: 'GET',
    headers: { host: 'example.test' }
  }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { ok: true });

  const rewrittenResponse = {
    headersSent: false,
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = headers;
      this.headersSent = true;
    },
    end(body) {
      this.body = body;
    },
    destroy() {}
  };
  await vercelHandler({
    url: '/api/index?__path=%2Fapi%2Findex',
    method: 'GET',
    headers: { host: 'example.test' }
  }, rewrittenResponse);
  assert.equal(rewrittenResponse.statusCode, 200);
  assert.deepEqual(JSON.parse(rewrittenResponse.body), { ok: true });
});

test('Vercel serves the public login page and script from the bundled file root', async () => {
  const request = async (path) => {
    const response = {
      headersSent: false,
      writeHead(statusCode, headers = {}) {
        this.statusCode = statusCode;
        this.headers = headers;
        this.headersSent = true;
      },
      end(body) {
        this.body = body;
      },
      destroy() {}
    };
    await vercelHandler({
      url: `/api/index?__path=${encodeURIComponent(path)}`,
      method: 'GET',
      headers: { host: 'example.test' }
    }, response);
    return response;
  };

  const page = await request('/html/index.html');
  assert.equal(page.statusCode, 200);
  assert.match(page.body.toString(), /IMS Login/);

  const script = await request('/js/login.js');
  assert.equal(script.statusCode, 200);
  assert.match(script.body.toString(), /loginForm/);
});

test('Vercel builds and bundles assets with the API function entrypoint', () => {
  assert.equal(vercelConfig.buildCommand, 'npm run build');
  const apiEntry = require('node:fs').readFileSync(require.resolve('../api/index.js'), 'utf8');
  assert.match(apiEntry, /require\('\.\/app-assets\.generated\.json'\)/);
});

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

  const protectedIndent = await request('/html/purchase-indent.html?view=new', {
    redirect: 'manual'
  });
  assert.equal(protectedIndent.status, 302);
  assert.equal(
    protectedIndent.headers.get('location'),
    '/html/index.html?next=%2Fhtml%2Fpurchase-indent.html%3Fview%3Dnew'
  );

  const [name, token] = sessionCookie.split('=');
  const [payload, signature] = token.split('.');
  const tamperedToken = `${payload}.${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`;
  const invalidSession = await request('/api/auth/session', {
    headers: { Cookie: `${name}=${tamperedToken}` }
  });
  assert.equal(invalidSession.status, 401);

  const loginPage = await request('/html/index.html');
  assert.equal(loginPage.status, 200);
  const loginPageHtml = await loginPage.text();
  assert.match(loginPageHtml, /IMS Login/);
  assert.doesNotMatch(loginPageHtml, /<script src="\/js\/data-store\.js"><\/script>/);

  const dashboardPage = await request('/html/dashboard.html', {
    headers: { Cookie: sessionCookie }
  });
  assert.equal(dashboardPage.status, 200);
  assert.match(await dashboardPage.text(), /<script src="\/js\/data-store\.js"><\/script>/);

  const protectedStyles = await request('/html/css/dashboard.css');
  assert.equal(protectedStyles.status, 401);
  const authenticatedStyles = await request('/html/css/dashboard.css', {
    headers: { Cookie: sessionCookie }
  });
  assert.equal(authenticatedStyles.status, 200);

  const loginStyles = await request('/css/index.css');
  assert.equal(loginStyles.status, 200);
  assert.match(loginStyles.headers.get('content-type'), /text\/css/);

  const loginImage = await request('/images/login-background.png');
  assert.equal(loginImage.status, 200);

  const loginScript = await request('/js/login.js');
  assert.equal(loginScript.status, 200);
  assert.match(loginScript.headers.get('content-type'), /javascript/);
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

test('public Vercel routes do not load credentials until login is requested', () => {
  const environment = { ...process.env, VERCEL: '1', DOTENV_CONFIG_PATH: '/nonexistent/.env' };
  for (const name of ['APP_USERNAME', 'APP_PASSWORD', 'SESSION_SECRET', 'MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE', 'MYSQLHOST', 'MYSQLPORT', 'MYSQLUSER', 'MYSQLPASSWORD', 'MYSQLDATABASE']) {
    delete environment[name];
  }
  const script = `
    const handler = require('./server');
    const response = {
      headersSent: false,
      writeHead(statusCode) { this.statusCode = statusCode; this.headersSent = true; },
      end() {},
      destroy() {}
    };
    handler({ url: '/api/index?__path=%2Fhealthz', method: 'GET', headers: { host: 'example.test' } }, response)
      .then(() => setTimeout(() => console.log(response.statusCode, 'alive'), 25));
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: environment
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^200 alive/);
});

test('database failures return an explicit service-unavailable response instead of HTTP 500', () => {
  const environment = {
    ...process.env,
    VERCEL: '1',
    APP_USERNAME: 'test-admin',
    APP_PASSWORD: 'test-password-long-enough',
    SESSION_SECRET: 'test-session-signing-secret-that-is-at-least-32-chars',
    MYSQL_HOST: 'mysql.test',
    MYSQL_USER: 'test-user',
    MYSQL_PASSWORD: 'test-password',
    MYSQL_DATABASE: 'test-database',
    DOTENV_CONFIG_PATH: '/nonexistent/.env'
  };
  const script = `
    const Module = require('node:module');
    const originalLoad = Module._load;
    Module._load = function (request, parent, isMain) {
      if (request === 'mysql2/promise') {
        return { createPool: () => ({ query: async () => {
          const error = new Error('test database is offline');
          error.code = 'ECONNREFUSED';
          throw error;
        } }) };
      }
      return originalLoad.call(this, request, parent, isMain);
    };
    console.error = () => {};
    const { createHmac } = require('node:crypto');
    const handler = require('./server');
    const secret = process.env.SESSION_SECRET;
    const payload = Buffer.from(JSON.stringify({
      username: 'test-admin',
      expiresAt: Date.now() + 60_000
    })).toString('base64url');
    const signature = createHmac('sha256', secret).update(payload).digest('base64url');
    const response = {
      headersSent: false,
      writeHead(statusCode) { this.statusCode = statusCode; this.headersSent = true; },
      end(body) { this.body = body; },
      destroy() {}
    };
    handler({
      url: '/api/index?__path=%2Fapi%2Fdata',
      method: 'GET',
      headers: {
        host: 'example.test',
        cookie: 'soft_manager_session=' + payload + '.' + signature
      }
    }, response).then(() => {
      const body = JSON.parse(response.body);
      console.log(response.statusCode, body.code);
    });
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: environment
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^503 MYSQL_STORAGE_UNAVAILABLE/);
});
