// شغّل هذا السكريبت مرة وحدة بعد ما تنشر المشروع على Vercel
// الاستخدام: BOT_TOKEN=xxx VERCEL_URL=https://your-app.vercel.app node scripts/set-webhook.js

const fetch = require('node-fetch');

const BOT_TOKEN = process.env.BOT_TOKEN;
const VERCEL_URL = process.env.VERCEL_URL; // مثال: https://your-app.vercel.app

if (!BOT_TOKEN || !VERCEL_URL) {
  console.error('لازم تحدد BOT_TOKEN و VERCEL_URL كمتغيرات بيئة قبل التشغيل');
  process.exit(1);
}

const webhookUrl = `${VERCEL_URL.replace(/\/$/, '')}/api/webhook`;

(async () => {
  const res = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
  );
  const data = await res.json();
  console.log(data);

  if (data.ok) {
    console.log(`✅ تم ربط الـ webhook بنجاح على: ${webhookUrl}`);
  } else {
    console.error('❌ صار خطأ أثناء ربط الـ webhook');
  }
})();
