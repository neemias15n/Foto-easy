/**
 * Sistema de Sincronização de Histórico entre Navegadores
 * Usa Firebase Firestore para sincronizar dados entre dispositivos
 */

class HistorySync {
  constructor() {
    this.db = null;
    this.isFirestoreAvailable = false;
    this.syncInterval = null;
    this.lastSyncTime = null;
    this.init();
  }

  async init() {
    try {
      // Verifica se Firebase Firestore está disponível
      if (window.firebaseFirestore) {
        this.db = window.firebaseFirestore;
        this.isFirestoreAvailable = true;
        console.log('✅ Firebase Firestore disponível para sincronização');
      } else {
        console.warn('⚠️ Firebase Firestore não disponível, usando localStorage');
        this.isFirestoreAvailable = false;
      }
    } catch (error) {
      console.error('Erro ao inicializar sincronização:', error);
      this.isFirestoreAvailable = false;
    }
  }

  /**
   * Salva item no histórico (local + nuvem)
   */
  async saveHistoryItem(item, userId) {
    try {
      // Salva localmente primeiro
      this.saveToLocalStorage(item, userId);
      
      // Se Firestore estiver disponível, salva na nuvem também
      if (this.isFirestoreAvailable && userId) {
        await this.saveToFirestore(item, userId);
      }
      
      console.log('✅ Item salvo no histórico (local + nuvem)');
    } catch (error) {
      console.error('Erro ao salvar no histórico:', error);
      // Se falhar na nuvem, pelo menos salva localmente
      this.saveToLocalStorage(item, userId);
    }
  }

  /**
   * Salva no localStorage
   */
  saveToLocalStorage(item, userId) {
    const userHistory = JSON.parse(localStorage.getItem(`photoHistory_${userId}`) || '[]');
    // Compacta item para armazenar só metadados + preview pequeno
    const compactItem = {
      id: item.id,
      userId: item.userId,
      name: item.name,
      date: item.date,
      type: item.type,
      // guarda a primeira imagem só como metadado (URL) e usa previewDataURL pequeno
      images: item.images && item.images.length ? [{
        fileName: item.images[0].fileName,
        fileSize: item.images[0].fileSize,
        originalDataURL: undefined,
        workingDataURL: undefined
      }] : [],
      previewDataURL: item.previewDataURL || null,
      uploadMethod: item.uploadMethod,
      syncedAt: item.syncedAt
    };
    userHistory.unshift(compactItem);
    
    // Mantém apenas os últimos 20 itens
    if (userHistory.length > 20) {
      userHistory.splice(20);
    }
    
    // Protege contra quota exceeded
    try {
      localStorage.setItem(`photoHistory_${userId}`, JSON.stringify(userHistory));
    } catch (e) {
      // Se estourar, remove o item mais antigo e tenta novamente
      userHistory.pop();
      try { localStorage.setItem(`photoHistory_${userId}`, JSON.stringify(userHistory)); } catch {}
    }
  }

  /**
   * Salva no Firestore
   */
  async saveToFirestore(item, userId) {
    if (!this.isFirestoreAvailable || !userId) return;

    try {
      const historyRef = this.db.collection('users').doc(userId).collection('history');
      
      // Adiciona timestamp de sincronização
      const itemWithSync = {
        ...item,
        syncedAt: new Date().toISOString(),
        syncId: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
      
      await historyRef.add(itemWithSync);
      console.log('✅ Item salvo no Firestore');
    } catch (error) {
      console.error('Erro ao salvar no Firestore:', error);
      throw error;
    }
  }

  /**
   * Carrega histórico (local + nuvem)
   */
  async loadHistory(userId) {
    try {
      let localHistory = this.loadFromLocalStorage(userId);
      
      if (this.isFirestoreAvailable && userId) {
        try {
          const cloudHistory = await this.loadFromFirestore(userId);
          // Mescla históricos local e nuvem
          localHistory = this.mergeHistories(localHistory, cloudHistory);
          // Salva o histórico mesclado localmente
          localStorage.setItem(`photoHistory_${userId}`, JSON.stringify(localHistory));
        } catch (error) {
          console.warn('Erro ao carregar do Firestore, usando apenas local:', error);
        }
      }
      
      return localHistory;
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      return this.loadFromLocalStorage(userId);
    }
  }

  /**
   * Carrega do localStorage
   */
  loadFromLocalStorage(userId) {
    return JSON.parse(localStorage.getItem(`photoHistory_${userId}`) || '[]');
  }

  /**
   * Carrega do Firestore
   */
  async loadFromFirestore(userId) {
    if (!this.isFirestoreAvailable || !userId) return [];

    try {
      const historyRef = this.db.collection('users').doc(userId).collection('history');
      const snapshot = await historyRef.orderBy('date', 'desc').limit(20).get();
      
      const history = [];
      snapshot.forEach(doc => {
        history.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      console.log(`✅ ${history.length} itens carregados do Firestore`);
      return history;
    } catch (error) {
      console.error('Erro ao carregar do Firestore:', error);
      return [];
    }
  }

  /**
   * Mescla históricos local e nuvem
   */
  mergeHistories(localHistory, cloudHistory) {
    // Cria um mapa para evitar duplicatas
    const historyMap = new Map();
    
    // Adiciona itens locais
    localHistory.forEach(item => {
      const key = item.id || `${item.date}_${item.name}`;
      historyMap.set(key, item);
    });
    
    // Adiciona itens da nuvem (sobrescreve se for mais recente)
    cloudHistory.forEach(item => {
      const key = item.id || `${item.date}_${item.name}`;
      const existing = historyMap.get(key);
      
      if (!existing || new Date(item.date) > new Date(existing.date)) {
        historyMap.set(key, item);
      }
    });
    
    // Converte de volta para array e ordena por data
    const merged = Array.from(historyMap.values());
    merged.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Mantém apenas os últimos 20
    return merged.slice(0, 20);
  }

  /**
   * Inicia sincronização automática
   */
  startAutoSync(userId) {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    // Sincroniza a cada 30 segundos
    this.syncInterval = setInterval(async () => {
      try {
        await this.syncHistory(userId);
      } catch (error) {
        console.warn('Erro na sincronização automática:', error);
      }
    }, 30000);
    
    console.log('🔄 Sincronização automática iniciada');
  }

  /**
   * Para sincronização automática
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    console.log('⏹️ Sincronização automática parada');
  }

  /**
   * Sincroniza histórico manualmente
   */
  async syncHistory(userId) {
    if (!userId) return;
    
    try {
      console.log('🔄 Iniciando sincronização...');
      
      // Carrega histórico atualizado
      const history = await this.loadHistory(userId);
      
      // Atualiza timestamp da última sincronização
      this.lastSyncTime = new Date().toISOString();
      localStorage.setItem(`lastSync_${userId}`, this.lastSyncTime);
      
      console.log('✅ Sincronização concluída');
      return history;
    } catch (error) {
      console.error('Erro na sincronização:', error);
      throw error;
    }
  }

  /**
   * Remove item do histórico (local + nuvem)
   */
  async deleteHistoryItem(itemId, userId) {
    try {
      // Remove localmente
      this.deleteFromLocalStorage(itemId, userId);
      
      // Remove da nuvem se disponível
      if (this.isFirestoreAvailable && userId) {
        await this.deleteFromFirestore(itemId, userId);
      }
      
      console.log('✅ Item removido do histórico');
    } catch (error) {
      console.error('Erro ao remover item:', error);
    }
  }

  /**
   * Remove do localStorage
   */
  deleteFromLocalStorage(itemId, userId) {
    const userHistory = JSON.parse(localStorage.getItem(`photoHistory_${userId}`) || '[]');
    const filtered = userHistory.filter(item => item.id !== itemId);
    localStorage.setItem(`photoHistory_${userId}`, JSON.stringify(filtered));
  }

  /**
   * Remove do Firestore
   */
  async deleteFromFirestore(itemId, userId) {
    if (!this.isFirestoreAvailable || !userId) return;

    try {
      const historyRef = this.db.collection('users').doc(userId).collection('history');
      await historyRef.doc(itemId).delete();
      console.log('✅ Item removido do Firestore');
    } catch (error) {
      console.error('Erro ao remover do Firestore:', error);
    }
  }

  /**
   * Obtém estatísticas de sincronização
   */
  getSyncStats(userId) {
    const lastSync = localStorage.getItem(`lastSync_${userId}`);
    const localCount = this.loadFromLocalStorage(userId).length;
    
    return {
      isFirestoreAvailable: this.isFirestoreAvailable,
      lastSyncTime: lastSync,
      localItemCount: localCount,
      autoSyncActive: !!this.syncInterval
    };
  }

  /**
   * Força sincronização completa
   */
  async forceFullSync(userId) {
    if (!userId) return;
    
    try {
      console.log('🔄 Forçando sincronização completa...');
      
      // Limpa cache local
      localStorage.removeItem(`photoHistory_${userId}`);
      
      // Recarrega tudo da nuvem
      const history = await this.loadHistory(userId);
      
      console.log('✅ Sincronização completa concluída');
      return history;
    } catch (error) {
      console.error('Erro na sincronização completa:', error);
      throw error;
    }
  }
}

// Cria instância global
const historySync = new HistorySync();

export default historySync;

