const bot = require('../lib/bot');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(200).send('Telegram Twitter Video Bot is running ✅');
    return;
  }

  try {
    await bot.handleUpdate(req.body, res);
  } catch (err) {
    console.error('Webhook error:', err);
  }

  if (!res.headersSent) {
    res.status(200).send('ok');
  }
};
