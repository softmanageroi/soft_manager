# Soft Manager

Soft Manager is a browser-based purchasing, warehouse, and inventory application. The frontend is plain HTML, CSS, and JavaScript; an Express server provides login, sessions, and per-user MySQL-backed application storage.

## Features

- Dashboard with purchasing and inventory activity.
- Item, account/vendor, department, warehouse, and employee masters.
- Purchase workflow: Purchase Indent → RFQ → Quotation Receive → Purchase Order → Material Receipt Note (MRN).
- Material requisitions, material issue, and authorization workflows.
- Stock ledger and warehouse stock reports.
- Department and period-based registers, CSV exports, and print layouts.
- JSON backup and restore for browser application data.
- Shared brown-and-beige interface theme.

## Requirements

- Node.js and npm.
- A running MySQL-compatible database.
- A database and `users` table for authentication.

## Setup

1. Install the project dependencies from the project root:

   ```sh
   npm install
   ```

2. Create a database and the user table. The application does not currently include a users-table migration. The table must provide the columns used by `routes/auth.js` and `create-admin.js`:

   ```sql
   CREATE DATABASE soft_manager
     CHARACTER SET utf8mb4
     COLLATE utf8mb4_unicode_ci;

   USE soft_manager;

   CREATE TABLE users (
     id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
     username VARCHAR(191) NOT NULL UNIQUE,
     password_hash VARCHAR(255) NOT NULL,
     full_name VARCHAR(255) NOT NULL,
     role VARCHAR(50) NOT NULL DEFAULT 'user',
     is_active TINYINT(1) NOT NULL DEFAULT 1
   ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

3. Create a `.env` file in the project root. Do not commit this file or put real credentials in source code:

   ```dotenv
   PORT=5001
   SESSION_SECRET=replace-with-a-long-random-secret
   MYSQL_HOST=127.0.0.1
   MYSQL_USER=your_database_user
   MYSQL_PASSWORD=your_database_password
   MYSQL_DATABASE=soft_manager
   ```

   `PORT` is optional and defaults to `5001`. The other values are used by the server and database pool. Restart the server after changing `.env`.

4. Create an administrator interactively:

   ```sh
   node create-admin.js
   ```

   Enter a username and password when prompted. The password is stored as a bcrypt hash. There is no default login.

5. Check the database connection, then start the app:

   ```sh
   node test-db.js
   npm start
   ```

6. Open [http://localhost:5001](http://localhost:5001) or [http://localhost:5001/html/index.html](http://localhost:5001/html/index.html) and sign in with the account you created.

Serve the site through Express rather than opening an HTML file with `file://`; the frontend uses same-origin API requests and session cookies.

## Project layout

| Path | Purpose |
| --- | --- |
| `html/` | Login, dashboard, purchasing, inventory, report, and backup pages |
| `css/` | Shared components, module styles, print styles, and the brown-and-beige theme |
| `js/` | Browser behavior, form handling, reports, storage helpers, and workflow logic |
| `routes/auth.js` | Login, session-check, and logout endpoints |
| `routes/data.js` | Authenticated per-user application data endpoints |
| `server.js` | Express setup, API mounting, static file serving, and HTTP startup |
| `database.js` | MySQL connection pool |
| `create-admin.js` | Interactive administrator creation |
| `test-db.js` | MySQL connection check |
| `.env` | Local database and session configuration; ignored by Git |

### Main pages and scripts

| Page | Main behavior |
| --- | --- |
| `html/index.html` | Login |
| `html/dashboard.html` | Overview and navigation |
| `html/item-master.html` | Item, account, department, warehouse, and employee masters |
| `html/purchase-indent.html` | Create and maintain purchase indents |
| `html/request-for-quotation.html` | Create RFQs from indents |
| `html/quotation-receive.html` | Record quotations and select suppliers |
| `html/purchase-order-creation.html` | Create and manage purchase orders |
| `html/material-receipt-note.html` | Authorize purchase orders and record receipts |
| `html/inventory.html` | Material requisition and issue workflow |
| `html/material-issue-list.html` and `html/material-authorize.html` | Material issue review and authorization |
| `html/stock-ledger.html` | Stock movement and warehouse stock reports |
| `html/registers.html` | Purchase and material registers, CSV export, and focused printing |
| `html/data-backup.html` | Export or restore browser application data |

Related page logic is generally in a same-named file under `js/`; shared behavior lives in files such as `js/ims-store.js`, `js/data-store.js`, `js/voucher-toolbar.js`, and `js/workflow-overview.js`.

## Data and persistence

- Browser forms use the shared `IMS` helpers in `js/ims-store.js` to read and save application records.
- `js/data-store.js` waits for the authenticated session, imports eligible browser records on first use, then synchronizes local-storage changes with the server.
- Business records are stored in MySQL in the `user_app_data` table as key/value records associated with the signed-in user. The server creates this table automatically when it is first needed.
- Application data is isolated by user. Back up browser data before switching accounts; browser-only data that has not synced may not belong to the next account.
- The backup page downloads a JSON file locally. Keep backups private; the file can contain business information.
- Do not edit records directly in browser developer tools while the app is running; use the application forms or a backup/restore.

## API overview

All data endpoints require an authenticated session.

| Method and path | Purpose |
| --- | --- |
| `GET /api` | Backend health response |
| `POST /api/auth/login` | Sign in with a username and password |
| `GET /api/auth/session` | Check the current login |
| `POST /api/auth/logout` | End the current session |
| `GET /api/data` | Read the signed-in user's records; accepts an optional `key` |
| `PUT /api/data?key=...` | Save a string value for a key; request body is `{"value":"..."}` |
| `DELETE /api/data?key=...` | Delete a key |
| `POST /api/data/migrate` | Import eligible browser records during startup |

## Development and testing

- Start the server with `npm start` (equivalent to `node server.js`).
- Run `node test-db.js` to test database connectivity.
- `npm test` is currently a placeholder; no automated project test suite is configured.
- The frontend has no build step. Edit the HTML, CSS, and JavaScript under their respective directories.

## Troubleshooting

- **Login page cannot reach the service:** Start the server and use `http://localhost:5001`, not a `file://` URL.
- **Invalid username or password:** Confirm the user exists, is active, and was created in the configured database. Use `node create-admin.js` to add an administrator.
- **Database configuration or save warning:** Check the `MYSQL_*` values and database availability, then restart the server. The app displays a warning when a server-side data write fails.
- **Application data is missing:** Confirm you signed in as the expected user. Data is stored per user; restore a private backup if needed.
- **Admin creation fails:** Confirm the database and `users` table exist and that the configured MySQL account can create and update user rows.

## Deployment note

The current server configuration is intended for local development. Before exposing it to a network, configure HTTPS, secure session cookies, and a persistent production session store; also use a strong private `SESSION_SECRET` and restrict database access. The GitHub Pages hostname path is frontend-only and does not provide the Express/MySQL authentication or persistence service.
