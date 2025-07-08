exports.up = function (db) {
  return db.runSql(`
    CREATE TABLE IF NOT EXISTS stock (
        product_id VARCHAR(255) NOT NULL,
        vendor_name VARCHAR(255) NOT NULL,
        quantity INTEGER NOT NULL,
        last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (product_id, vendor_name)
    );

    CREATE INDEX IF NOT EXISTS idx_stock_product_id ON stock (product_id);

    CREATE TABLE IF NOT EXISTS orders_table (
        id SERIAL PRIMARY KEY,
        order_id VARCHAR(255) UNIQUE NOT NULL,
        product_id VARCHAR(255) NOT NULL,
        quantity INTEGER NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP WITH TIME ZONE,
        error_message TEXT,
        reservation_details JSONB
    );
  `);
};

exports.down = function (db) {
  return db.runSql(`
    DROP TABLE IF EXISTS orders_table;
    DROP INDEX IF EXISTS idx_stock_product_id;
    DROP TABLE IF EXISTS stock;
  `);
};
