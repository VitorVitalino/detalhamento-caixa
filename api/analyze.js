// Vercel Serverless Function — api/analyze.js
// Recebe a imagem do frontend, chama a API Anthropic no servidor
// A chave ANTHROPIC_API_KEY fica nas variáveis de ambiente do Vercel (nunca no código)

export default async function handler(req, res) {
  // Permitir apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // CORS — permite o site chamar esta função
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { imageBase64, mediaType } = req.body;

  if (!imageBase64 || !mediaType) {
    return res.status(400).json({ error: 'Imagem não fornecida' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chave da API não configurada no servidor' });
  }

  const hoje = new Date().toISOString().split('T')[0];
  const prompt = `Você é um assistente especializado em leitura de cupons fiscais, notas fiscais e recibos brasileiros.
Analise a imagem e extraia as seguintes informações no formato JSON:
{"data":"YYYY-MM-DD ou vazio","descricao":"descrição resumida dos itens","pagamento":"PIX ou Crédito ou Débito ou Dinheiro ou Outro","origem":"Caixa R$500 ou Pagamento direto","valor":numero,"cupom":"número do cupom ou NF-e ou vazio"}
Responda SOMENTE com o JSON, sem markdown nem texto adicional. Data de hoje: ${hoje}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({ error: 'Erro na API de IA', detail: data });
    }

    const text = data.content?.map(c => c.text || '').join('');
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao processar imagem', detail: err.message });
  }
}
