// netlify/functions/posting-time.js
// Returns ideal posting time slots via Gemini API with web search grounding

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

  const { platform, region, contentType, niches } = body;

  if (!platform || !region) {
    return respond(400, { error: 'Platform and region are required.' });
  }

  const nicheContext = niches && niches.length > 0
    ? `Creator niches: ${niches.join(', ')}.`
    : '';

  const contentContext = contentType && contentType.trim()
    ? `Content type: ${contentType.trim()}.`
    : '';

  const prompt = `
You are a social media data analyst with expertise in platform engagement analytics.

Use your knowledge of the latest platform research and engagement studies (2024–2025) to answer this.

Platform: ${platform}
Target audience region/timezone: ${region}
${nicheContext}
${contentContext}

Your task:

1. BEST TIME SLOTS — Provide the top 3–5 ideal posting time windows for this platform and region. Format each as:
   Day(s): [days]
   Time: [time range in local timezone of region]
   Why: [one sentence reason based on audience behavior data]

   Separate each slot with a blank line.

2. STRATEGY NOTES — Provide 3–5 actionable insights specific to this platform, region, and content type. Cover:
   - Frequency recommendation (how often to post)
   - Consistency tip
   - Any platform-specific algorithm behavior relevant to timing
   - Any niche-specific timing nuance if applicable

Keep the tone data-driven but readable. No vague generalities — be specific to the platform and region.

Respond ONLY in this exact JSON format (no markdown, no extra text):
{
  "timeSlots": "...",
  "strategyNotes": "..."
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
            temperature: 0.5,
            maxOutputTokens: 1024,
          },
          tools: [{ googleSearch: {} }], // grounded web search for latest timing data
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

    return respond(200, {
      timeSlots:     parsed.timeSlots     || '',
      strategyNotes: parsed.strategyNotes || '',
    });

  } catch (err) {
    console.error('Function error:', err);
    return respond(500, { error: 'Internal server error.' });
  }
};

// ── HELPERS ───────────────────────────────────────────────────

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
