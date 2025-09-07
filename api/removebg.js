export default async function handler(req, res) {
  // Configura CORS para permitir requisições do frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
    const { imageData, fileName } = req.body;
    
    if (!imageData) {
      res.status(400).json({ error: 'No image data provided' });
      return;
    }

    // Converte base64 para buffer
    const base64Data = imageData.split(',')[1];
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Cria FormData para a API remove.bg
    const formData = new FormData();
    formData.append('image_file', new Blob([imageBuffer]), fileName || 'image.png');
    formData.append('size', 'auto');
    
    // Reenvia a requisição para a API remove.bg
    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': REMOVE_BG_API_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    // Retorna a imagem processada
    const resultBuffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'image/png');
    res.status(200).send(Buffer.from(resultBuffer));

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: error.message });
  }
}
