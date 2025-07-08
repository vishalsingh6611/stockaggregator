const db = require('./db');
const { publishOrder } = require('./rabbitmq');
const { reserveAndReduceStock } = require('./stockService');
const { v4: uuidv4 } = require('uuid');

async function createOrder(productId, quantity) {
  const orderId = uuidv4();
  try {
    await db.query(
      `INSERT INTO orders_table (order_id, product_id, quantity, status) VALUES ($1, $2, $3, 'pending');`,
      [orderId, productId, quantity]
    );
    console.log(`Order ${orderId} created in pending state.`);
    await publishOrder({ orderId, productId, quantity });

    return { orderId, message: 'Order received and queued for processing.' };
  } catch (error) {
    console.error(`Error creating order ${orderId}:`, error.message);
    throw new Error('Failed to create order due to internal error.');
  }
}

async function processQueuedOrder(orderData) {
  const { orderId, productId, quantity } = orderData;
  console.log(`Attempting to process queued order: ${orderId}`);

  try {
    const { rows } = await db.query(
      `SELECT status FROM orders_table WHERE order_id = $1;`,
      [orderId]
    );

    if (rows.length === 0) {
      throw new Error(`Order ${orderId} not found in database.`);
    }

    if (rows[0].status === 'completed' || rows[0].status === 'failed') {
      console.log(`Order ${orderId} already processed with status: ${rows[0].status}. Skipping.`);
      return;
    }

    const reservationResult = await reserveAndReduceStock(productId, quantity);
    await db.query(
      `UPDATE orders_table SET status = 'completed', processed_at = NOW(), reservation_details = $1 WHERE order_id = $2;`,
      [JSON.stringify(reservationResult.reservedFromVendors), orderId]
    );
    console.log(`Order ${orderId} successfully processed and marked as completed.`);

  } catch (error) {
    console.error(`Failed to process queued order ${orderId}:`, error.message);
    await db.query(
      `UPDATE orders_table SET status = 'failed', error_message = $1 WHERE order_id = $2;`,
      [error.message, orderId]
    );
    throw error;
  }
}

module.exports = {
  createOrder,
  processQueuedOrder,
};