CREATE DATABASE IF NOT EXISTS soft_manager;
USE soft_manager;

CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT,
  username VARCHAR(128) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_users_username (username)
);

CREATE TABLE IF NOT EXISTS user_app_data (
  user_id INT NOT NULL,
  storage_key VARCHAR(191) NOT NULL,
  value_text LONGTEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, storage_key),
  CONSTRAINT fk_user_app_data_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

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
);

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
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INT NOT NULL AUTO_INCREMENT,
  po_number VARCHAR(64) NOT NULL,
  supplier_name VARCHAR(200) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  total_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_po_number (po_number)
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INT NOT NULL AUTO_INCREMENT,
  purchase_order_id INT NOT NULL,
  item_id INT NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  unit_price DECIMAL(18,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_purchase_order_items_po (purchase_order_id),
  CONSTRAINT fk_po_items_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_po_items_item FOREIGN KEY (item_id) REFERENCES inventory_items (id) ON DELETE RESTRICT
);
