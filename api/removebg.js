export default async function handler(req, res) {
  // Configura CORS para permitir requisições do frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key');

  // Lida com preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Só aceita POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const REMOVE_BG_API_KEY = "DkJUSEQCLDALVvQ8eS3WFzv4";
    
    // Reenvia a requisição para a API remove.bg
    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': REMOVE_BG_API_KEY,
      },
      body: req.body, // Passa o FormData diretamente
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    // Retorna a imagem processada
    const imageBuffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'image/png');
    res.status(200).send(Buffer.from(imageBuffer));

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: error.message });
  }
}
