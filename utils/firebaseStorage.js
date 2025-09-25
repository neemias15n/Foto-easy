/**␊
 * Sistema de Upload para Firebase Storage com fallback para ImgBB
 * Resolve problemas de CORS em desenvolvimento local e gera links públicos
 */

class FirebaseStorageManager {
  constructor() {
    this.isFirebaseAvailable = false;
    this.isStorageAvailable = false;
    this.preferFirebase = true;
    this.imgbbApiKey = '577c2393e14ed016f7e4d05a6cf2ffed';
    this.init();
  }

  async init() {
    try {
      // Verifica se Firebase está disponível
      if (window.firebaseAuth && window.firebaseStorage) {
        this.isFirebaseAvailable = true;
        this.isStorageAvailable = true;
        console.log('✅ Firebase Storage disponível');
      } else {
        console.warn('⚠️ Firebase Storage não disponível, usando ImgBB');
        this.preferFirebase = false;
      }
    } catch (error) {
      console.error('Erro ao inicializar Firebase Storage:', error);
      this.preferFirebase = false;
    }
  }

  /**
   * Salva uma imagem no Firebase Storage ou no banco temporário
   * @param {Blob} blob - Arquivo para upload
   * @param {string} fileName - Nome do arquivo
   * @param {string} folder - Pasta de destino
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} Resultado do upload
   */
  async uploadImage(blob, fileName, folder = 'images', userId = null) {
    if (this.isStorageAvailable && this.preferFirebase && userId) {
      try {
        return await this.uploadToFirebase(blob, fileName, folder, userId);
      } catch (error) {
        console.warn('Erro no Firebase Storage, usando ImgBB como fallback:', error);
        this.preferFirebase = false;
      }
    }

    return await this.uploadToImgbb(blob, fileName);
  }

  /**
   * Upload para Firebase Storage
   */
  async uploadToFirebase(blob, fileName, folder, userId) {
    if (!this.isStorageAvailable) {
      throw new Error('Firebase Storage não disponível');
    }

    try {
      const storagePath = `users/${userId}/${folder}/${fileName}`;
      const storageReference = window.firebaseStorageRef(window.firebaseStorage, storagePath);
      
      // Upload do arquivo
      await window.firebaseUploadBytes(storageReference, blob);
      
      // Obtém URL de download
      const downloadURL = await window.firebaseGetDownloadURL(storageReference);
      
      // Gera uma prévia pequena para UI (evita estourar localStorage)
      const previewDataURL = await this.createPreviewFromBlob(blob, 140);

      return {
        success: true,
        url: downloadURL,
        path: storagePath,
        method: 'firebase',
        fileName: fileName,
        size: blob.size,
        previewDataURL
      };
    } catch (error) {
      console.error('Erro no upload Firebase:', error);
      
      if (error.message.includes('CORS') || error.message.includes('blocked')) {
        console.log('Erro de CORS detectado, ativando fallback para ImgBB');
        this.preferFirebase = false;
      }

      throw error;
    }
  }

      /**
   * Upload para ImgBB (fallback público)
   */
  async uploadToImgbb(blob, fileName) {
    if (!this.imgbbApiKey) {
      throw new Error('Chave da API ImgBB não configurada.');
    }

    const base64 = await this.blobToBase64(blob);
    const formData = new FormData();
    formData.append('image', base64);
    formData.append('name', fileName.replace(/\.[^.]+$/, ''));

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${this.imgbbApiKey}`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`ImgBB respondeu com status ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error?.message || 'Falha ao enviar imagem para ImgBB');
    }

    const previewDataURL = data.data.thumb?.url || data.data.url;

    return {
      success: true,
      url: data.data.url,
      path: data.data.id,
      method: 'imgbb',
      fileName: fileName,
      size: blob.size,
      deleteUrl: data.data.delete_url,
      previewDataURL
    };
  }

  /**
   * Converte Blob para base64 bruto (sem cabeçalho DataURL)
   */
  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result || '';
        const base64 = typeof result === 'string' ? result.split(',').pop() : '';
        resolve(base64 || '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  /**
   * Salva folha 3x4 (com fallback automático)
   */
  async saveSheet3x4(svg, userId) {
    try {
      // Converte SVG para PNG
      const canvas = await this.svgToPngCanvas(svg, 1181, 1772);
      
      return new Promise((resolve, reject) => {
        canvas.toBlob(async (blob) => {
          if (!blob) {
            reject(new Error('Erro ao gerar PNG'));
            return;
          }

          try {
            const fileName = `folha-3x4-${Date.now()}.png`;
            const result = await this.uploadImage(blob, fileName, 'sheets', userId);
            
            // Salva no histórico
            const historyItem = {
              id: Date.now().toString(),
              userId: userId,
              name: `Folha 3x4 (${new Date().toLocaleDateString('pt-BR')})`,
              date: new Date().toISOString(),
              type: 'sheet3x4',
              images: [{
                originalDataURL: result.url,
                fileName: fileName,
                fileSize: blob.size
              }],
              previewDataURL: result.previewDataURL,
              uploadMethod: result.method
            };

            resolve({
              ...result,
              historyItem: historyItem
            });
          } catch (error) {
            reject(error);
          }
        }, 'image/png', 1.0);
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Salva polaroid (com fallback automático)
   */
  async savePolaroid(svg, mode, userId) {
    try {
      const dimensions = mode === 'two' ? { w: 1772, h: 1181 } : { w: 1181, h: 1772 };
      const canvas = await this.svgToPngCanvas(svg, dimensions.w, dimensions.h);
      
      return new Promise((resolve, reject) => {
        canvas.toBlob(async (blob) => {
          if (!blob) {
            reject(new Error('Erro ao gerar PNG'));
            return;
          }

          try {
            const fileName = `polaroid-${mode}-${Date.now()}.png`;
            const result = await this.uploadImage(blob, fileName, 'polaroids', userId);
            
            // Salva no histórico
            const historyItem = {
              id: Date.now().toString(),
              userId: userId,
              name: `Polaroid ${mode === 'two' ? '2x' : '1x'} (${new Date().toLocaleDateString('pt-BR')})`,
              date: new Date().toISOString(),
              type: 'polaroid',
              images: [{
                originalDataURL: result.url,
                fileName: fileName,
                fileSize: blob.size
              }],
              previewDataURL: result.previewDataURL,
              uploadMethod: result.method
            };

            resolve({
              ...result,
              historyItem: historyItem
            });
          } catch (error) {
            reject(error);
          }
        }, 'image/png', 1.0);
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Converte SVG para Canvas PNG
   */
  async svgToPngCanvas(svg, outW, outH) {
    // Embute imagens (emojis, etc.) como data:URL para não sumirem no PNG
    await this.inlineSvgImages(svg);
    
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      const timeout = setTimeout(() => {
        URL.revokeObjectURL(url);
        reject(new Error('Timeout ao carregar SVG'));
      }, 10000);
      
      img.onload = () => {
        try {
          clearTimeout(timeout);
          const canvas = document.createElement('canvas');
          canvas.width = outW;
          canvas.height = outH;
          const ctx = canvas.getContext('2d');
          
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          URL.revokeObjectURL(url);
          resolve(canvas);
        } catch (error) {
          clearTimeout(timeout);
          URL.revokeObjectURL(url);
          reject(error);
        }
      };
      
      img.onerror = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(url);
        reject(new Error('Falha ao carregar SVG'));
      };
      
      img.crossOrigin = 'anonymous';
      img.src = url;
    });
  }

  /**
   * Cria uma prévia pequena (thumbnail) a partir de um Blob PNG
   */
  async createPreviewFromBlob(blob, maxSize = 140) {
    try {
      const imageBitmap = await createImageBitmap(blob);
      const ratio = Math.min(maxSize / imageBitmap.width, maxSize / imageBitmap.height, 1);
      const w = Math.max(1, Math.round(imageBitmap.width * ratio));
      const h = Math.max(1, Math.round(imageBitmap.height * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(imageBitmap, 0, 0, w, h);
      // Usa JPEG de baixa qualidade para reduzir ainda mais o tamanho
      return canvas.toDataURL('image/jpeg', 0.6);
    } catch (e) {
      // Fallback simples: limita o blob original usando qualidade baixa
      try {
        const arrBuf = await blob.arrayBuffer();
        const tmp = new Blob([arrBuf], { type: 'image/png' });
        const dataUrl = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(tmp); });
        return dataUrl;
      } catch {
        return null;
      }
    }
  }

  /**
   * Embute imagens do SVG como data:URL
   */
  async inlineSvgImages(svg) {
    const images = Array.from(svg.querySelectorAll('image'));
    for (const img of images) {
      const href = img.getAttributeNS('http://www.w3.org/1999/xlink','href') || img.getAttribute('href');
      if (!href || href.startsWith('data:')) continue;
      
      try {
        const abs = new URL(href, window.location.href).toString();
        const resp = await fetch(abs);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const blob = await resp.blob();
        const dataUrl = await new Promise(res => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result);
          fr.readAsDataURL(blob);
        });
        img.setAttributeNS('http://www.w3.org/1999/xlink','href', dataUrl);
      } catch (e) {
        console.warn('Falha ao embutir imagem do SVG:', href, e);
      }
    }
  }
}

// Cria instância global
const firebaseStorageManager = new FirebaseStorageManager();

export default firebaseStorageManager;


