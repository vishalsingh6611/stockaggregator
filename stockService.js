require('dotenv').config();
const db = require('./db');

const VENDOR_APIS = {
  vendorA: process.env.VENDORA_API_URL || 'http://localhost:3001/vendorA/stock',
};

async function fetchStockFromVendor(vendorName, apiUrl) {
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} from ${vendorName}`);
    }
    const data = await response.json();
    console.log(`Fetched stock from ${vendorName}:`, data);
    return data;
  } catch (error) {
    console.error(`Error fetching stock from ${vendorName}:`, error.message);
    return null;
  }
}

async function updateLocalStock(vendorName, vendorStock) {
    for (const item of vendorStock) {
      const { productId, quantity } = item;
      const upsertQuery = `
        INSERT INTO stock (product_id, vendor_name, quantity, last_synced_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (product_id, vendor_name) DO UPDATE
        SET quantity = EXCLUDED.quantity, last_synced_at = NOW();
      `;
      await client.query(upsertQuery, [productId, vendorName, quantity]);
    }
    console.log(`Local stock updated for ${vendorName}.`);
}

async function syncAllVendorStocks() {
  const syncPromises = Object.entries(VENDOR_APIS).map(([vendorName, apiUrl]) =>
    (async () => {
      const vendorStock = await fetchStockFromVendor(vendorName, apiUrl);
      if (vendorStock) {
        await updateLocalStock(vendorName, vendorStock);
      }
    })
  );
  await Promise.all(syncPromises);
  console.log('All vendor stocks synchronized.');
}

async function reserveAndReduceStock(productId, quantityToReserve) {
  return await db.transact(async (client) => {
    const { rows: vendorStocks } = await client.query(
      `SELECT vendor_name, quantity FROM stock WHERE product_id = $1 ORDER BY quantity DESC FOR UPDATE;`,
      [productId]
    );

    let remainingToReserve = quantityToReserve;
    const reservedFromVendors = [];

    for (const vendorStock of vendorStocks) {
      if (remainingToReserve === 0) break;

      const { vendor_name: vendorName, quantity: currentVendorQuantity } = vendorStock;
      const canReserveFromVendor = Math.min(currentVendorQuantity, remainingToReserve);

      if (canReserveFromVendor > 0) {
        const newQuantity = currentVendorQuantity - canReserveFromVendor;

        await client.query(
          `UPDATE stock SET quantity = $1, last_updated_at = NOW() WHERE product_id = $2 AND vendor_name = $3;`,
          [newQuantity, productId, vendorName]
        );

        reservedFromVendors.push({ vendorName, quantity: canReserveFromVendor });
        remainingToReserve -= canReserveFromVendor;
      }
    }

    console.log(`Reserved ${quantityToReserve} of product ${productId}. Details:`, reservedFromVendors);
    return { success: true, reservedFromVendors };
  });
}


module.exports = {
  syncAllVendorStocks,
  reserveAndReduceStock,
};