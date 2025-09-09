/**
 * Google Sheets Integration
 * Gerencia dados de usuários e histórico de fotos via Google Sheets
 */

class GoogleSheetsManager {
    constructor() {
        // URL do Web App do Google Apps Script
        this.webAppUrl = 'https://script.google.com/macros/s/AKfycbwBLXg3Xg8Wmgf8-8pN88XMAxhnyM88vpPBlWEnzvIsOS0P1wuwlN5V9Y1b7j__nqWE/exec';
        this.spreadsheetId = '1cSqiVdZcM5zdjBAxg1q8-zeW-KhYJ1lC6CUg3nZdD-g';
    }

    /**
     * Salva dados do usuário no Google Sheets
     */
    async saveUser(userData) {
        try {
            const response = await fetch(this.webAppUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'saveUser',
                    userId: userData.uid,
                    email: userData.email,
                    createdAt: new Date().toISOString(),
                    lastLoginAt: new Date().toISOString()
                })
            });

            const result = await response.json();
            return result.ok;
        } catch (error) {
            console.error('Erro ao salvar usuário no Google Sheets:', error);
            return false;
        }
    }

    /**
     * Salva item do histórico no Google Sheets
     */
    async saveHistoryItem(historyItem) {
        try {
            const response = await fetch(this.webAppUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'saveHistory',
                    id: historyItem.id,
                    userId: historyItem.userId,
                    type: historyItem.type,
                    name: historyItem.name,
                    date: historyItem.date,
                    uploadMethod: historyItem.uploadMethod,
                    previewDataURL: historyItem.previewDataURL || '',
                    fileName: historyItem.fileName || '',
                    fileSize: historyItem.fileSize || 0,
                    fileURL: historyItem.fileURL || ''
                })
            });

            const result = await response.json();
            return result.ok;
        } catch (error) {
            console.error('Erro ao salvar histórico no Google Sheets:', error);
            return false;
        }
    }

    /**
     * Carrega histórico do usuário do Google Sheets
     */
    async loadUserHistory(userId) {
        try {
            const url = `${this.webAppUrl}?action=listHistory&userId=${encodeURIComponent(userId)}`;
            const response = await fetch(url);
            const result = await response.json();
            
            if (result.ok) {
                return result.data || [];
            }
            return [];
        } catch (error) {
            console.error('Erro ao carregar histórico do Google Sheets:', error);
            return [];
        }
    }

    /**
     * Lista todos os usuários (para admin)
     */
    async listUsers() {
        try {
            const url = `${this.webAppUrl}?action=listUsers`;
            const response = await fetch(url);
            const result = await response.json();
            
            if (result.ok) {
                return result.data || [];
            }
            return [];
        } catch (error) {
            console.error('Erro ao listar usuários do Google Sheets:', error);
            return [];
        }
    }

    /**
     * Atualiza URL do Web App (chamado quando o Apps Script for criado)
     */
    setWebAppUrl(url) {
        this.webAppUrl = url;
    }
}

// Instância global
const googleSheetsManager = new GoogleSheetsManager();

// Exportar para uso em outros arquivos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GoogleSheetsManager, googleSheetsManager };
}
