/**
 * Sistema de Banco de Dados Temporário de 24 horas
 * Usa IndexedDB para armazenar dados localmente com expiração automática
 */

class TempDatabase {
  constructor() {
    this.dbName = 'FotoEasyTempDB';
    this.dbVersion = 1;
    this.db = null;
    this.expirationTime = 24 * 60 * 60 * 1000; // 24 horas em milissegundos
  }

  // Inicializa o banco de dados
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Erro ao abrir banco de dados:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('Banco de dados temporário inicializado');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Cria a store para fotos temporárias
        if (!db.objectStoreNames.contains('tempPhotos')) {
          const photoStore = db.createObjectStore('tempPhotos', { keyPath: 'id' });
          photoStore.createIndex('expiresAt', 'expiresAt', { unique: false });
          photoStore.createIndex('userId', 'userId', { unique: false });
        }

        // Cria a store para configurações temporárias
        if (!db.objectStoreNames.contains('tempSettings')) {
          const settingsStore = db.createObjectStore('tempSettings', { keyPath: 'key' });
          settingsStore.createIndex('expiresAt', 'expiresAt', { unique: false });
        }

        // Cria a store para histórico temporário
        if (!db.objectStoreNames.contains('tempHistory')) {
          const historyStore = db.createObjectStore('tempHistory', { keyPath: 'id' });
          historyStore.createIndex('expiresAt', 'expiresAt', { unique: false });
          historyStore.createIndex('userId', 'userId', { unique: false });
        }

        console.log('Estrutura do banco de dados criada');
      };
    });
  }

  // Gera um ID único
  generateId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  // Calcula o tempo de expiração
  getExpirationTime() {
    return Date.now() + this.expirationTime;
  }

  // Verifica se um item expirou
  isExpired(item) {
    return Date.now() > item.expiresAt;
  }

  // Remove itens expirados
  async cleanupExpired() {
    if (!this.db) return;

    const stores = ['tempPhotos', 'tempSettings', 'tempHistory'];
    
    for (const storeName of stores) {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const index = store.index('expiresAt');
      const range = IDBKeyRange.upperBound(Date.now());
      
      const request = index.openCursor(range);
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        }
      };
    }
  }

  // Salva fotos temporárias
  async saveTempPhotos(photos, userId = null) {
    if (!this.db) await this.init();

    const transaction = this.db.transaction(['tempPhotos'], 'readwrite');
    const store = transaction.objectStore('tempPhotos');

    const photoData = {
      id: this.generateId(),
      photos: photos,
      userId: userId,
      createdAt: new Date().toISOString(),
      expiresAt: this.getExpirationTime()
    };

    return new Promise((resolve, reject) => {
      const request = store.add(photoData);
      
      request.onsuccess = () => {
        console.log('Fotos salvas temporariamente:', photoData.id);
        resolve(photoData.id);
      };
      
      request.onerror = () => {
        console.error('Erro ao salvar fotos:', request.error);
        reject(request.error);
      };
    });
  }

  // Recupera fotos temporárias
  async getTempPhotos(photoId) {
    if (!this.db) await this.init();

    const transaction = this.db.transaction(['tempPhotos'], 'readonly');
    const store = transaction.objectStore('tempPhotos');

    return new Promise((resolve, reject) => {
      const request = store.get(photoId);
      
      request.onsuccess = () => {
        const result = request.result;
        if (result && !this.isExpired(result)) {
          resolve(result);
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => {
        console.error('Erro ao recuperar fotos:', request.error);
        reject(request.error);
      };
    });
  }

  // Lista todas as fotos temporárias do usuário
  async listTempPhotos(userId = null) {
    if (!this.db) await this.init();

    const transaction = this.db.transaction(['tempPhotos'], 'readonly');
    const store = transaction.objectStore('tempPhotos');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        let results = request.result;
        
        // Filtra por usuário se especificado
        if (userId) {
          results = results.filter(item => item.userId === userId);
        }
        
        // Remove itens expirados
        results = results.filter(item => !this.isExpired(item));
        
        // Ordena por data de criação (mais recentes primeiro)
        results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        resolve(results);
      };
      
      request.onerror = () => {
        console.error('Erro ao listar fotos:', request.error);
        reject(request.error);
      };
    });
  }

  // Salva configurações temporárias
  async saveTempSetting(key, value, userId = null) {
    if (!this.db) await this.init();

    const transaction = this.db.transaction(['tempSettings'], 'readwrite');
    const store = transaction.objectStore('tempSettings');

    const settingData = {
      key: key,
      value: value,
      userId: userId,
      createdAt: new Date().toISOString(),
      expiresAt: this.getExpirationTime()
    };

    return new Promise((resolve, reject) => {
      const request = store.put(settingData);
      
      request.onsuccess = () => {
        console.log('Configuração salva temporariamente:', key);
        resolve();
      };
      
      request.onerror = () => {
        console.error('Erro ao salvar configuração:', request.error);
        reject(request.error);
      };
    });
  }

  // Recupera configuração temporária
  async getTempSetting(key) {
    if (!this.db) await this.init();

    const transaction = this.db.transaction(['tempSettings'], 'readonly');
    const store = transaction.objectStore('tempSettings');

    return new Promise((resolve, reject) => {
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        if (result && !this.isExpired(result)) {
          resolve(result.value);
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => {
        console.error('Erro ao recuperar configuração:', request.error);
        reject(request.error);
      };
    });
  }

  // Salva item no histórico temporário
  async saveTempHistoryItem(item, userId = null) {
    if (!this.db) await this.init();

    const transaction = this.db.transaction(['tempHistory'], 'readwrite');
    const store = transaction.objectStore('tempHistory');

    const historyData = {
      id: this.generateId(),
      ...item,
      userId: userId,
      createdAt: new Date().toISOString(),
      expiresAt: this.getExpirationTime()
    };

    return new Promise((resolve, reject) => {
      const request = store.add(historyData);
      
      request.onsuccess = () => {
        console.log('Item salvo no histórico temporário:', historyData.id);
        resolve(historyData.id);
      };
      
      request.onerror = () => {
        console.error('Erro ao salvar no histórico:', request.error);
        reject(request.error);
      };
    });
  }

  // Lista histórico temporário
  async listTempHistory(userId = null) {
    if (!this.db) await this.init();

    const transaction = this.db.transaction(['tempHistory'], 'readonly');
    const store = transaction.objectStore('tempHistory');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        let results = request.result;
        
        // Filtra por usuário se especificado
        if (userId) {
          results = results.filter(item => item.userId === userId);
        }
        
        // Remove itens expirados
        results = results.filter(item => !this.isExpired(item));
        
        // Ordena por data de criação (mais recentes primeiro)
        results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        resolve(results);
      };
      
      request.onerror = () => {
        console.error('Erro ao listar histórico:', request.error);
        reject(request.error);
      };
    });
  }

  // Remove item específico
  async deleteItem(storeName, id) {
    if (!this.db) await this.init();

    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      
      request.onsuccess = () => {
        console.log('Item removido:', id);
        resolve();
      };
      
      request.onerror = () => {
        console.error('Erro ao remover item:', request.error);
        reject(request.error);
      };
    });
  }

  // Limpa todos os dados temporários
  async clearAllTempData() {
    if (!this.db) await this.init();

    const stores = ['tempPhotos', 'tempSettings', 'tempHistory'];
    
    for (const storeName of stores) {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      await new Promise((resolve, reject) => {
        const request = store.clear();
        
        request.onsuccess = () => {
          console.log(`Store ${storeName} limpa`);
          resolve();
        };
        
        request.onerror = () => {
          console.error(`Erro ao limpar store ${storeName}:`, request.error);
          reject(request.error);
        };
      });
    }
  }

  // Obtém estatísticas do banco
  async getStats() {
    if (!this.db) await this.init();

    const stats = {
      tempPhotos: 0,
      tempSettings: 0,
      tempHistory: 0,
      expiredItems: 0
    };

    const stores = ['tempPhotos', 'tempSettings', 'tempHistory'];
    
    for (const storeName of stores) {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      
      const count = await new Promise((resolve, reject) => {
        const request = store.count();
        
        request.onsuccess = () => {
          resolve(request.result);
        };
        
        request.onerror = () => {
          reject(request.error);
        };
      });

      stats[storeName] = count;
    }

    // Conta itens expirados
    const allItems = await Promise.all([
      this.listTempPhotos(),
      this.listTempHistory()
    ]);

    const allPhotos = allItems[0];
    const allHistory = allItems[1];
    
    stats.expiredItems = (allPhotos.length + allHistory.length) - 
      (allPhotos.filter(item => !this.isExpired(item)).length + 
       allHistory.filter(item => !this.isExpired(item)).length);

    return stats;
  }
}

// Cria instância global
const tempDB = new TempDatabase();

// Inicializa automaticamente
tempDB.init().then(() => {
  console.log('Banco de dados temporário pronto');
  // Limpa itens expirados na inicialização
  tempDB.cleanupExpired();
}).catch(error => {
  console.error('Erro ao inicializar banco de dados temporário:', error);
});

// Limpa itens expirados a cada hora
setInterval(() => {
  tempDB.cleanupExpired();
}, 60 * 60 * 1000);

export default tempDB;






