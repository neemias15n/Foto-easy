/**
 * Funções auxiliares para o banco de dados temporário
 * Facilita o uso do sistema de armazenamento temporário
 */

import tempDB from './tempDatabase.js';

// ===== FUNÇÕES PARA FOTOS =====

/**
 * Salva as fotos atuais no banco temporário
 * @param {Array} images - Array de imagens do editor
 * @param {string} userId - ID do usuário (opcional)
 * @returns {Promise<string>} ID da sessão salva
 */
export async function saveCurrentPhotosToTemp(images, userId = null) {
  try {
    if (!images || images.length === 0) {
      throw new Error('Nenhuma foto para salvar');
    }

    // Prepara os dados das fotos para salvar
    const photosData = images.map(img => ({
      id: img.id,
      originalDataURL: img.originalDataURL,
      workingDataURL: img.workingDataURL,
      fileName: img.fileName,
      fileSize: img.fileSize,
      currentIndex: images.indexOf(img) === currentImageIndex
    }));

    const sessionId = await tempDB.saveTempPhotos(photosData, userId);
    
    console.log(`✅ ${images.length} foto(s) salva(s) temporariamente (ID: ${sessionId})`);
    return sessionId;
  } catch (error) {
    console.error('Erro ao salvar fotos temporariamente:', error);
    throw error;
  }
}

/**
 * Carrega fotos do banco temporário
 * @param {string} sessionId - ID da sessão
 * @returns {Promise<Array>} Array de imagens carregadas
 */
export async function loadPhotosFromTemp(sessionId) {
  try {
    const photoData = await tempDB.getTempPhotos(sessionId);
    
    if (!photoData) {
      throw new Error('Sessão não encontrada ou expirada');
    }

    console.log(`✅ ${photoData.photos.length} foto(s) carregada(s) da sessão ${sessionId}`);
    return photoData.photos;
  } catch (error) {
    console.error('Erro ao carregar fotos temporárias:', error);
    throw error;
  }
}

/**
 * Lista todas as sessões de fotos temporárias
 * @param {string} userId - ID do usuário (opcional)
 * @returns {Promise<Array>} Lista de sessões
 */
export async function listTempPhotoSessions(userId = null) {
  try {
    const sessions = await tempDB.listTempPhotos(userId);
    
    // Adiciona informações úteis para exibição
    const sessionsWithInfo = sessions.map(session => ({
      ...session,
      photoCount: session.photos.length,
      timeRemaining: Math.max(0, session.expiresAt - Date.now()),
      timeRemainingHours: Math.max(0, Math.floor((session.expiresAt - Date.now()) / (1000 * 60 * 60))),
      isExpired: tempDB.isExpired(session)
    }));

    return sessionsWithInfo;
  } catch (error) {
    console.error('Erro ao listar sessões temporárias:', error);
    throw error;
  }
}

// ===== FUNÇÕES PARA CONFIGURAÇÕES =====

/**
 * Salva configurações temporárias
 * @param {string} key - Chave da configuração
 * @param {any} value - Valor da configuração
 * @param {string} userId - ID do usuário (opcional)
 */
export async function saveTempSetting(key, value, userId = null) {
  try {
    await tempDB.saveTempSetting(key, value, userId);
    console.log(`✅ Configuração '${key}' salva temporariamente`);
  } catch (error) {
    console.error('Erro ao salvar configuração temporária:', error);
    throw error;
  }
}

/**
 * Recupera configuração temporária
 * @param {string} key - Chave da configuração
 * @returns {Promise<any>} Valor da configuração
 */
export async function getTempSetting(key) {
  try {
    const value = await tempDB.getTempSetting(key);
    return value;
  } catch (error) {
    console.error('Erro ao recuperar configuração temporária:', error);
    throw error;
  }
}

// ===== FUNÇÕES PARA HISTÓRICO =====

/**
 * Salva item no histórico temporário
 * @param {Object} item - Item a ser salvo
 * @param {string} userId - ID do usuário (opcional)
 * @returns {Promise<string>} ID do item salvo
 */
export async function saveToTempHistory(item, userId = null) {
  try {
    const itemId = await tempDB.saveTempHistoryItem(item, userId);
    console.log(`✅ Item salvo no histórico temporário (ID: ${itemId})`);
    return itemId;
  } catch (error) {
    console.error('Erro ao salvar no histórico temporário:', error);
    throw error;
  }
}

/**
 * Lista histórico temporário
 * @param {string} userId - ID do usuário (opcional)
 * @returns {Promise<Array>} Lista de itens do histórico
 */
export async function listTempHistory(userId = null) {
  try {
    const history = await tempDB.listTempHistory(userId);
    
    // Adiciona informações úteis para exibição
    const historyWithInfo = history.map(item => ({
      ...item,
      timeRemaining: Math.max(0, item.expiresAt - Date.now()),
      timeRemainingHours: Math.max(0, Math.floor((item.expiresAt - Date.now()) / (1000 * 60 * 60))),
      isExpired: tempDB.isExpired(item)
    }));

    return historyWithInfo;
  } catch (error) {
    console.error('Erro ao listar histórico temporário:', error);
    throw error;
  }
}

// ===== FUNÇÕES DE UTILIDADE =====

/**
 * Remove item específico do banco temporário
 * @param {string} storeName - Nome da store ('tempPhotos', 'tempSettings', 'tempHistory')
 * @param {string} id - ID do item
 */
export async function deleteTempItem(storeName, id) {
  try {
    await tempDB.deleteItem(storeName, id);
    console.log(`✅ Item ${id} removido da store ${storeName}`);
  } catch (error) {
    console.error('Erro ao remover item temporário:', error);
    throw error;
  }
}

/**
 * Limpa todos os dados temporários
 */
export async function clearAllTempData() {
  try {
    await tempDB.clearAllTempData();
    console.log('✅ Todos os dados temporários foram limpos');
  } catch (error) {
    console.error('Erro ao limpar dados temporários:', error);
    throw error;
  }
}

/**
 * Obtém estatísticas do banco temporário
 * @returns {Promise<Object>} Estatísticas do banco
 */
export async function getTempDatabaseStats() {
  try {
    const stats = await tempDB.getStats();
    return stats;
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    throw error;
  }
}

/**
 * Formata tempo restante em formato legível
 * @param {number} milliseconds - Milissegundos restantes
 * @returns {string} Tempo formatado
 */
export function formatTimeRemaining(milliseconds) {
  if (milliseconds <= 0) return 'Expirado';
  
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m restantes`;
  } else {
    return `${minutes}m restantes`;
  }
}

/**
 * Verifica se o banco de dados está disponível
 * @returns {boolean} True se disponível
 */
export function isDatabaseAvailable() {
  return 'indexedDB' in window;
}

/**
 * Salva automaticamente as fotos atuais (função de conveniência)
 * @param {Array} images - Array de imagens
 * @param {string} userId - ID do usuário
 * @param {boolean} showAlert - Se deve mostrar alerta de sucesso
 */
export async function autoSavePhotos(images, userId = null, showAlert = true) {
  try {
    const sessionId = await saveCurrentPhotosToTemp(images, userId);
    
    if (showAlert) {
      alert(`✅ Fotos salvas temporariamente!\nID da sessão: ${sessionId}\nExpira em 24 horas.`);
    }
    
    return sessionId;
  } catch (error) {
    console.error('Erro no auto-save:', error);
    if (showAlert) {
      alert('❌ Erro ao salvar fotos temporariamente: ' + error.message);
    }
    throw error;
  }
}

/**
 * Carrega automaticamente fotos de uma sessão (função de conveniência)
 * @param {string} sessionId - ID da sessão
 * @param {boolean} showAlert - Se deve mostrar alerta de sucesso
 */
export async function autoLoadPhotos(sessionId, showAlert = true) {
  try {
    const photos = await loadPhotosFromTemp(sessionId);
    
    if (showAlert) {
      alert(`✅ ${photos.length} foto(s) carregada(s) da sessão temporária!`);
    }
    
    return photos;
  } catch (error) {
    console.error('Erro no auto-load:', error);
    if (showAlert) {
      alert('❌ Erro ao carregar fotos temporárias: ' + error.message);
    }
    throw error;
  }
}

// ===== FUNÇÕES DE CONFIGURAÇÃO ESPECÍFICAS =====

/**
 * Salva configurações do editor temporariamente
 * @param {Object} settings - Configurações do editor
 * @param {string} userId - ID do usuário
 */
export async function saveEditorSettings(settings, userId = null) {
  const editorSettings = {
    zoom: settings.zoom || 1,
    tx: settings.tx || 0,
    ty: settings.ty || 0,
    bgColor: settings.bgColor || '#ffffff',
    currentImageIndex: settings.currentImageIndex || 0
  };
  
  await saveTempSetting('editorSettings', editorSettings, userId);
}

/**
 * Recupera configurações do editor
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object>} Configurações do editor
 */
export async function getEditorSettings(userId = null) {
  const settings = await getTempSetting('editorSettings');
  return settings || {
    zoom: 1,
    tx: 0,
    ty: 0,
    bgColor: '#ffffff',
    currentImageIndex: 0
  };
}

/**
 * Salva configurações de polaroid temporariamente
 * @param {Object} settings - Configurações da polaroid
 * @param {string} userId - ID do usuário
 */
export async function savePolaroidSettings(settings, userId = null) {
  const polaroidSettings = {
    mode: settings.mode || 'two',
    txt1: settings.txt1 || '',
    txt2: settings.txt2 || '',
    txtSize: settings.txtSize || 300,
    txtFont: settings.txtFont || 'Dancing Script, cursive',
    txtAlign: settings.txtAlign || 'center',
    txtUpper: settings.txtUpper || false,
    emojiSize: settings.emojiSize || 400,
    spBg: settings.spBg || '#7C3AED',
    spFg: settings.spFg || 'black'
  };
  
  await saveTempSetting('polaroidSettings', polaroidSettings, userId);
}

/**
 * Recupera configurações de polaroid
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object>} Configurações da polaroid
 */
export async function getPolaroidSettings(userId = null) {
  const settings = await getTempSetting('polaroidSettings');
  return settings || {
    mode: 'two',
    txt1: '',
    txt2: '',
    txtSize: 300,
    txtFont: 'Dancing Script, cursive',
    txtAlign: 'center',
    txtUpper: false,
    emojiSize: 400,
    spBg: '#7C3AED',
    spFg: 'black'
  };
}





