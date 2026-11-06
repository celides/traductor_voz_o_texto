// Vercel serverless function. Las llaves viven en variables de entorno, nunca en el navegador.
// Variables: AZURE_KEY, AZURE_REGION, GEMINI_API_KEY, GEMINI_MODEL (opcional)

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const { text, target = 'zh-Hans', engine = 'azure' } = req.body || {};
  if (!text || typeof text !== 'string' || text.length > 1500) {
    return res.status(400).json({ error: 'bad_request' });
  }
  if (!['zh-Hans', 'zh-Hant'].includes(target)) return res.status(400).json({ error: 'bad_target' });

  try {
    let out;
    if (engine === 'gemini') {
      const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'; // confirma el nombre vigente en la doc de Google
      const script = target === 'zh-Hant' ? '繁體中文' : '简体中文';
      const prompt =
        `Traduce del español al ${script}. Es parte de un discurso en una capilla de La Iglesia de Jesucristo de los Santos de los Últimos Días. ` +
        `Usa la terminología oficial de la Iglesia en chino (barrio, estaca, obispo, sacramento, Libro de Mormón, etc.). ` +
        `Ignora muletillas y ruido. Responde SOLO con la traducción.\n\n${text}`;
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );
      const d = await r.json();
      out = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    } else {
      const r = await fetch(
        `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=es&to=${target}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': process.env.AZURE_KEY,
            'Ocp-Apim-Subscription-Region': process.env.AZURE_REGION,
          },
          body: JSON.stringify([{ Text: text }]),
        }
      );
      const d = await r.json();
      out = d[0]?.translations?.[0]?.text;
    }
    if (!out) throw new Error('empty');
    res.status(200).json({ text: out });
  } catch (e) {
    res.status(502).json({ error: 'translate_failed' });
  }
};
