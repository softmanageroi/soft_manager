# soft_manager

## Requirements

- Node.js 20 or newer
- A running MySQL server

## Configure MySQL with MySQL Workbench

1. Start the local MySQL Server service and open MySQL Workbench.
2. Open your local connection (usually `localhost`, port `3306`). If the connection test fails, start/install the MySQL Server; Workbench by itself is only the client.
3. In Workbench, choose **File → Open SQL Script...** and open `db/schema.sql` from this project.
4. Run the script with the lightning-bolt button. The script creates the `soft_manager` database and its tables. Confirm it appears under **Schemas**; refresh the Schemas list if needed.
5. In a terminal opened at the project folder, run `test -f .env || cp .env.example .env`. Open `.env` and enter the same host, port, MySQL username, and password used for your Workbench connection. If `.env` already exists, edit it instead of overwriting it. Keep `.env` private; it is ignored by Git.

Example local settings:

```dotenv
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_actual_mysql_password
MYSQL_DATABASE=soft_manager
```

Do not paste or commit your real MySQL password into this README or `.env.example`.

Install the app dependencies and create the first account:

```sh
npm install
node server.js --setup
```

Choose a username and password of at least 12 characters. Account credentials are stored in MySQL with a bcrypt password hash.

Start the server:

```sh
npm start
```

Open [http://localhost:3000](http://localhost:3000) on the computer running the app. The server listens only on this computer; do not open HTML files directly with `file://`. Use `Ctrl+C` to stop the server. Sessions expire after eight hours or when the server stops.

## App data storage and migration

On protected pages, the app migrates existing browser `localStorage` records into MySQL the first time that MySQL account has no saved app data. It then hydrates the browser cache from that account's MySQL data and sends later browser storage changes to MySQL. Data is scoped by MySQL user account. A browser owner marker prevents one logged-in account's local cache from being automatically imported into another account.

The app stores its existing voucher, purchase, inventory, and master-data collections in the `user_app_data` table, keyed by the existing browser storage keys. This retains the current screen behavior while moving persistence to MySQL. The `inventory_items`, `inventory_movements`, and purchase-order tables are also available for API-based workflows.

The data API requires an authenticated session:

- `GET /api/data` — read the current user's app data
- `PUT /api/data?key=<storage-key>` — save one string value
- `DELETE /api/data?key=<storage-key>` — remove one value
- `POST /api/data/migrate` — import local data once, only when that user has no stored records

If MySQL is not configured, the app continues in local-only mode and stores data in that browser's `localStorage`; data will not sync between browsers or devices. If MySQL is configured but unavailable, app-data initialization displays an error rather than silently treating browser-only storage as a successful server save.

## Monthly registers

Open **Registers & Monthly Reports** from the dashboard, select a month, and switch between the Material Requisition Register and Purchase Order Register. Use **Print / Save PDF** to print the selected monthly register or save it as a PDF from the browser print dialog. Register rows can open their source voucher.

## Local-only login fallback

If MySQL settings are not present, `node server.js --setup` can still create a local login stored in `.auth/credentials.json`. This fallback protects the pages but does not provide MySQL app-data persistence; configure MySQL before using the app as a database-backed system.
