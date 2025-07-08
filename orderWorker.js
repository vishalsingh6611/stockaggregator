const { connectQueue, getChannel } = require('./rabbitmq');
const axios = require('axios');

(async () => {
  await connectQueue();
  const channel = getChannel();

  channel.consume('orderQueue', async msg => {
    if (!msg) return;

    const order = JSON.parse(msg.content.toString());
    console.log('Processing order:', order);

    try {
      const res = await axios.post('http://localhost:5001/vendorA/reserve', order);
      if (res.data.success) {
        console.log('Vendor stock reserved');
        channel.ack(msg);
      } else {
        console.error('Vendor reservation failed, retrying...');
        setTimeout(() => channel.nack(msg, false, true), 1000);
      }
    } catch (err) {
      console.error('Error contacting vendor. Retrying...');
      setTimeout(() => channel.nack(msg, false, true), 1000);
    }
  });
})();
