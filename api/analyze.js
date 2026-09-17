// Vercel Serverless Function — api/analyze.js
// Usa a API do Google Gemini para analisar imagens de cupons

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { imageBase64, mediaType } = req.body;

  if (!imageBase64 || !mediaType) {
    return res.status(400).json({ error: 'Imagem não fornecida' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chave da API não configurada no servidor' });
  }

  const hoje = new Date().toISOString().split('T')[0];
  const prompt = `Você é um assistente especializado em leitura de cupons fiscais, notas fiscais e recibos brasileiros.
Analise a imagem e extraia as seguintes informações no formato JSON:
{"data":"YYYY-MM-DD ou vazio","descricao":"descrição resumida dos itens","pagamento":"PIX ou Crédito ou Débito ou Dinheiro ou Outro","origem":"Caixa R$500 ou Pagamento direto","valor":numero,"cupom":"número do cupom ou NF-e ou vazio"}
Responda SOMENTE com o JSON, sem markdown nem texto adicional. Data de hoje: ${hoje}`;

  try {
    // Tenta com o novo formato de chave (AQ.) usando o endpoint v1beta com Bearer token
    const isNewFormat = apiKey.startsWith('AQ.');
    
    let url, headers, body;

    if (isNewFormat) {
      // Novo formato — usa Bearer token no header
      url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      };
    } else {
      // Formato antigo — usa API key na URL
      url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      headers = { 'Content-Type': 'application/json' };
    }

    body = JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: mediaType, data: imageBase64 } },
          { text: prompt }
        ]
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 512 }
    });

    const response = await fetch(url, { method: 'POST', headers, body });
    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({ error: 'Erro na API do Gemini', detail: data });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao processar imagem', detail: err.message });
  }
}
