const fetch = require('node-fetch');

/**
 * يستخرج رقم التغريدة (Tweet ID) واسم المستخدم من رابط تويتر/X.
 */
function extractTweetInfo(url) {
  const match = url.match(/(?:twitter|x)\.com\/([A-Za-z0-9_]+)\/status(?:es)?\/(\d+)/i);
  if (!match) return null;
  return { screenName: match[1], tweetId: match[2] };
}

function extractTweetId(url) {
  return extractTweetInfo(url)?.tweetId || null;
}

async function fetchJson(url, label, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      },
      signal: controller.signal,
    });

    const body = await res.text();
    let data = null;

    try {
      data = body ? JSON.parse(body) : null;
    } catch (_) {
      // Keep the upstream HTTP status in the error below.
    }

    if (!res.ok) {
      throw new Error(`${label} (HTTP ${res.status})`);
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * المصدر الأصلي: X Syndication API.
 */
async function fetchTweetDataFromSyndication(tweetId) {
  return fetchJson(
    `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=1`,
    'Syndication API فشل'
  );
}

/**
 * Fallback عام بدون Cookie أو API key.
 * يستخدم FxTwitter API للمحتوى العام الذي يمكن للخدمة الوصول إليه.
 * لا يحاول تسجيل الدخول أو تجاوز صلاحيات/تحقق X.
 */
async function fetchTweetDataFromFxTwitter(screenName, tweetId) {
  const urls = [
    `https://api.fxtwitter.com/2/status/${tweetId}`,
    `https://api.fxtwitter.com/${encodeURIComponent(screenName)}/status/${tweetId}`,
  ];

  let lastError = null;

  for (const url of urls) {
    try {
      const data = await fetchJson(url, 'FxTwitter API فشل');
      if (data?.code && data.code !== 200) {
        throw new Error(`FxTwitter API أعاد code=${data.code}`);
      }
      return data?.status || data?.tweet || null;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('تعذر جلب بيانات التغريدة من FxTwitter');
}

/**
 * يحوّل بنية الوسائط من FxTwitter إلى الصيغة الموحدة المستخدمة في البوت.
 */
function getFxTwitterVideoVariants(tweetData) {
  const media = tweetData?.media;
  if (!media) return [];

  const videos = Array.isArray(media.videos)
    ? media.videos
    : Array.isArray(media.all)
      ? media.all.filter((item) => item?.type === 'video' || item?.type === 'gif')
      : [];

  return videos
    .flatMap((video) => {
      if (video?.url) {
        return [{
          url: video.url,
          bitrate: Number(video.bitrate) || 0,
          width: Number(video.width) || undefined,
          height: Number(video.height) || undefined,
        }];
      }

      return (video?.formats || [])
        .filter((format) => format?.url && (!format.container || format.container === 'mp4'))
        .map((format) => ({
          url: format.url,
          bitrate: Number(format.bitrate) || 0,
          width: Number(format.width) || Number(video.width) || undefined,
          height: Number(format.height) || Number(video.height) || undefined,
        }));
    })
    .filter((variant) => variant.url);
}

/**
 * يستخرج أعلى جودة فيديو من بيانات التغريدة بصرف النظر عن المصدر.
 */
function getBestVideoVariant(tweetData) {
  // X Syndication format
  if (tweetData?.mediaDetails?.length) {
    for (const item of tweetData.mediaDetails) {
      if (item.type !== 'video' && item.type !== 'animated_gif') continue;

      const variants = (item.video_info?.variants || []).filter(
        (v) => v.content_type === 'video/mp4' && v.url
      );

      if (!variants.length) continue;

      variants.sort((a, b) => (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0));

      return {
        url: variants[0].url,
        bitrate: Number(variants[0].bitrate) || 0,
        width: item.original_info?.width,
        height: item.original_info?.height,
        type: item.type,
      };
    }
  }

  // FxTwitter format
  const fxVariants = getFxTwitterVideoVariants(tweetData);
  if (fxVariants.length) {
    fxVariants.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    return {
      ...fxVariants[0],
      type: 'video',
    };
  }

  return null;
}

function getTweetText(tweetData) {
  return tweetData?.text || tweetData?.tweet?.text || '';
}

function getTweetAuthor(tweetData) {
  return (
    tweetData?.user?.name ||
    tweetData?.user?.screen_name ||
    tweetData?.author?.name ||
    tweetData?.author?.screen_name ||
    ''
  );
}

/**
 * الدالة الرئيسية: تأخذ رابط تغريدة وترجع رابط الفيديو المباشر.
 */
async function extractVideoFromTweetUrl(tweetUrl) {
  const info = extractTweetInfo(tweetUrl);
  if (!info) {
    throw new Error('الرابط اللي أرسلته مو رابط تغريدة صحيح');
  }

  let tweetData;
  let source = 'syndication';
  let syndicationError = null;

  try {
    tweetData = await fetchTweetDataFromSyndication(info.tweetId);
  } catch (err) {
    syndicationError = err;
  }

  // لا يحتاج Cookie/API key: نحاول فقط مصدرًا عامًا بديلًا.
  if (!tweetData) {
    try {
      tweetData = await fetchTweetDataFromFxTwitter(info.screenName, info.tweetId);
      source = 'fxtwitter';
    } catch (fallbackError) {
      const suffix = syndicationError ? ` — ${syndicationError.message}` : '';
      throw new Error(`تعذر جلب بيانات التغريدة من المصادر العامة${suffix}`);
    }
  }

  const video = getBestVideoVariant(tweetData);
  if (!video) {
    if (source === 'fxtwitter' && tweetData?.media?.photos?.length) {
      throw new Error('التغريدة تحتوي صورًا وليس فيديو');
    }
    throw new Error('ما لقيت فيديو في هذي التغريدة');
  }

  return {
    videoUrl: video.url,
    text: getTweetText(tweetData),
    author: getTweetAuthor(tweetData),
    width: video.width,
    height: video.height,
    source,
  };
}

module.exports = { extractVideoFromTweetUrl, extractTweetId, extractTweetInfo };
