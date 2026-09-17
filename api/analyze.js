// Vercel Serverless Function — api/analyze.js
// Usa a API da OpenAI (GPT-4o) para analisar imagens de cupons

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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chave da API não configurada no servidor' });
  }

  const hoje = new Date().toISOString().split('T')[0];
  const prompt = `Você é um assistente especializado em leitura de cupons fiscais, notas fiscais e recibos brasileiros.
Analise a imagem e extraia as seguintes informações no formato JSON:
{"data":"YYYY-MM-DD ou vazio","descricao":"descrição resumida dos itens","pagamento":"PIX ou Crédito ou Débito ou Dinheiro ou Outro","origem":"Caixa R$500 ou Pagamento direto","valor":numero,"cupom":"número do cupom ou NF-e ou vazio"}
Responda SOMENTE com o JSON, sem markdown nem texto adicional. Data de hoje: ${hoje}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mediaType};base64,${imageBase64}` } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({ error: 'Erro na API da OpenAI', detail: data });
    }

    const text = data.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao processar imagem', detail: err.message });
  }
}
