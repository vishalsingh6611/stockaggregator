const express = require('express');
const app = express();
const PORT = process.env.VENDORA_PORT || 3001;

let vendorAStock = {
  'product-1': 100,
  'product-2': 50,
  'product-3': 200,
};

setInterval(() => {
  for (const productId in vendorAStock) {
    const change = Math.floor(Math.random() * 20) - 10;
    vendorAStock[productId] = Math.max(0, vendorAStock[productId] + change);
  }
  console.log('VendorA stock updated randomly:', vendorAStock);
}, 30000);

app.get('/vendorA/stock', (req, res) => {
  const formattedStock = Object.keys(vendorAStock).map(productId => ({
    productId: productId,
    quantity: vendorAStock[productId]
  }));
  res.json(formattedStock);
});

app.post('/vendorA/reduce-stock', (req, res) => {
  const { productId, quantity } = req.body;
  if (!productId || !quantity || quantity <= 0) {
    return res.status(400).json({ message: 'Invalid product ID or quantity.' });
  }

  if (vendorAStock[productId] === undefined) {
    return res.status(404).json({ message: 'Product not found in Vendor A stock.' });
  }

  if (vendorAStock[productId] < quantity) {
    return res.status(400).json({ message: 'Insufficient stock in Vendor A.' });
  }

  vendorAStock[productId] -= quantity;
  res.json({ message: `Reduced ${quantity} of ${productId} from Vendor A. New stock: ${vendorAStock[productId]}`, currentStock: vendorAStock[productId] });
});


app.listen(PORT, () => {
  console.log(`Mock Vendor A API running on port ${PORT}`);
});