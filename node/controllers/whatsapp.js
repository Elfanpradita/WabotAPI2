global.crypto = require('crypto');
const {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

let globalSock;

async function createSocketConnection(app) {
  // Cegah double socket
  if (globalSock?.ws?.readyState === 1) {
    console.log('⚠️ Socket sudah aktif. Skip init ulang.');
    return;
  }

  const { state, saveCreds } = await useMultiFileAuthState('session');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
  });

  globalSock = sock;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('📷 QR Code received. Scan dengan WhatsApp:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log('🔴 Connection closed, reason:', reason);

      if (reason !== DisconnectReason.loggedOut) {
        console.log('🔁 Reconnecting in 5s...');
        setTimeout(() => createSocketConnection(app), 5000); // Delay reconnect
      } else {
        console.log('❌ Logged out. Hapus folder `session` untuk mulai ulang.');
      }
    }

    if (connection === 'open') {
      console.log('🟢 WhatsApp connected!');
    }
  });

  // Keepalive ping setiap 1 menit
  setInterval(() => {
    if (sock?.ws?.readyState === 1) {
      console.log('📶 Keepalive ping...');
      sock.sendPresenceUpdate('available');
    }
  }, 60000);

  // Endpoint cek status koneksi
  app.get('/ping', (req, res) => {
    res.json({ status: 'alive', message: 'pong 🏓' });
  });

  // Endpoint kirim pesan
  app.post('/send', async (req, res) => {
    const { number, message } = req.body;

    if (!number || !message) {
      return res.status(400).json({ error: 'Nomor dan pesan wajib diisi.' });
    }

    try {
      const jid = `${number.replace(/\D/g, '')}@s.whatsapp.net`;
      await sock.sendMessage(jid, { text: message });
      res.json({ success: true, message: 'Pesan berhasil dikirim.' });
    } catch (err) {
      console.error('❌ Gagal kirim pesan:', err);
      res.status(500).json({ success: false, message: 'Gagal kirim pesan.', error: err.message });
    }
  });
}

module.exports = { createSocketConnection };
