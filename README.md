# soft_manager

## Requirements

- Node.js 20 or newer
- A running MySQL server
- PHP 8.0 or newer (for the optional XAMPP-style app under `htdocs/`)

## Project structure

```text
soft_manager/
├── api/
│   └── index.js
├── html/
│   ├── css/
│   ├── images/
│   └── standalone/
├── js/
├── server/
│   ├── db/schema.sql
│   ├── server.js
│   └── supabase-connection.js
├── vercel.json
└── package.json
```

The `htdocs/` directory also contains a standalone PHP/MySQL entry point with
`index.php`, `login.php`, `dashboard.php`, shared includes, and the Products,
Purchase, Stock, Material Issue, Material Receive, and Stock Ledger modules.
It uses the same `users` and `user_app_data` MySQL tables as the Node app.

```text
htdocs/
├── index.php
├── login.php
├── dashboard.php
├── config/database.php
├── css/{style.css,dashboard.css}
├── js/app.js
├── modules/{products,purchase,stock,material-issue,material-receive,stock-ledger}.php
└── includes/{bootstrap,functions,header,sidebar,footer,error}.php
```

### Run the PHP version with XAMPP

1. Start Apache and MySQL in XAMPP, then run `db/schema.sql` in MySQL if the
   `soft_manager` database or its tables have not been created.
2. Set `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, and
   `MYSQL_DATABASE` in a `.env` file beside the deployed PHP app. When running
   directly from this repository, the PHP app also reads the project-root
   `.env`. Keep the file private.
3. Copy the contents of `htdocs/` into a folder under XAMPP's `htdocs`, or set
   the Apache document root to this project's `htdocs/` directory.
4. If the `users` table has no account, use the existing MySQL setup flow
   (`npm install`, then `npm run setup`) to create one.
5. Open `http://localhost/<folder>/` (or `http://localhost/` if `htdocs/` is
   the document root) and sign in with that account. PHP pages do not use the
   Node-only local fallback login.

The PHP screens are a separate entry point; the existing Node app and its
original HTML pages are left in place. The PHP modules currently cover the
basic workflows listed above and read/write the same account-scoped JSON
collections used by the existing app. The PHP Products page accepts stock CSV
imports and assigns opening stock to Umbrella Facility Management Services Pvt
Ltd; export `.xlsx` files as CSV before importing them in the PHP version.

The HTML pages, stylesheets, and images are grouped under `html/`. Static asset
URLs used by existing pages continue to work through the server.

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
npm run setup
```

Choose a username and password of at least 12 characters. Account credentials are stored in MySQL with a bcrypt password hash.

Start the server:

```sh
npm start
```

Open [http://localhost:3000](http://localhost:3000) on the computer running the app. The server listens only on this computer; do not open HTML files directly with `file://`. Use `Ctrl+C` to stop the server. Sessions expire after eight hours or when the server stops.

## Deploying to Vercel

The Vercel function routes requests through the app's authentication and static-file handler. In the Vercel project settings, configure `APP_USERNAME` and `APP_PASSWORD` (at least 12 characters) for the Production environment. If using MySQL-backed accounts instead, configure the `MYSQL_*` connection values and set `SESSION_SECRET` to a random secret of at least 32 characters. `APP_PASSWORD` is used to sign sessions when `SESSION_SECRET` is not set. MySQL must be reachable from Vercel; a local `localhost` database will not work. After changing environment variables, redeploy the latest Production deployment for them to take effect.

The API function packages the `css/`, `html/`, `js/`, and ExcelJS distribution files so it can serve the app's static pages and assets from Vercel's read-only filesystem.

Vercel's filesystem is read-only, so the app does not create local `.auth` credentials there. Configure one of the authentication options above before deploying. Without valid configuration, requests return an explicit configuration error rather than attempting to write under `.auth`. Session cookies are signed and expire after eight hours so they work across serverless function instances.

## App data storage and migration

On protected pages, the app migrates existing browser `localStorage` records into MySQL the first time that MySQL account has no saved app data. It then hydrates the browser cache from that account's MySQL data and sends later browser storage changes to MySQL. Data is scoped by MySQL user account. A browser owner marker prevents one logged-in account's local cache from being automatically imported into another account.

The app stores its existing voucher, purchase, inventory, and master-data collections in the `user_app_data` table, keyed by the existing browser storage keys. This retains the current screen behavior while moving persistence to MySQL. The `inventory_items`, `inventory_movements`, and purchase-order tables are also available for API-based workflows.

The data API requires an authenticated session:

- `GET /api/data` — read the current user's app data
- `PUT /api/data?key=<storage-key>` — save one string value
- `DELETE /api/data?key=<storage-key>` — remove one value
- `POST /api/data/migrate` — import local data once, only when that user has no stored records

If MySQL is not configured, the app continues in local-only mode and stores data in that browser's `localStorage`; data will not sync between browsers or devices. If MySQL is configured but unavailable, app-data initialization displays an error rather than silently treating browser-only storage as a successful server save.

## Stock ledger and warehouse stock

Open **Stock Ledger** and type an item name or code; choose the matching suggestion or submit the search to view its movement ledger. The **Warehouse Stock** view groups item balances by the item's Item Master department/category and warehouse. It calculates warehouse balances from received MRN quantities minus approved material issues. Opening balances that have no warehouse receipt are shown separately under **Unassigned warehouse**; choose a warehouse in the **Opening Stock Assignment** column and save to assign or reassign that full opening balance. Filter by warehouse or department and use **Download CSV** to export the visible report.

## Importing stock balances

Open **Item Master → Upload Stock Excel** and choose an `.xlsx` or `.csv` file. Include an item-code column (for example `Item Code`, `Item Number`, `Item No`, or `SKU`) and a quantity column (for example `Quantity`, `Qty`, `Stock`, or `Balance Quantity`). Include `Item Name` when the file may contain new item codes; missing codes are then added to Item Master with the supplied name, optional unit, department/category, and imported starting stock. A `Department` column (also `Dept` or `Category`) maps values such as MEP, Civil, and Housekeeping to Item Master categories so items can be filtered into groups. To categorize items that are already imported without adding their quantities again, use **Update Departments from Excel**; this updates categories only and leaves stock unchanged. Use **Upload Stock Excel** to add stock. Column order, extra columns, and up to 50 title rows are allowed. Numbers `.numbers` files must first be exported to Excel or CSV. Negative quantities, duplicate codes in Item Master, conflicting departments for one code, or new codes without an item name are rejected without changing stock.

## Monthly registers

Open **Registers & Monthly Reports** from the dashboard, select a month, and switch between the Material Requisition Register and Purchase Order Register. Use **Print / Save PDF** to print the selected monthly register or save it as a PDF from the browser print dialog. Register rows can open their source voucher.

## Local-only login fallback

If MySQL settings are not present, `npm run setup` can still create a local login stored in `.auth/credentials.json`. This fallback protects the pages but does not provide MySQL app-data persistence; configure MySQL before using the app as a database-backed system.
