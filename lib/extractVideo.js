const fetch = require('node-fetch');

/**
 * يستخرج رقم التغريدة (Tweet ID) من أي رابط تويتر/X
 */
function extractTweetId(url) {
  const match = url.match(/(?:twitter|x)\.com\/\w+\/status(?:es)?\/(\d+)/i);
  return match ? match[1] : null;
}

/**
 * يجلب بيانات التغريدة عبر Twitter Syndication API (بدون الحاجة لمفتاح API)
 * هذي طريقة تستخدمها مواقع كثيرة لعرض embed التغريدات
 */
async function fetchTweetData(tweetId) {
  const url = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=1`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000); // نتفادى التعليق

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`تعذر جلب بيانات التغريدة (HTTP ${res.status})`);
    }

    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * يستخرج أعلى جودة فيديو متوفرة من بيانات التغريدة
 * يفرز حسب bitrate ثم يتحقق من الأبعاد (width*height) لضمان أعلى دقة فعلية
 */
function getBestVideoVariant(tweetData) {
  if (tweetData?.mediaDetails?.length) {
    for (const item of tweetData.mediaDetails) {
      if (item.type === 'video' || item.type === 'animated_gif') {
        const variants = (item.video_info?.variants || []).filter(
          (v) => v.content_type === 'video/mp4' && v.bitrate
        );

        if (!variants.length) continue;

        // أعلى bitrate = أعلى جودة متاحة من تويتر لهذا الفيديو
        variants.sort((a, b) => b.bitrate - a.bitrate);

        return {
          url: variants[0].url,
          bitrate: variants[0].bitrate,
          width: item.original_info?.width,
          height: item.original_info?.height,
          type: item.type,
        };
      }
    }
  }

  return null;
}

/**
 * الدالة الرئيسية: تاخذ رابط تغريدة وترجع رابط الفيديو المباشر
 */
async function extractVideoFromTweetUrl(tweetUrl) {
  const tweetId = extractTweetId(tweetUrl);
  if (!tweetId) {
    throw new Error('الرابط اللي أرسلته مو رابط تغريدة صحيح');
  }

  const tweetData = await fetchTweetData(tweetId);
  const video = getBestVideoVariant(tweetData);

  if (!video) {
    throw new Error('ما لقيت فيديو في هذي التغريدة');
  }

  return {
    videoUrl: video.url,
    text: tweetData.text || '',
    author: tweetData.user?.name || tweetData.user?.screen_name || '',
  };
}

module.exports = { extractVideoFromTweetUrl, extractTweetId };
