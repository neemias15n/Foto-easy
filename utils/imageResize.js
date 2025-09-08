// Redimensiona imagem antes de enviar para o editor
export async function resizeImage(file, maxWidth = 1024, maxHeight = 1024) {
  return new Promise((resolve) => {
    const img = new window.Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        let canvas = document.createElement('canvas');
        let scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        let ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Retorna o DataURL diretamente
        resolve(canvas.toDataURL('image/png', 0.92));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
