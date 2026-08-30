# بوت تليجرام لتحميل فيديوهات تويتر/X

بوت يستقبل رابط تغريدة فيها فيديو، ويرسل الفيديو مباشرة داخل تليجرام.
يعمل بالكامل على **Vercel** عن طريق **Webhook**.

## 1. أنشئ البوت في تليجرام

1. افتح محادثة مع [@BotFather](https://t.me/BotFather)
2. أرسل `/newbot` واتبع التعليمات
3. احفظ الـ **Bot Token** اللي راح يعطيك إياه

## 2. نزّل المشروع محليًا وثبّت المكتبات

```bash
npm install
```

## 3. ارفع المشروع على GitHub

```bash
git init
git add .
git commit -m "init"
git remote add origin <رابط_مستودعك>
git push -u origin main
```

## 4. انشر المشروع على Vercel

1. روح إلى [vercel.com](https://vercel.com) وسجل دخول
2. اختر **Add New Project** واربطه بمستودع GitHub اللي رفعته
3. في إعدادات المشروع، أضف Environment Variable:
   - **Key:** `BOT_TOKEN`
   - **Value:** التوكن اللي أخذته من BotFather
4. اضغط **Deploy**

بعد ما ينتهي النشر، راح تحصل على رابط مثل:
`https://your-app.vercel.app`

## 5. فعّل الـ Webhook (خطوة تسوّيها مرة وحدة فقط)

في نفس مجلد المشروع على جهازك، شغّل:

```bash
BOT_TOKEN=توكن_البوت VERCEL_URL=https://your-app.vercel.app npm run set-webhook
```

لو طلعت لك رسالة `"ok": true` يعني البوت شغّال ومربوط.

## 6. جرّب البوت

روح لبوتك في تليجرام، أرسل `/start`، وبعدها أرسل رابط أي تغريدة فيها فيديو:

```
https://x.com/username/status/1234567890
```

راح يرد عليك بالفيديو مباشرة.

---

## كيف يشتغل تقنيًا

- البوت يستخدم [Telegraf](https://telegraf.js.org/) لإدارة تفاعل تليجرام
- استخراج الفيديو يتم عبر **Twitter Syndication API** (نفس الطريقة اللي تستخدمها مواقع تضمين التغريدات embed) بدون الحاجة لمفتاح API من تويتر
- البوت يرسل رابط الفيديو مباشرة لتليجرام (بدل ما يحمّله على السيرفر) عشان يتفادى قيود الوقت والحجم في Vercel serverless functions

## ملاحظات مهمة

- تويتر/X قد يغيّرون بنية الـ syndication API من وقت لآخر، إذا توقف الاستخراج جرّب تحدّث ملف `lib/extractVideo.js`
- احترم حقوق الملكية الفكرية وشروط استخدام X عند استخدام هذا البوت
- خطة Vercel المجانية فيها حد أقصى 10 ثواني لتنفيذ الـ function — كافي لمعظم الحالات لأننا لا نحمّل الفيديو على السيرفر
- للفيديوهات الكبيرة أو الاستخدام المكثف بالكروبات، يُفضّل الترقية لخطة Vercel Pro (60 ثانية timeout، مضبوطة مسبقًا في `vercel.json`)

## بنية المشروع

```
twitter-video-bot/
├── api/
│   └── webhook.js       # نقطة الدخول (Vercel serverless function)
├── lib/
│   ├── bot.js            # منطق البوت والأوامر
│   └── extractVideo.js   # استخراج رابط الفيديو من تويتر
├── scripts/
│   └── set-webhook.js    # سكريبت ربط الـ webhook بعد النشر
├── .env.example
├── .gitignore
├── LICENSE
├── package.json
├── vercel.json
└── README.md
```

## المساهمة

الـ Pull Requests والاقتراحات مرحّب فيها. إذا لقيت أن استخراج الفيديو توقف (بسبب تغييرات من طرف تويتر/X)، افتح Issue أو عدّل `lib/extractVideo.js` مباشرة.

## الترخيص

هذا المشروع مرخّص تحت [MIT License](LICENSE).

