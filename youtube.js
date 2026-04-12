// netlify/functions/youtube.js
// Generates YouTube description, tags, and hashtags via Gemini API

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL   = 'gemini-2.5-flash-preview-04-17'; // update to latest stable when available

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

  const { description, tone, keywords, niches } = body;

  if (!description || !description.trim()) {
    return respond(400, { error: 'Video description is required.' });
  }

  const nicheContext = niches && niches.length > 0
    ? `The creator's content niches are: ${niches.join(', ')}.`
    : '';

  const keywordContext = keywords && keywords.trim()
    ? `The creator wants to include these keywords if relevant: ${keywords}.`
    : '';

  const prompt = `
You are a YouTube SEO expert with deep knowledge of the current YouTube algorithm (2024–2025).

${nicheContext}
${keywordContext}

The creator's video is about:
"${description.trim()}"

Tone: ${tone}

Your task is to generate:

1. A YouTube VIDEO DESCRIPTION that is:
   - Under 5000 characters STRICTLY (count carefully)
   - Structured: hook paragraph → key points → CTA → links section placeholder → hashtags at bottom
   - SEO-optimized with natural keyword usage
   - Engaging, written in the specified tone
   - Uses line breaks and spacing for readability
   - No emojis overload — use sparingly and only where natural

2. YouTube TAGS that are:
   - Under 500 characters STRICTLY (count carefully)
   - Comma-separated list
   - Mix of broad, mid-tail, and long-tail tags
   - Platform-relevant and ranking-focused

3. YouTube HASHTAGS that are:
   - 3 to 5 hashtags only
   - Trending and platform-relevant
   - Written as #HashtagName format

Respond ONLY in this exact JSON format (no markdown, no extra text):
{
  "description": "...",
  "tags": "tag1, tag2, tag3, ...",
  "hashtags": "#Hashtag1 #Hashtag2 #Hashtag3"
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
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
          tools: [{ googleSearch: {} }], // enables grounding for latest SEO data
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

    // Enforce character limits
    let { description: desc, tags, hashtags } = parsed;
    desc = enforceLimit(desc, 5000);
    tags = enforceLimit(tags, 500);

    return respond(200, { description: desc, tags, hashtags });

  } catch (err) {
    console.error('Function error:', err);
    return respond(500, { error: 'Internal server error.' });
  }
};

// ── HELPERS ───────────────────────────────────────────────────

function enforceLimit(str, limit) {
  if (!str) return '';
  if (str.length <= limit) return str;
  // Trim at last sentence boundary within limit
  const trimmed = str.slice(0, limit);
  const lastPeriod = trimmed.lastIndexOf('.');
  return lastPeriod > limit * 0.8 ? trimmed.slice(0, lastPeriod + 1) : trimmed;
}

function safeParseJSON(text) {
  try {
    // Strip markdown code fences if present
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    // Try extracting JSON object from surrounding text
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
