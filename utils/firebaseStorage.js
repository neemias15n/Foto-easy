/**
 * Sistema de Upload para Firebase Storage com Fallback para Banco Temporário
 * Resolve problemas de CORS em desenvolvimento local
 */

import { 
  saveCurrentPhotosToTemp, 
  saveToTempHistory,
  getTempDatabaseStats 
} from './databaseHelpers.js';

class FirebaseStorageManager {
  constructor() {
    this.isFirebaseAvailable = false;
    this.isStorageAvailable = false;
    this.fallbackToTempDB = true;
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
        console.warn('⚠️ Firebase Storage não disponível, usando banco temporário');
        this.fallbackToTempDB = true;
      }
    } catch (error) {
      console.error('Erro ao inicializar Firebase Storage:', error);
      this.fallbackToTempDB = true;
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
    try {
      // Tenta Firebase Storage primeiro
      if (this.isStorageAvailable && !this.fallbackToTempDB) {
        return await this.uploadToFirebase(blob, fileName, folder, userId);
      } else {
        // Fallback para banco temporário
        return await this.uploadToTempDB(blob, fileName, folder, userId);
      }
    } catch (error) {
      console.error('Erro no upload:', error);
      
      // Se Firebase falhar, tenta banco temporário
      if (this.isStorageAvailable && !this.fallbackToTempDB) {
        console.log('Firebase falhou, usando banco temporário como fallback');
        this.fallbackToTempDB = true;
        return await this.uploadToTempDB(blob, fileName, folder, userId);
      }
      
      throw error;
    }
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
      
      return {
        success: true,
        url: downloadURL,
        path: storagePath,
        method: 'firebase',
        fileName: fileName,
        size: blob.size
      };
    } catch (error) {
      console.error('Erro no upload Firebase:', error);
      
      // Se for erro de CORS, marca para usar fallback
      if (error.message.includes('CORS') || error.message.includes('blocked')) {
        console.log('Erro de CORS detectado, ativando fallback');
        this.fallbackToTempDB = true;
      }
      
      throw error;
    }
  }

  /**
   * Upload para banco temporário (fallback)
   */
  async uploadToTempDB(blob, fileName, folder, userId) {
    try {
      // Converte blob para DataURL
      const dataURL = await this.blobToDataURL(blob);
      
      // Cria item do histórico
      const historyItem = {
        type: 'uploaded_image',
        folder: folder,
        fileName: fileName,
        dataURL: dataURL,
        size: blob.size,
        uploadedAt: new Date().toISOString()
      };
      
      // Salva no histórico temporário
      const itemId = await saveToTempHistory(historyItem, userId);
      
      return {
        success: true,
        url: dataURL,
        path: `temp/${itemId}`,
        method: 'tempdb',
        fileName: fileName,
        size: blob.size,
        itemId: itemId
      };
    } catch (error) {
      console.error('Erro no upload para banco temporário:', error);
      throw error;
    }
  }

  /**
   * Converte Blob para DataURL
   */
  blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
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

  /**
   * Obtém estatísticas do sistema de upload
   */
  async getUploadStats() {
    const tempStats = await getTempDatabaseStats();
    
    return {
      firebaseAvailable: this.isStorageAvailable,
      fallbackActive: this.fallbackToTempDB,
      tempDatabaseStats: tempStats,
      uploadMethod: this.fallbackToTempDB ? 'Banco Temporário' : 'Firebase Storage'
    };
  }

  /**
   * Força o uso do banco temporário
   */
  forceTempDB() {
    this.fallbackToTempDB = true;
    console.log('Forçando uso do banco temporário');
  }

  /**
   * Tenta reativar Firebase Storage
   */
  async tryFirebaseAgain() {
    try {
      if (window.firebaseAuth && window.firebaseStorage) {
        this.isStorageAvailable = true;
        this.fallbackToTempDB = false;
        console.log('✅ Firebase Storage reativado');
        return true;
      }
    } catch (error) {
      console.error('Erro ao reativar Firebase:', error);
    }
    return false;
  }
}

// Cria instância global
const firebaseStorageManager = new FirebaseStorageManager();

export default firebaseStorageManager;
