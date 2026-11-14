// background-worker.js
const { Client } = require('pg');

// Initialize the database connection using your secure environment variable
const db = new Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false } // Required for secure cloud hosting connections
});

// A core list of popular Ryanair departure bases to loop through automatically
const ORIGIN_BASES = ['DUB', 'STN', 'MAN', 'BHX', 'EDI'];

async function runNightlySweep() {
  try {
    console.log('⚡ Starting nightly flight matrix processing sweep...');
    await db.connect();

    // 1. Wipe yesterday's cached deals so your data stays perfectly fresh
    await db.query('TRUNCATE TABLE ryanair_deals;');
    console.log('🗑️ Yesterday\'s cached rows cleared successfully.');

    // 2. Loop through each destination origin hub
    for (const origin of ORIGIN_BASES) {
      console.log(`📡 Fetching active flight connections out of ${origin}...`);
      
      // Hit Ryanair's public Fare Finder engine (leaving arrival empty defaults to 'Everywhere')
      const response = await fetch(`https://ryanair.com{origin}&arrivalAirportIataCode=&market=en-ie`);
      const data = await response.json();

      if (!data.fares || !Array.isArray(data.fares)) continue;

      // 3. Drill down into individual route schedules
      for (const item of data.fares) {
        const outbound = item.outbound;
        const inbound = item.inbound;
        const price = item.summary.price.value;

        // Extreme Daytrip Check: Extract and compare calendar dates only (YYYY-MM-DD)
        const outDateStr = outbound.departureDate.split('T')[0];
        const inDateStr = inbound.departureDate.split('T')[0];

        if (outDateStr === inDateStr) {
          const destName = `${outbound.arrivalAirport.name} (${outbound.arrivalAirport.iataCode})`;
          
          // Insert the valid same-day return route straight into your table cache
          const insertQuery = `
            INSERT INTO ryanair_deals (origin, destination, destination_name, total_price, outbound_time, inbound_time, flight_number)
            VALUES ($1, $2, $3, $4, $5, $6, $7);
          `;
          
          await db.query(insertQuery, [
            origin,
            outbound.arrivalAirport.iataCode,
            destName,
            price,
            outbound.departureDate,
            inbound.departureDate,
            outbound.flightNumber
          ]);
        }
      }
    }

    console.log('✅ Success! Nightly cache table fully synchronized with active fares.');
  } catch (error) {
    console.error('❌ Serious failure processing data metrics loop:', error);
  } finally {
    await db.end();
    process.exit(0);
  }
}

runNightlySweep();