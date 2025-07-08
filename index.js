require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const orderService = require('./orderService');
const stockService = require('./stockService');
const { initRabbitMQ, consumeOrders } = require('./rabbitmq');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

async function initializeApp() {
  try {
    await initRabbitMQ();
    consumeOrders();
    console.log('RabbitMQ initialized and consumer started.');

    const SYNC_INTERVAL = process.env.SYNC_INTERVAL || 60000;
    setInterval(async () => {
      console.log('start periodic sync...');
      await stockService.syncAllVendorStocks();
    }, SYNC_INTERVAL);

    app.post('/order', async (req, res) => {
      const { productId, quantity } = req.body;
      if (!productId || !quantity || quantity <= 0) {
        return res.status(400).json({ message: 'Invalid product ID or quantity.' });
      }

      try {
        const orderResult = await orderService.createOrder(productId, quantity);
        res.status(202).json(orderResult);
      } catch (error) {
        console.error('Error creating order:', error.message);
        res.status(500).json({ message: error.message });
      }
    });

    app.post('/sync-stock', async (req, res) => {
      try {
        await stockService.syncAllVendorStocks();
        res.status(200).json({ message: 'Stock synchronization initiated successfully.' });
      } catch (error) {
        console.error('Error initiating manual stock sync:', error.message);
        res.status(500).json({ message: 'Failed to initiate stock synchronization.' });
      }
    });

    app.listen(PORT, () => {
      console.log(`Order Processing running on port ${PORT}`);
    });

  } catch (error) {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  }
}

initializeApp();