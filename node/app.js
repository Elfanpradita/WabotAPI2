const express = require('express');
const { createSocketConnection } = require('./controllers/whatsapp');

const app = express();
app.use(express.json());

createSocketConnection(app); // Init koneksi WA + routes

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`✅ Server running on port ${PORT}`));
