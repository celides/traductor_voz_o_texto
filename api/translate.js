// Vercel serverless. Variables de entorno: AZURE_KEY, AZURE_REGION, GEMINI_API_KEY, GEMINI_MODEL (opcional)
const NAMES = {es:'Spanish',en:'English','zh-Hans':'Simplified Chinese','zh-Hant':'Traditional Chinese',ar:'Arabic',fr:'French',de:'German',it:'Italian',pt:'Portuguese',ru:'Russian',ja:'Japanese',ko:'Korean',hi:'Hindi',ur:'Urdu',fil:'Filipino',tr:'Turkish',nl:'Dutch',pl:'Polish',uk:'Ukrainian',vi:'Vietnamese',th:'Thai',id:'Indonesian',he:'Hebrew',fa:'Persian'};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const { text, from, to, engine = 'azure', ctx = 'general' } = req.body || {};
  if (!text || typeof text !== 'string' || text.length > 1500 || !NAMES[from] || !NAMES[to]) {
    return res.status(400).json({ error: 'bad_request' });
  }
  if (from === to) return res.status(200).json({ text });
  const fail = (error, detail) => res.status(502).json({ error, detail: String(detail || '').slice(0, 200) });

  try {
    let out;
    if (engine === 'gemini') {
      if (!process.env.GEMINI_API_KEY) return fail('missing_env', 'GEMINI_API_KEY');
      const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'; // confirma el nombre vigente en la doc de Google
      let prompt = `Translate from ${NAMES[from]} to ${NAMES[to]}. Ignore filler words and background noise. Reply ONLY with the translation.`;
      if (ctx === 'church') prompt += ' Context: a talk at a chapel of The Church of Jesus Christ of Latter-day Saints; use the Church\'s official terminology in the target language (ward, stake, bishop, sacrament, Book of Mormon, etc.).';
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({ contents: [{ parts: [{ text: `${prompt}\n\n${text}` }] }] }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return fail('gemini', `${r.status} ${d.error?.message || ''}`);
      out = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    } else {
      if (!process.env.AZURE_KEY) return fail('missing_env', 'AZURE_KEY');
      if (!process.env.AZURE_REGION) return fail('missing_env', 'AZURE_REGION');
      const r = await fetch(`https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=${from}&to=${to}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': process.env.AZURE_KEY,
          'Ocp-Apim-Subscription-Region': process.env.AZURE_REGION,
        },
        body: JSON.stringify([{ Text: text }]),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return fail('azure', `${r.status} ${d.error?.message || ''}`);
      out = d[0]?.translations?.[0]?.text;
    }
    if (!out) return fail('empty', 'sin respuesta');
    res.status(200).json({ text: out });
  } catch (e) {
    fail('exception', e.message);
  }
};
