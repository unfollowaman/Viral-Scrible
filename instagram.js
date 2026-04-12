// netlify/functions/instagram.js
// Generates Instagram caption, hashtags, and keywords via Gemini API

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL   = 'gemini-2.5-flash-preview-04-17';

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'Method Not Allowed' });
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return respond(400, { error: 'Invalid JSON body' });
  }

  const { description, tone, niches } = body;

  if (!description || !description.trim()) {
    return respond(400, { error: 'Post description is required.' });
  }

  const nicheContext = niches && niches.length > 0
    ? `The creator's content niches are: ${niches.join(', ')}.`
    : '';

  const prompt = `
You are an Instagram content strategist with expert knowledge of the 2024–2025 Instagram algorithm.

${nicheContext}

The creator's post is about:
"${description.trim()}"

Tone: ${tone}

Your task is to generate:

1. An Instagram CAPTION that is:
   - Engagement-optimized for the Instagram algorithm
   - Starts with a strong hook (first line is critical — no caption is cut here)
   - Uses line breaks for readability
   - Ends with a clear call to action (question, CTA, prompt)
   - Matches the specified tone perfectly
   - Between 100–300 words — punchy, not overly long
   - Natural use of 1–2 emojis maximum

2. Instagram HASHTAGS:
   - EXACTLY 5 hashtags — no more, no less (Instagram algorithm prefers fewer, targeted hashtags in 2024–2025)
   - Mix: 1 broad niche, 2 mid-range, 2 specific/niche
   - Written as #HashtagName format on separate lines

3. KEYWORDS for the post:
   - 5–8 relevant SEO keywords for Instagram's search function
   - These are NOT hashtags — just plain keywords/phrases
   - Comma-separated

Respond ONLY in this exact JSON format (no markdown, no extra text):
{
  "caption": "...",
  "hashtags": "#Hashtag1\n#Hashtag2\n#Hashtag3\n#Hashtag4\n#Hashtag5",
  "keywords": "keyword1, keyword2, keyword3, ..."
}
`.trim();

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.75,
            maxOutputTokens: 1024,
          },
          tools: [{ googleSearch: {} }],
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', errText);
      return respond(502, { error: 'AI service error. Please try again.' });
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const parsed = safeParseJSON(rawText);
    if (!parsed) {
      return respond(502, { error: 'AI returned unexpected format. Please regenerate.' });
    }

    // Enforce 5 hashtag limit strictly
    let { caption, hashtags, keywords } = parsed;
    hashtags = enforceHashtagLimit(hashtags, 5);

    return respond(200, { caption, hashtags, keywords });

  } catch (err) {
    console.error('Function error:', err);
    return respond(500, { error: 'Internal server error.' });
  }
};

// ── HELPERS ───────────────────────────────────────────────────

function enforceHashtagLimit(hashtagStr, limit) {
  if (!hashtagStr) return '';
  // Split by newline or space, filter hashtags
  const tags = hashtagStr
    .split(/[\n\s]+/)
    .map(t => t.trim())
    .filter(t => t.startsWith('#'));
  return tags.slice(0, limit).join('\n');
}

function safeParseJSON(text) {
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { return null; }
    }
    return null;
  }
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}
