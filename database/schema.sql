-- ============================================================
-- Noir Cafe — Database Schema (MySQL 8+)
-- All money columns are stored as INTEGER PESEWAS (GHS minor unit)
-- to avoid floating point rounding errors. 100 pesewas = GHS 1.00.
-- ============================================================

CREATE DATABASE IF NOT EXISTS noir_cafe
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE noir_cafe;

-- ----------------------------
-- Users (customers + admins)
-- ----------------------------
CREATE TABLE IF NOT EXISTS users (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  full_name       VARCHAR(120)        NOT NULL,
  email           VARCHAR(150)        NOT NULL UNIQUE,
  phone           VARCHAR(20)         NULL,
  password_hash   VARCHAR(255)        NOT NULL,
  role            ENUM('customer','admin') NOT NULL DEFAULT 'customer',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ----------------------------
-- Categories
-- ----------------------------
CREATE TABLE IF NOT EXISTS categories (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(80)         NOT NULL,
  slug            VARCHAR(80)         NOT NULL UNIQUE,
  description     VARCHAR(255)        NULL
) ENGINE=InnoDB;

-- ----------------------------
-- Products
-- ----------------------------
CREATE TABLE IF NOT EXISTS products (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  category_id      INT                 NULL,
  name             VARCHAR(150)        NOT NULL,
  slug             VARCHAR(150)        NOT NULL UNIQUE,
  description      TEXT                NULL,
  price_pesewas    INT UNSIGNED        NOT NULL,
  image_url        VARCHAR(500)        NULL,
  stock            INT UNSIGNED        NOT NULL DEFAULT 0,
  is_featured      TINYINT(1)          NOT NULL DEFAULT 0,
  is_active        TINYINT(1)          NOT NULL DEFAULT 1,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_products_category (category_id),
  INDEX idx_products_active (is_active)
) ENGINE=InnoDB;

-- ----------------------------
-- Orders
-- ----------------------------
CREATE TABLE IF NOT EXISTS orders (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  order_number          VARCHAR(20)   NOT NULL UNIQUE,
  user_id               INT           NULL,
  customer_name         VARCHAR(120)  NOT NULL,
  customer_email        VARCHAR(150)  NOT NULL,
  customer_phone        VARCHAR(20)   NOT NULL,
  delivery_address      VARCHAR(255)  NOT NULL,
  delivery_city         VARCHAR(80)   NOT NULL,
  delivery_notes        VARCHAR(255)  NULL,
  subtotal_pesewas      INT UNSIGNED  NOT NULL,
  delivery_fee_pesewas  INT UNSIGNED  NOT NULL DEFAULT 0,
  total_pesewas         INT UNSIGNED  NOT NULL,
  currency              VARCHAR(3)    NOT NULL DEFAULT 'GHS',
  status                ENUM('pending','paid','processing','out_for_delivery','completed','cancelled')
                         NOT NULL DEFAULT 'pending',
  payment_reference     VARCHAR(100)  NULL UNIQUE,
  payment_channel       VARCHAR(40)   NULL,
  paid_at               TIMESTAMP     NULL,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_orders_status (status),
  INDEX idx_orders_user (user_id)
) ENGINE=InnoDB;

-- ----------------------------
-- Order line items
-- ----------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  order_id             INT           NOT NULL,
  product_id           INT           NULL,
  product_name         VARCHAR(150)  NOT NULL,
  unit_price_pesewas   INT UNSIGNED  NOT NULL,
  quantity             INT UNSIGNED  NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  INDEX idx_order_items_order (order_id)
) ENGINE=InnoDB;
