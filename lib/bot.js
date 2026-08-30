const { Telegraf } = require('telegraf');
const { extractVideoFromTweetUrl } = require('./extractVideo');

if (!process.env.BOT_TOKEN) {
  throw new Error('BOT_TOKEN غير موجود في متغيرات البيئة');
}

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) =>
  ctx.reply(
    'أهلاً 👋\n\nأرسل لي رابط تغريدة فيها فيديو من تويتر/X وراح أرسل لك الفيديو مباشرة.\n\nمثال:\nhttps://x.com/username/status/1234567890'
  )
);

bot.help((ctx) =>
  ctx.reply('فقط أرسل رابط التغريدة اللي فيها الفيديو، مثل:\nhttps://x.com/username/status/1234567890')
);

// عند إضافة البوت لكروب، يرسل رسالة تعريفية
bot.on('new_chat_members', async (ctx) => {
  const botInfo = await ctx.telegram.getMe();
  const wasBotAdded = ctx.message.new_chat_members.some((m) => m.id === botInfo.id);

  if (wasBotAdded) {
    await ctx.reply(
      'أهلاً 👋 أي رابط تغريدة فيها فيديو يترسل بالكروب راح أحمّله وأرسله تلقائيًا.\n\n⚠️ لازم تتأكد إن Privacy Mode مطفي من BotFather عشان أقدر أشوف رسائل الكروب (راجع /help في المحادثة الخاصة).'
    );
  }
});

const TWITTER_LINK_REGEX = /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/\w+\/status(?:es)?\/\d+\S*/gi;

// أي رسالة نصية فيها رابط أو أكثر لتويتر/X (تشتغل في الخاص وفي الكروبات)
bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  const links = text.match(TWITTER_LINK_REGEX);
  const isPrivateChat = ctx.chat.type === 'private';

  if (!links || !links.length) {
    if (isPrivateChat) {
      return ctx.reply('أرسل رابط تغريدة صحيح فيها فيديو 🎥');
    }
    return;
  }

  // نعالج كل الروابط بالتوازي (مو تباعًا) لأقصى سرعة
  await Promise.all(
    links.map((link) => sendVideoForLink(ctx, link))
  );
});

async function sendVideoForLink(ctx, link) {
  // "يرسل فيديو..." بدل رسالة نصية مؤقتة نحذفها لاحقًا -> يوفر رحلتين API
  ctx.telegram.sendChatAction(ctx.chat.id, 'upload_video').catch(() => {});

  try {
    const { videoUrl, author, text: tweetText } = await extractVideoFromTweetUrl(link);

    const caption = [author ? `👤 ${author}` : null, tweetText ? tweetText.slice(0, 400) : null]
      .filter(Boolean)
      .join('\n\n');

    // نرسل الفيديو كرابط مباشر: تليجرام نفسه يسحب الملف من CDN تويتر
    // بأعلى جودة متوفرة (أعلى bitrate تم اختياره في extractVideo.js) — هذا أسرع أسلوب
    // لأننا لا نمرر البايتات عبر سيرفرنا إطلاقًا
    await ctx.replyWithVideo(
      { url: videoUrl },
      {
        caption: caption || undefined,
        reply_to_message_id: ctx.message.message_id,
        supports_streaming: true,
      }
    );
  } catch (err) {
    console.error(`فشل الرابط ${link}:`, err.message);
    await ctx
      .reply(`❌ تعذر تحميل: ${link}\nالسبب: ${err.message}`, {
        reply_to_message_id: ctx.message.message_id,
      })
      .catch(() => {});
  }
}

module.exports = bot;
