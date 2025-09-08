// Redimensiona imagem antes de enviar para o editor
export async function resizeImage(file, maxWidth = 1024, maxHeight = 1024, outputType = 'image/png') {
  return new Promise((resolve) => {
    let readerResult = '';
    const img = new window.Image();
    const reader = new FileReader();

    const finalize = (src) => resolve(src || '');

    reader.onerror = () => {
      try { finalize(URL.createObjectURL(file)); } catch { finalize(''); }
    };

    reader.onload = (e) => {
      readerResult = e?.target?.result || '';

      img.onload = () => {
        try {
          const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d'); if (!ctx) return finalize(readerResult);
          ctx.drawImage(img, 0, 0, w, h);
          finalize(canvas.toDataURL(outputType, 0.92));
        } catch {
          finalize(readerResult);
        }
      };

      img.onerror = () => finalize(readerResult);
      img.src = readerResult;
    };

    try { reader.readAsDataURL(file); }
    catch {
      try { finalize(URL.createObjectURL(file)); } catch { finalize(''); }
    }
  });
}
