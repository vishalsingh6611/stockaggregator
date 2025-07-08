require('dotenv').config();
const amqp = require('amqplib');
const orderService = require('./orderService');

let channel;
let connection;

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const ORDER_QUEUE = 'order_queue';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

async function initRabbitMQ() {
  try {
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue(ORDER_QUEUE, { durable: true });
    console.log(`Connected to RabbitMQ and asserted queue: ${ORDER_QUEUE}`);
  } catch (error) {
    console.error('Failed to connect to RabbitMQ:', error);
    throw error;
  }
}

async function publishOrder(orderData) {
  try {
    if (!channel) {
      throw new Error('RabbitMQ channel not initialized.');
    }
    const message = JSON.stringify({ ...orderData, retries: 0 });
    channel.sendToQueue(ORDER_QUEUE, Buffer.from(message), { persistent: true });
    console.log(`Order published to queue: ${orderData.orderId}`);
  } catch (error) {
    console.error('Error publishing order to RabbitMQ:', error);
    throw error;
  }
}

async function consumeOrders() {
  if (!channel) {
    console.error('RabbitMQ channel not initialized. Cannot consume orders.');
    return;
  }

  channel.consume(ORDER_QUEUE, async (msg) => {
    if (msg === null) return;

    let order;
    try {
      order = JSON.parse(msg.content.toString());
      console.log(`Processing order from queue: ${order.orderId}, Retries: ${order.retries}`);

      await orderService.processQueuedOrder(order);
      channel.ack(msg);
      console.log(`Order ${order.orderId} processed and acknowledged.`);
    } catch (error) {
      console.error(`Error processing order ${order ? order.orderId : 'unknown'}:`, error.message);

      // Retry logic
      if (order && order.retries < MAX_RETRIES) {
        order.retries++;
        console.warn(`Retrying order ${order.orderId}. Attempt ${order.retries}/${MAX_RETRIES}`);
        setTimeout(() => {
          channel.publish('', ORDER_QUEUE, Buffer.from(JSON.stringify(order)), { persistent: true });
          channel.ack(msg);
        }, RETRY_DELAY_MS);
      } else {
        console.error(`Order ${order ? order.orderId : 'unknown'} failed after ${MAX_RETRIES} retries. Moving to dead-letter (not implemented, but concept here).`);
        channel.reject(msg, false);
      }
    }
  }, { noAck: false });
}

process.on('exit', () => {
  if (channel) {
    console.log('Closing RabbitMQ channel.');
    channel.close();
  }
  if (connection) {
    console.log('Closing RabbitMQ connection.');
    connection.close();
  }
});

module.exports = {
  initRabbitMQ,
  publishOrder,
  consumeOrders,
};