/****************************
 * Constantes e utilidades  *
 ****************************/
const EDITOR_W = 1181, EDITOR_H = 1772; // 10×15cm @300dpi
const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

/************************************
 * Editor: pan / zoom / centralizar *
 ************************************/
const editorCanvas = document.getElementById('editorCanvas');
const ectx = editorCanvas.getContext('2d');
let srcImg = new Image();
let originalDataURL = null; // preserva original
let workingDataURL = null;  // atual
let images = []; // array de imagens carregadas
let currentImageIndex = 0; // índice da imagem atualmente selecionada
let tx = 0, ty = 0, scale = 1; let isPanning = false, lx = 0, ly = 0;
// Mantém referência ao último input de texto focado (txt1/txt2)
let lastFocusedTextInput = null; // poderá ser contenteditable ou input hidden associado

function getTextFromContentEditable(el, emojiMap){
  // Converte imgs de emoji em marcadores [[EMOJI:url]] e mantém texto normal
  const clone = el.cloneNode(true);
  clone.querySelectorAll('img[data-emoji]')?.forEach(img => {
    const url = img.getAttribute('src') || '';
    const token = `[[EMOJI:${url}]]`;
    const span = document.createTextNode(token);
    img.replaceWith(span);
  });
  return clone.textContent || '';
}

function insertEmojiImageAtCaret(editable, emojiChar, emojiUrl){
  editable.focus();
  const img = document.createElement('img');
  img.src = emojiUrl;
  img.alt = emojiChar;
  img.setAttribute('data-emoji', emojiChar);
  img.style.width = '1em';
  img.style.height = '1em';
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    editable.appendChild(img);
    return;
  }
  const range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(img);
  range.setStartAfter(img);
  range.setEndAfter(img);
  sel.removeAllRanges();
  sel.addRange(range);
}

// Retorna URL SVG do Twemoji para um caractere emoji Unicode
function getTwemojiSvgUrl(unicodeEmoji){
  try{
    // twemoji.parseChar retorna o código; vamos montar URL SVG
    // Fallback: usar regex da própria lib se disponível
    const code = twemoji.convert.toCodePoint(unicodeEmoji);
    return `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${code}.svg`;
  }catch(e){
    return null;
  }
}
function clearEditor(bg = "#ffffff") { ectx.save(); ectx.fillStyle = bg; ectx.fillRect(0, 0, EDITOR_W, EDITOR_H); ectx.restore(); }
function drawEditor() {
    clearEditor(document.getElementById('bgColor')?.value || "#ffffff");
    if (!srcImg.src) return; const cx = EDITOR_W / 2, cy = EDITOR_H / 2; ectx.save(); ectx.translate(cx + tx, cy + ty); ectx.scale(scale, scale);
    const iw = srcImg.width, ih = srcImg.height; const fit = Math.max(EDITOR_W / iw, EDITOR_H / ih); const dw = iw * fit, dh = ih * fit; ectx.drawImage(srcImg, -dw / 2, -dh / 2, dw, dh); ectx.restore();
}
function centerImage() { tx = 0; ty = 0; scale = 1; drawEditor(); }
editorCanvas.addEventListener('mousedown', e => { isPanning = true; lx = e.offsetX; ly = e.offsetY });
editorCanvas.addEventListener('mousemove', e => { if (!isPanning) return; tx += (e.offsetX - lx); ty += (e.offsetY - ly); lx = e.offsetX; ly = e.offsetY; drawEditor(); });
window.addEventListener('mouseup', () => { isPanning = false });
document.getElementById('zoom').addEventListener('input', e => { scale = parseFloat(e.target.value); drawEditor(); });
document.getElementById('centerBtn').addEventListener('click', centerImage);
// Sistema de múltiplas imagens
import { resizeImage } from './utils/imageResize.js';
document.getElementById('fileInput').addEventListener('change', async e => { 
  const files = Array.from(e.target.files);
  if (files.length === 0) return;
  for (const file of files) {
    const resizedDataUrl = await resizeImage(file, 1024, 1024);
    await addImageToCollection({
      name: file.name,
      size: file.size,
      dataUrl: resizedDataUrl
    });
  }
  // Se for a primeira imagem, carrega no editor
  if (images.length === files.length) {
    await loadImageInEditor(0);
  }
});

function fileToDataURL(file) { return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); }); }
function loadImageToEditor(dataUrl) { return new Promise(r => { const img = new Image(); img.onload = () => { srcImg = img; r(); drawEditor(); }; img.src = dataUrl; }); }

// Função para adicionar imagem à coleção
async function addImageToCollection({ name, size, dataUrl }) {
  try {
    const imageData = {
      id: Date.now() + Math.random(),
      originalDataURL: dataUrl,
      workingDataURL: dataUrl,
      fileName: name,
      fileSize: size
    };
    images.push(imageData);
    updateImagePreviews();
    console.log(`Imagem adicionada: ${name}`);
  } catch (error) {
    console.error('Erro ao processar imagem:', error);
    alert('Erro ao processar a imagem. Tente novamente.');
  }
}

// Função para carregar imagem no editor
async function loadImageInEditor(index) {
  if (index < 0 || index >= images.length) return;
  
  currentImageIndex = index;
  const imageData = images[index];
  
  originalDataURL = imageData.originalDataURL;
  workingDataURL = imageData.workingDataURL;
  
  await loadImageToEditor(workingDataURL);
  centerImage();
  updateImagePreviews();
  
  console.log(`Imagem ${index + 1} carregada no editor`);
}

// Função para atualizar as pré-visualizações
function updateImagePreviews() {
  const container = document.getElementById('imagePreviews');
  container.innerHTML = '';
  
  images.forEach((imageData, index) => {
    const preview = document.createElement('div');
    preview.className = `image-preview ${index === currentImageIndex ? 'active' : ''}`;
    preview.onclick = () => loadImageInEditor(index);
    
    const img = document.createElement('img');
    img.src = imageData.workingDataURL;
    img.alt = imageData.fileName;
    
    const info = document.createElement('div');
    info.className = 'preview-info';
    info.textContent = `${index + 1}. ${imageData.fileName}`;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.innerHTML = '×';
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      removeImage(index);
    };
    
    preview.appendChild(img);
    preview.appendChild(info);
    preview.appendChild(removeBtn);
    container.appendChild(preview);
  });
}

// Função para remover imagem
function removeImage(index) {
  if (images.length <= 1) {
    alert('Você precisa ter pelo menos uma imagem.');
    return;
  }
  
  images.splice(index, 1);
  
  // Ajusta o índice atual se necessário
  if (currentImageIndex >= images.length) {
    currentImageIndex = images.length - 1;
  }
  
  // Carrega a imagem atual no editor
  if (images.length > 0) {
    loadImageInEditor(currentImageIndex);
  } else {
    // Limpa o editor se não houver imagens
    clearEditor();
    originalDataURL = null;
    workingDataURL = null;
  }
  
  updateImagePreviews();
  console.log(`Imagem ${index + 1} removida`);
}

document.getElementById('downloadEditorPng').addEventListener('click', () => { const a = document.createElement('a'); a.download = 'editor.png'; a.href = editorCanvas.toDataURL('image/png'); a.click(); });

// Função para processar arquivo de imagem (usado tanto no upload quanto no drag-drop)
async function processImageFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    alert('Por favor, selecione um arquivo de imagem válido.');
    return;
  }
  try {
    const resizedDataUrl = await resizeImage(file, 1024, 1024);
    await addImageToCollection({
      name: file.name,
      size: file.size,
      dataUrl: resizedDataUrl
    });
    // Se for a primeira imagem, carrega no editor
    if (images.length === 1) {
      await loadImageInEditor(0);
    }
    console.log('Imagem processada via drag-drop');
  } catch (error) {
    console.error('Erro ao processar imagem:', error);
    alert('Erro ao processar a imagem. Tente novamente.');
  }
}

// Função para configurar drag and drop em um elemento
function setupDragAndDrop(element) {
  element.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    element.style.borderColor = '#7C3AED';
    element.style.backgroundColor = '#f9f5ff';
  });

  element.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    element.style.borderColor = '#cbd5e1';
    element.style.backgroundColor = '#f1f5f9';
  });

  element.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    element.style.borderColor = '#cbd5e1';
    element.style.backgroundColor = '#f1f5f9';

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      for (const file of files) {
        await processImageFile(file);
      }
    }
  });
}

// Configurar drag and drop para o input principal
const fileInput = document.getElementById('fileInput');
setupDragAndDrop(fileInput);

// Configurar drag and drop para o canvas do editor
setupDragAndDrop(editorCanvas);

// Configurar drag and drop para o container de pré-visualizações
const imagePreviews = document.getElementById('imagePreviews');
setupDragAndDrop(imagePreviews);


/********************************************
 * Gabarito 3×4 (10×15 vertical) — SVG base *
 ********************************************/
const GABARITO_3X4_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="150mm" viewBox="0 0 10000 15000" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs><style><![CDATA[.s{stroke:#E5E7EB;stroke-width:20;fill:none}]]></style></defs>
  <rect class="slot s" x="496.19"  y="501.46"  width="3000" height="4000"/>
  <rect class="slot s" x="496.19"  y="4501.46" width="3000" height="4000"/>
  <rect class="slot s" x="3496.19" y="501.46"  width="3000" height="4000"/>
  <rect class="slot s" x="3496.19" y="4501.46" width="3000" height="4000"/>
  <rect class="slot s" x="6496.19" y="501.46"  width="3000" height="4000"/>
  <rect class="slot s" x="6496.19" y="4501.46" width="3000" height="4000"/>
  <rect class="slot s" transform="matrix(2.94409E-14 -1.11163 1.02844 2.72379E-14 496.195 11501.5)"  width="2698.75" height="3889.37"/>
  <rect class="slot s" transform="matrix(2.94409E-14 -1.11163 1.02844 2.72379E-14 496.195 14501.5)"  width="2698.75" height="3889.37"/>
  <rect class="slot s" transform="matrix(2.94409E-14 -1.11163 1.02844 2.72379E-14 4496.19 11501.5)" width="2698.75" height="3889.37"/>
  <rect class="slot s" transform="matrix(2.94409E-14 -1.11163 1.02844 2.72379E-14 4496.19 14501.5)" width="2698.75" height="3889.37"/>
</svg>`;

/***************************************************
 * Gabaritos Polaroid — slots de foto + slot_text  *
 ***************************************************/
// 2 polaroids (15×10) — moldura + slot foto + slot_text
const GABARITO_POLAROID_TWO = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="150mm" height="100mm" viewBox="0 0 15000 10000" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <style><![CDATA[
      .frame{fill:#ffffff;stroke:#CBD5E1;stroke-width:20}
      .slot{fill:none;stroke:#E5E7EB;stroke-width:20}
      .slot_text{fill:none;stroke:#E5E7EB;stroke-width:8}
    ]]></style>
    <filter id="ds" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000" flood-opacity="0.18"/>
    </filter>
  </defs>
  <!-- Moldura 1 -->
  <rect class="frame" filter="url(#ds)" rx="0" ry="0" x="0" y="0" width="7500" height="10000"/>
  <!-- Foto 1 -->
  <rect class="slot" x="750" y="750" width="6000" height="7500"/>
  <!-- Texto 1 -->
  <rect class="slot_text" x="750" y="8300" width="6000" height="1500"/>

  <!-- Moldura 2 -->
  <rect class="frame" filter="url(#ds)" rx="0" ry="0" x="7500" y="0" width="7500" height="10000"/>
  <!-- Foto 2 -->
  <rect class="slot" x="8250" y="750" width="6000" height="7500"/>
  <!-- Texto 2 -->
  <rect class="slot_text" x="8250" y="8300" width="6000" height="1500"/>
</svg>`;

// 1 polaroid (10×15 vertical) — moldura + slot + slot_text
const GABARITO_POLAROID_ONE = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="150mm" viewBox="0 0 10000 15000" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <style><![CDATA[
      .frame{fill:#ffffff;stroke:#CBD5E1;stroke-width:20}
      .slot{fill:none;stroke:#E5E7EB;stroke-width:20}
      .slot_text{fill:none;stroke:#E5E7EB;stroke-width:8}
    ]]></style>
    <filter id="ds" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000" flood-opacity="0.18"/>
    </filter>
  </defs>
  <rect class="frame" filter="url(#ds)" rx="0" ry="0" x="0" y="0" width="10000" height="15000"/>
  <rect class="slot" x="1000" y="1125" width="8000" height="11250"/>
  <rect class="slot_text" x="1000" y="12500" width="8000" height="2200"/>
</svg>`;

/**********************************************
 * Funções utilitárias para gabaritos (SVG)   *
 **********************************************/
function carregarGabarito(svgString) { const parser = new DOMParser(); const doc = parser.parseFromString(svgString, 'image/svg+xml'); const svg = doc.documentElement; if (!svg.querySelector('defs')) { const defs = document.createElementNS(SVG_NS, 'defs'); svg.insertBefore(defs, svg.firstChild); } return svg; }
function computeBounding(rect) { const w = parseFloat(rect.getAttribute('width')); const h = parseFloat(rect.getAttribute('height')); let x = rect.getAttribute('x') !== null ? parseFloat(rect.getAttribute('x')) : 0; let y = rect.getAttribute('y') !== null ? parseFloat(rect.getAttribute('y')) : 0; const tf = rect.getAttribute('transform'); if (tf) { const m = tf.match(/matrix\(([^)]+)\)/); if (m) { const [a, b, c, d, e, f] = m[1].trim().split(/\s+/).map(parseFloat); const pts = [{ x: e, y: f }, { x: a * w + e, y: b * w + f }, { x: c * h + e, y: d * h + f }, { x: a * w + c * h + e, y: b * w + d * h + f }]; const xs = pts.map(p => p.x), ys = pts.map(p => p.y); const minX = Math.min(...xs), maxX = Math.max(...xs); const minY = Math.min(...ys), maxY = Math.max(...ys); return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }; } } return { x, y, width: w, height: h }; }
function prepararRecortes(svg) { let rects = Array.from(svg.querySelectorAll('rect.slot')); const defs = svg.querySelector('defs'); const dados = []; rects.forEach((rect, idx) => { const w = parseFloat(rect.getAttribute('width') || 0); const h = parseFloat(rect.getAttribute('height') || 0); const vb = (svg.getAttribute('viewBox') || '0 0 0 0').split(/\s+/).map(parseFloat); if (vb.length === 4 && w >= vb[2] - 1 && h >= vb[3] - 1) { return; } if (!rect.id) rect.id = `rect-${idx}`; const bbox = computeBounding(rect); const clip = document.createElementNS(SVG_NS, 'clipPath'); const clipId = `clip-${idx}`; clip.setAttribute('id', clipId); const clone = rect.cloneNode(false); clone.removeAttribute('id'); clone.setAttribute('class', ''); clip.appendChild(clone); defs.appendChild(clip); dados.push({ rect, clipId, bbox }); }); return dados; }
function rotate90(dataUrl) { 
  return new Promise((resolve, reject) => { 
    const img = new Image(); 
    
    // Timeout para evitar travamento
    const timeout = setTimeout(() => {
      reject(new Error('Timeout ao carregar imagem para rotação'));
    }, 5000);
    
    img.onload = () => {
      try {
        clearTimeout(timeout);
        const c = document.createElement('canvas'); 
        c.width = img.height; 
        c.height = img.width; 
        const x = c.getContext('2d'); 
        
        // Melhora a qualidade da renderização
        x.imageSmoothingEnabled = true;
        x.imageSmoothingQuality = 'high';
        
        x.translate(c.width / 2, c.height / 2); 
        x.rotate(Math.PI / 2); 
        x.drawImage(img, -img.width / 2, -img.height / 2); 
        
        resolve(c.toDataURL('image/png', 1.0)); // Força PNG com qualidade máxima
      } catch (error) {
        clearTimeout(timeout);
        console.error('Erro ao rotacionar imagem:', error);
        reject(error);
      }
    }; 
    
    img.onerror = () => {
      clearTimeout(timeout);
      console.error('Erro ao carregar imagem para rotação');
      reject(new Error('Falha ao carregar imagem'));
    };
    
    // Força o carregamento com crossOrigin para evitar problemas CORS
    img.crossOrigin = 'anonymous';
    img.src = dataUrl; 
  }); 
}

// Nova função para converter DataURL para canvas e depois para DataURL limpo
function cleanDataURL(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    const timeout = setTimeout(() => {
      reject(new Error('Timeout ao limpar DataURL'));
    }, 5000);
    
    img.onload = () => {
      try {
        clearTimeout(timeout);
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        // Melhora a qualidade
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Desenha a imagem no canvas
        ctx.drawImage(img, 0, 0);
        
        // Retorna um DataURL limpo
        resolve(canvas.toDataURL('image/png', 1.0));
      } catch (error) {
        clearTimeout(timeout);
        console.error('Erro ao limpar DataURL:', error);
        reject(error);
      }
    };
    
    img.onerror = () => {
      clearTimeout(timeout);
      console.error('Erro ao carregar imagem para limpeza');
      reject(new Error('Falha ao carregar imagem'));
    };
    
    img.crossOrigin = 'anonymous';
    img.src = dataUrl;
  });
}
async function renderizarImagens(svg, slots, useMultipleImages = false) { 
  svg.querySelectorAll('image[data-slot]').forEach(n => n.remove()); 
  
  console.log('=== DEBUG: Renderizando imagens ===');
  console.log('Total de slots:', slots.length);
  console.log('Imagens disponíveis:', images.length);
  console.log('Usar múltiplas imagens:', useMultipleImages);
  
  if (images.length === 0) {
    console.log('Nenhuma imagem disponível para renderizar');
    return;
  }
  
  if (useMultipleImages) {
    // Para polaroids: usa múltiplas imagens
    // Prepara as imagens limpas
    const cleanImages = [];
    for (let i = 0; i < images.length; i++) {
      const imageData = images[i];
      console.log(`Limpando imagem ${i + 1}: ${imageData.fileName}`);
      const cleanImage = await cleanDataURL(imageData.workingDataURL);
      cleanImages.push(cleanImage);
    }
    
    // Verifica se algum slot precisa de rotação antes de chamar rotate90
    const precisaRotacao = slots.some(({ rect, bbox }) => 
      rect.hasAttribute('transform') || bbox.width > bbox.height
    );
    
    console.log('Precisa rotação?', precisaRotacao);
    
    // Prepara as imagens rotacionadas se necessário
    const rotatedImages = [];
    if (precisaRotacao) {
      for (let i = 0; i < cleanImages.length; i++) {
        console.log(`Rotacionando imagem ${i + 1}...`);
        const rotated = await rotate90(cleanImages[i]);
        rotatedImages.push(rotated);
      }
    }
    
    slots.forEach(({ rect, clipId, bbox }, idx) => { 
      const image = document.createElementNS(SVG_NS, 'image'); 
      const precisaRot = rect.hasAttribute('transform') || bbox.width > bbox.height; 
      
      console.log(`Slot ${idx}: precisaRot=${precisaRot}, transform=${rect.hasAttribute('transform')}, bbox=${JSON.stringify(bbox)}`);
      
      // Escolhe qual imagem usar baseado no slot
      let imageUrl;
      const imageIndex = Math.min(idx, images.length - 1); // Usa a última imagem se não houver imagem específica para o slot
      
      if (precisaRot && rotatedImages[imageIndex]) {
        imageUrl = rotatedImages[imageIndex];
        console.log(`Slot ${idx}: usando imagem ${imageIndex + 1} rotacionada`);
      } else {
        imageUrl = cleanImages[imageIndex];
        console.log(`Slot ${idx}: usando imagem ${imageIndex + 1} normal`);
      }
      
      image.setAttributeNS(XLINK_NS, 'href', imageUrl); 
      image.setAttribute('clip-path', `url(#${clipId})`); 
      image.setAttribute('preserveAspectRatio', 'xMidYMid slice'); 
      image.setAttribute('data-slot', idx); 
      image.setAttribute('x', bbox.x); 
      image.setAttribute('y', bbox.y); 
      image.setAttribute('width', bbox.width); 
      image.setAttribute('height', bbox.height); 
      
      // Adiciona tratamento de erro para cada imagem
      image.addEventListener('error', function() {
        console.error(`Erro ao carregar imagem no slot ${idx}:`, imageUrl.substring(0, 50) + '...');
      });
      
      image.addEventListener('load', function() {
        console.log(`Imagem carregada com sucesso no slot ${idx}`);
      });
      
      svg.appendChild(image); 
    }); 
  } else {
    // Para gabarito 3x4: usa apenas a imagem atualmente selecionada
    const currentImageData = images[currentImageIndex];
    console.log(`Usando imagem atual: ${currentImageData.fileName}`);
    
    // Limpa a imagem atual
    const cleanImage = await cleanDataURL(currentImageData.workingDataURL);
    console.log('Imagem atual limpa criada:', cleanImage.substring(0, 50) + '...');
    
    // Verifica se algum slot precisa de rotação
    const precisaRotacao = slots.some(({ rect, bbox }) => 
      rect.hasAttribute('transform') || bbox.width > bbox.height
    );
    
    console.log('Precisa rotação?', precisaRotacao);
    
    // Prepara a imagem rotacionada se necessário
    const rotatedImage = precisaRotacao ? await rotate90(cleanImage) : null;
    if (rotatedImage) {
      console.log('Imagem rotacionada criada:', rotatedImage.substring(0, 50) + '...');
    }
    
    slots.forEach(({ rect, clipId, bbox }, idx) => { 
      const image = document.createElementNS(SVG_NS, 'image'); 
      const precisaRot = rect.hasAttribute('transform') || bbox.width > bbox.height; 
      
      console.log(`Slot ${idx}: precisaRot=${precisaRot}, transform=${rect.hasAttribute('transform')}, bbox=${JSON.stringify(bbox)}`);
      
      // Usa a mesma imagem em todos os slots (gabarito 3x4)
      const imageUrl = precisaRot ? rotatedImage : cleanImage;
      
      image.setAttributeNS(XLINK_NS, 'href', imageUrl); 
      image.setAttribute('clip-path', `url(#${clipId})`); 
      image.setAttribute('preserveAspectRatio', 'xMidYMid slice'); 
      image.setAttribute('data-slot', idx); 
      image.setAttribute('x', bbox.x); 
      image.setAttribute('y', bbox.y); 
      image.setAttribute('width', bbox.width); 
      image.setAttribute('height', bbox.height); 
      
      // Adiciona tratamento de erro para cada imagem
      image.addEventListener('error', function() {
        console.error(`Erro ao carregar imagem no slot ${idx}:`, imageUrl.substring(0, 50) + '...');
      });
      
      image.addEventListener('load', function() {
        console.log(`Imagem carregada com sucesso no slot ${idx}`);
      });
      
      svg.appendChild(image); 
    }); 
  }
  
  console.log('=== Fim do debug ===');
}

// Embute fontes do Google no próprio SVG para preservar visual na exportação
async function embedFontsInSvg(svg){
  try{
    const defs = svg.querySelector('defs') || svg.insertBefore(document.createElementNS(SVG_NS,'defs'), svg.firstChild);
    // Evita duplicar
    if (svg.querySelector('style[data-embedded-fonts="true"]')) return;

    const cssUrl = 'https://fonts.googleapis.com/css2?family=Dancing+Script&family=Pacifico&family=Great+Vibes&family=Satisfy&display=swap';
    const resp = await fetch(cssUrl, { headers: { 'Accept': 'text/css' } });
    if(!resp.ok) throw new Error('Falha ao baixar CSS do Google Fonts');
    let cssText = await resp.text();

    // Converte todos os arquivos de fonte para data:URL para evitar CORS e quedas de fonte
    const urlMatches = Array.from(cssText.matchAll(/url\(([^)]+)\)/g)).map(m => m[1].replace(/['"]/g,'').trim());
    const uniqueUrls = Array.from(new Set(urlMatches)).filter(u => !u.startsWith('data:'));

    async function toDataUrl(u){
      const fullUrl = (u.startsWith('http')) ? u : `https://fonts.gstatic.com/${u.replace(/^\/+/, '')}`;
      const r = await fetch(fullUrl, { mode: 'cors' });
      if(!r.ok) throw new Error('Falha ao baixar fonte: ' + fullUrl);
      const b = await r.blob();
      return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); });
    }

    const map = new Map();
    for (const u of uniqueUrls){
      try{
        const dataUrl = await toDataUrl(u);
        map.set(u, dataUrl);
      }catch(e){ console.warn('Fonte não embutida:', u, e); }
    }

    // Substitui no CSS
    cssText = cssText.replace(/url\(([^)]+)\)/g, (m, p1) => {
      const raw = p1.replace(/['"]/g,'').trim();
      const key = raw.startsWith('http') ? raw : `https://fonts.gstatic.com/${raw.replace(/^\/+/, '')}`;
      const data = map.get(raw) || map.get(key);
      return data ? `url(${data})` : `url(${key})`;
    });

    const styleEl = document.createElementNS(SVG_NS, 'style');
    styleEl.setAttribute('type','text/css');
    styleEl.setAttribute('data-embedded-fonts','true');
    styleEl.textContent = cssText;
    defs.appendChild(styleEl);
  }catch(err){
    console.warn('Não foi possível embutir fontes no SVG:', err);
  }
}

async function svgToPngCanvas(svg, outW, outH) { 
  console.log('=== DEBUG: Iniciando conversão SVG para PNG ===');
  console.log('Dimensões de saída:', outW, 'x', outH);
  
  // Embute imagens (emojis, etc.) como data:URL para não sumirem no PNG
  await inlineSvgImages(svg);
  
  const serializer = new XMLSerializer(); 
  const svgString = serializer.serializeToString(svg); 
  console.log('SVG serializado, tamanho:', svgString.length, 'caracteres');
  
  // Debug: verifica se há imagens no SVG
  const images = svg.querySelectorAll('image');
  console.log('Imagens encontradas no SVG:', images.length);
  images.forEach((img, idx) => {
    const href = img.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
    console.log(`Imagem ${idx}: href=${href ? href.substring(0, 50) + '...' : 'null'}`);
  });
  
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' }); 
  const url = URL.createObjectURL(svgBlob); 
  console.log('URL do blob criada:', url);
  
  return new Promise((resolve, reject) => {
    const img = new Image(); 
    
    // Timeout para evitar travamento
    const timeout = setTimeout(() => {
      console.error('Timeout ao carregar SVG');
      URL.revokeObjectURL(url);
      reject(new Error('Timeout ao carregar SVG'));
    }, 10000);
    
    img.onload = () => {
      try {
        clearTimeout(timeout);
        console.log('SVG carregado com sucesso, criando canvas...');
        const c = document.createElement('canvas'); 
        c.width = outW; 
        c.height = outH; 
        const ctx = c.getContext('2d'); 
        
        // Melhora a qualidade da renderização
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Fundo branco
        ctx.fillStyle = "#ffffff"; 
        ctx.fillRect(0, 0, c.width, c.height); 
        
        // Desenha o SVG
        console.log('Desenhando SVG no canvas...');
        ctx.drawImage(img, 0, 0, c.width, c.height); 
        
        console.log('Canvas criado com sucesso!');
        URL.revokeObjectURL(url); 
        resolve(c);
      } catch (error) {
        clearTimeout(timeout);
        console.error('Erro ao converter SVG para PNG:', error);
        URL.revokeObjectURL(url);
        reject(error);
      }
    };
    
    img.onerror = (e) => {
      clearTimeout(timeout);
      console.error('Erro ao carregar SVG para conversão PNG:', e);
      URL.revokeObjectURL(url);
      reject(new Error('Falha ao carregar SVG'));
    };
    
    // Força o carregamento com crossOrigin para evitar problemas CORS
    img.crossOrigin = 'anonymous';
    img.src = url; 
    console.log('Iniciando carregamento da imagem SVG...');
  });
}

// Converte todas as imagens do SVG para data:URL (evita problemas CORS/taint)
async function inlineSvgImages(svg){
  const images = Array.from(svg.querySelectorAll('image'));
  for (const img of images){
    const href = img.getAttributeNS('http://www.w3.org/1999/xlink','href') || img.getAttribute('href');
    if (!href || href.startsWith('data:')) continue;
    try{
      const abs = new URL(href, window.location.href).toString();
      const resp = await fetch(abs);
      if(!resp.ok) throw new Error('HTTP ' + resp.status);
      const blob = await resp.blob();
      const dataUrl = await new Promise(res=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.readAsDataURL(blob); });
      img.setAttributeNS('http://www.w3.org/1999/xlink','href', dataUrl);
    }catch(e){
      console.warn('Falha ao embutir imagem do SVG:', href, e);
    }
  }
}

/***********************
 * Fluxo: Folha 3×4    *
 ***********************/
function montarFolha() { 
  console.log('=== DEBUG: montarFolha ===');
  console.log('workingDataURL existe?', !!workingDataURL);
  
  const svg = carregarGabarito(GABARITO_3X4_SVG); 
  const slots = prepararRecortes(svg); 
  console.log('Slots preparados:', slots.length);
  
  renderizarImagens(svg, slots, false).then(() => {
    console.log('Imagens renderizadas com sucesso');
    const wrap = document.getElementById('sheetSvgWrap'); 
    wrap.innerHTML = ''; 
    wrap.appendChild(svg);
    console.log('Folha 3x4 adicionada ao DOM');
  }).catch(error => {
    console.error('Erro ao renderizar imagens:', error);
  });
}
document.getElementById('buildSheet').addEventListener('click', () => { if (images.length === 0) { alert('Carregue pelo menos uma foto no Editor.'); return; } montarFolha(); });

// Botão de teste para a folha 3x4
document.getElementById('test3x4Btn')?.addEventListener('click', () => {
  console.log('=== TESTE DA FOLHA 3X4 ===');
  
  if (images.length === 0) {
    alert('❌ Carregue pelo menos uma foto no Editor primeiro!');
    return;
  }
  
  console.log('✅ Foto carregada no editor, testando folha 3x4...');
  console.log('workingDataURL:', workingDataURL.substring(0, 100) + '...');
  
  try {
    montarFolha();
    console.log('✅ Função montarFolha executada');
  } catch (error) {
    console.error('❌ Erro ao montar folha 3x4:', error);
    alert('❌ Erro ao montar folha 3x4: ' + error.message);
  }
});
document.getElementById('downloadSheetSvg').addEventListener('click', () => { const svg = document.querySelector('#sheetSvgWrap svg'); if (!svg) { alert('Monte a folha 3x4.'); return; } const src = new XMLSerializer().serializeToString(svg); const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src); const a = document.createElement('a'); a.href = url; a.download = 'folha-3x4.svg'; a.click(); });
document.getElementById('downloadSheetPng').addEventListener('click', async () => { 
  const svg = document.querySelector('#sheetSvgWrap svg'); 
  if (!svg) { 
    alert('Monte a folha 3x4.'); 
    return; 
  } 
  
  try {
    console.log('Iniciando conversão SVG para PNG...');
    const canvas = await svgToPngCanvas(svg, EDITOR_W, EDITOR_H); 
    console.log('Canvas criado com sucesso, gerando blob...');
    
    canvas.toBlob(blob => { 
      if (!blob) {
        console.error('Erro: Blob não foi gerado');
        alert('Erro ao gerar arquivo PNG. Tente novamente.');
        return;
      }
      
      console.log('Blob gerado com sucesso, iniciando download...');
      const a = document.createElement('a'); 
      a.href = URL.createObjectURL(blob); 
      a.download = 'folha-3x4.png'; 
      a.click(); 
      setTimeout(() => URL.revokeObjectURL(a.href), 1000); 
      console.log('Download iniciado com sucesso!');
    }, 'image/png', 1.0); // Força PNG com qualidade máxima
  } catch (error) {
    console.error('Erro ao converter para PNG:', error);
    alert('Erro ao converter para PNG: ' + error.message);
  }
});

/*************************
 * Fluxo: Polaroid (SVG) *
 *************************/
function getPolaroidGabaritoByMode() { const mode = document.querySelector('input[name="polaroidMode"]:checked').value; return mode === 'two' ? GABARITO_POLAROID_TWO : GABARITO_POLAROID_ONE; }
function isModeHorizontal() { return document.querySelector('input[name="polaroidMode"]:checked').value === 'two'; }
function getOutSizeByMode() { return isModeHorizontal() ? { w: 1772, h: 1181, filename: 'polaroid-2up-15x10' } : { w: 1181, h: 1772, filename: 'polaroid-1up-10x15' }; }

// --- helpers para Spotify ----------------------------------------------------
function parseSpotifyUrl(text){
  try{
    const u = new URL(text.trim());
    if(!u.hostname.endsWith('open.spotify.com')) return null;
    // remove /intl-xx se existir
    const pathname = u.pathname.replace(/^\/intl-[a-z-]+/i,'');
    const parts = pathname.split('/').filter(Boolean);
    const type = parts[0];         // track | album | playlist | artist | show | episode
    const id   = parts[1];
    if(!type || !id) return null;
    return { type, id };
  }catch(e){ return null; }
}

function buildScannableUrl({type, id, bg='#ffffffff', fg='black', width=750}){
  // https://scannables.scdn.co/uri/plain/jpeg/<bg>/<fg>/<width>/spotify:<type>:<id>
  const cleanBg = String(bg).replace('#','');
  const color = (String(fg).toLowerCase() === 'white') ? 'white' : 'black';
  return `https://scannables.scdn.co/uri/plain/jpeg/${cleanBg}/${color}/${width}/spotify:${type}:${id}`;
}

async function fetchImageDataURL(url){
  const resp = await fetch(url, { headers:{ Accept:'image/jpeg' } });
  if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const blob = await resp.blob();
  return await new Promise(res=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.readAsDataURL(blob); });
}
function medirTexto(texto, fontSize, fontFamily) {
  if (!texto || texto.length === 0) return 0;
  
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d");
  
  // Garante que o canvas tenha tamanho suficiente para fontes grandes
  c.width = fontSize * texto.length * 2;
  c.height = fontSize * 2;
  
  ctx.font = `${fontSize}px ${fontFamily}`;
  const metrics = ctx.measureText(texto);
  
  // Debug: mostra no console o que está sendo medido
  console.log(`Medindo: "${texto}" - Fonte: ${fontSize}px ${fontFamily} - Largura: ${metrics.width}`);
  
  return metrics.width;
}
// --- renderização de textos ou imagens nos slots de texto --------------------
async function renderizarTextos(svg, textos, opts={}){
  console.log('=== DEBUG: renderizarTextos ===');
  console.log('Textos recebidos:', textos);
  
  const { size=220, align='center', upper=false } = opts;
  const defs = svg.querySelector('defs') || svg.insertBefore(document.createElementNS(SVG_NS,'defs'), svg.firstChild);
  const textSlots = Array.from(svg.querySelectorAll('rect.slot_text'));
  
  console.log('Slots de texto encontrados:', textSlots.length);

  // limpa conteúdos anteriores
  svg.querySelectorAll('[data-text-slot]').forEach(n=>n.remove());

  for(let i=0; i<textSlots.length && i<textos.length; i++){
    const rect = textSlots[i];
    const bbox = computeBounding(rect);
    const raw  = textos[i] ?? '';
    console.log(`Slot ${i}: texto="${raw}"`);
    
    const parsed = parseSpotifyUrl(raw);
    console.log(`Slot ${i}: parsed=`, parsed);

    // Oculta a linha do slot de texto para este slot
    rect.style.display = 'none';

    if(parsed){
      console.log(`Slot ${i}: Processando como Spotify Code`);
      // lê as cores escolhidas (com defaults)
      const bg = document.getElementById('spBg')?.value || '#ffffffff';
      const fg = document.getElementById('spFg')?.value || 'black';
      console.log(`Slot ${i}: cores - bg=${bg}, fg=${fg}`);
      
      const url = buildScannableUrl({ type: parsed.type, id: parsed.id, bg, fg, width: 750 });
      console.log(`Slot ${i}: URL scannable gerada:`, url);
      
      try {
        const dataUrl = await fetchImageDataURL(url);
        console.log(`Slot ${i}: DataURL obtido com sucesso, tamanho:`, dataUrl.length);

        // clip no slot de texto
        const clip = document.createElementNS(SVG_NS,'clipPath');
        const clipId = `txtclip-${i}`;
        clip.setAttribute('id', clipId);
        // Clona o rect do slot de texto, mas remove estilos inline (ex.: display:none)
        const rectClone = rect.cloneNode(false);
        rectClone.removeAttribute('style');
        clip.appendChild(rectClone);
        defs.appendChild(clip);

        const img = document.createElementNS(SVG_NS,'image');
        img.setAttributeNS(XLINK_NS, 'href', dataUrl);
        img.setAttribute('x', bbox.x);
        img.setAttribute('y', bbox.y);
        img.setAttribute('width', bbox.width);
        img.setAttribute('height', bbox.height);
        img.setAttribute('preserveAspectRatio','xMidYMid meet');
        img.setAttribute('clip-path', `url(#${clipId})`);
        img.setAttribute('data-text-slot', i);
        
        // Adiciona tratamento de erro para a imagem
        img.addEventListener('error', function() {
          console.error(`Slot ${i}: Erro ao carregar imagem do Spotify Code`);
        });
        
        img.addEventListener('load', function() {
          console.log(`Slot ${i}: Imagem do Spotify Code carregada com sucesso`);
        });
        
        svg.appendChild(img);
        console.log(`Slot ${i}: Imagem adicionada ao SVG`);
      } catch (error) {
        console.error(`Slot ${i}: Erro ao obter DataURL:`, error);
      }
    } else {
      // Verifica se o texto contém emojis específicos e os substitui por imagens
      const emojiMap = {
        '❤️': './assets/emojis/red-heart.png',
        '✨': './assets/emojis/sparkles.png',
        '🎶': './assets/emojis/musical-notes.png',
        '🌸': './assets/emojis/cherry-blossom.png',
        '🔥': './assets/emojis/fire.png',
        '😊': './assets/emojis/smiling-face.png',
        '⭐': './assets/emojis/star.png',
        '💙': './assets/emojis/blue-heart.png',
        '✌️': './assets/emojis/victory-hand.png',
        '☀️': './assets/emojis/sun.png',
        '🌙': './assets/emojis/crescent-moon.png',
        '☕': './assets/emojis/hot-beverage.png'
      };
      
      // Usa regex abrangente para detectar qualquer um dos emojis do mapa
      const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const emojiKeys = Object.keys(emojiMap).sort((a,b)=>b.length - a.length).map(escapeRegExp);
      const emojiRegex = new RegExp('(' + emojiKeys.join('|') + ')');
      // Também detecta marcador [[EMOJI:...]] para trabalhar 100% com imagens
      const hasEmojis = emojiRegex.test(raw) || /\[\[EMOJI:[^\]]+\]\]/.test(raw);
      
      if (hasEmojis) {
        // Renderiza texto com emojis substituídos por imagens
        await renderizarTextoComEmojis(svg, raw, bbox, i, emojiMap, opts);
      } else {
        // texto normal sem emojis
        const t = document.createElementNS(SVG_NS,'text');
        const content = upper ? raw.toUpperCase() : raw;

        // pega a fonte escolhida no select
        const family = document.getElementById("txtFont")?.value || "Dancing Script, cursive";

        // começa com o valor do slider
        let fontSize = size;
        let larguraTexto = medirTexto(content, fontSize, family);
        
        console.log(`Iniciando ajuste de fonte: "${content}" - Tamanho inicial: ${fontSize}px - Largura: ${larguraTexto}px - Slot: ${bbox.width}px`);

        // Ajusta o tamanho da fonte para caber no slot de forma mais generosa
        // Se o texto for muito grande para o slot, diminui
        if (larguraTexto > bbox.width * 0.8) {
          console.log(`Texto muito grande, diminuindo...`);
          while (larguraTexto > bbox.width * 0.8 && fontSize > 50) {
            fontSize -= 10;
            larguraTexto = medirTexto(content, fontSize, family);
          }
          console.log(`Após diminuir: ${fontSize}px - Largura: ${larguraTexto}px`);
        }
        // Se o texto for muito pequeno para o slot, aumenta
        else if (larguraTexto < bbox.width * 0.5) {
          console.log(`Texto muito pequeno, aumentando...`);
          while (larguraTexto < bbox.width * 0.5 && fontSize < 800) {
            fontSize += 10;
            larguraTexto = medirTexto(content, fontSize, family);
          }
          // Ajusta para não ultrapassar o limite
          if (larguraTexto > bbox.width * 0.8) {
            console.log(`Ajustando para não ultrapassar...`);
            while (larguraTexto > bbox.width * 0.8 && fontSize > 50) {
              fontSize -= 5;
              larguraTexto = medirTexto(content, fontSize, family);
            }
          }
          console.log(`Após aumentar: ${fontSize}px - Largura: ${larguraTexto}px`);
        }
        
        console.log(`Tamanho final escolhido: ${fontSize}px`);

        t.textContent = content;
        t.setAttribute('font-family', family);
        t.setAttribute('font-size', fontSize);
        t.setAttribute('fill', '#0f172a');

        // alinhamento (usando fontSize real)
        let anchor = 'middle', x = bbox.x + bbox.width/2;
        if(align==='left'){ anchor='start'; x=bbox.x + fontSize*0.3; }
        if(align==='right'){ anchor='end'; x=bbox.x + bbox.width - fontSize*0.3; }
        t.setAttribute('text-anchor', anchor);

        // centraliza verticalmente (usando fontSize real)
        const y = bbox.y + bbox.height/2 + fontSize*0.35;
        t.setAttribute('x', x);
        t.setAttribute('y', y);
        t.setAttribute('data-text-slot', i);
        svg.appendChild(t);
      }
    }
  }
}

function checkSpotifyControlsVisibility(){
  const t1 = (document.getElementById('txt1')?.value || '').trim();
  const t2 = (document.getElementById('txt2')?.value || '').trim();
  console.log('=== DEBUG: checkSpotifyControlsVisibility ===');
  console.log('txt1:', t1);
  console.log('txt2:', t2);
  
  const parsed1 = parseSpotifyUrl(t1);
  const parsed2 = parseSpotifyUrl(t2);
  console.log('parsed1:', parsed1);
  console.log('parsed2:', parsed2);
  
  const any = !!(parsed1 || parsed2);
  console.log('any:', any);
  
  const el = document.getElementById('spotifyControls');
  if(el) {
    el.style.display = any ? 'flex' : 'none';
    console.log('Controles do Spotify:', any ? 'VISÍVEIS' : 'OCULTOS');
    console.log('Elemento encontrado, display definido para:', el.style.display);
  } else {
    console.log('Elemento spotifyControls não encontrado!');
  }
}

// contenteditable handlers: sincronizam com inputs hidden txt1/txt2
function setupContentEditableSync(){
  const emojiMap = {
    '❤️': './assets/emojis/red-heart.png',
    '✨': './assets/emojis/sparkles.png',
    '🎶': './assets/emojis/musical-notes.png',
    '🌸': './assets/emojis/cherry-blossom.png',
    '🔥': './assets/emojis/fire.png',
    '😊': './assets/emojis/smiling-face.png',
    '⭐': './assets/emojis/star.png',
    '💙': './assets/emojis/blue-heart.png',
    '✌️': './assets/emojis/victory-hand.png',
    '☀️': './assets/emojis/sun.png',
    '🌙': './assets/emojis/crescent-moon.png',
    '☕': './assets/emojis/hot-beverage.png'
  };

  const pairs = [
    { ceId: 'txt1ce', inputId: 'txt1' },
    { ceId: 'txt2ce', inputId: 'txt2' }
  ];

  pairs.forEach(({ ceId, inputId }) => {
    const ce = document.getElementById(ceId);
    const hidden = document.getElementById(inputId);
    if (!ce || !hidden) return;

    const sync = () => {
      hidden.value = getTextFromContentEditable(ce, emojiMap);
      hidden.dispatchEvent(new Event('input')); // mantém lógica do Spotify e visibilidade
      checkSpotifyControlsVisibility();
    };

    ce.addEventListener('keyup', sync);
    ce.addEventListener('input', sync);
    ce.addEventListener('paste', () => setTimeout(sync, 0));
    ce.addEventListener('focus', () => { lastFocusedTextInput = ce; });
  });
}

setupContentEditableSync();
checkSpotifyControlsVisibility();

// --- sua função, corrigida: usa await e includes() ---------------------------
async function montarPolaroid(){
  console.log('=== DEBUG: montarPolaroid ===');
  
  if(images.length === 0){ 
    console.log('❌ Nenhuma foto carregada no editor');
    alert('Carregue pelo menos uma foto no Editor primeiro.'); 
    return; 
  }

  console.log('✅ Foto carregada no editor, iniciando montagem...');
  
  const svg   = carregarGabarito(getPolaroidGabaritoByMode());
  const slots = prepararRecortes(svg);
  
  await renderizarImagens(svg, slots, true);

  // Coleta textos dos inputs (ou string vazia)
  const textos = [
    (document.getElementById('txt1')?.value || '').trim(),
    (document.getElementById('txt2')?.value || '').trim()
  ];
  
  console.log('Textos coletados:', textos);

  // opções visuais do texto (se não tiver os inputs, usa defaults)
  const opts = {
    size:  parseInt(document.getElementById('txtSize')?.value, 10) || 300,
    align: document.getElementById('txtAlign')?.value || 'center',
    upper: !!document.getElementById('txtUpper')?.checked
  };
  
  console.log('Opções de texto:', opts);

  console.log('Chamando renderizarTextos...');
  await renderizarTextos(svg, textos, opts);
  console.log('renderizarTextos concluído');

  // Embute as fontes usadas para manter aparência ao exportar
  await embedFontsInSvg(svg);

  const wrap = document.getElementById('polaroidSvgWrap');
  wrap.innerHTML = '';
  wrap.appendChild(svg);
  console.log('Polaroid adicionada ao DOM');
}

document.getElementById('buildPolaroidSvg').addEventListener('click', () => { 
    if (images.length === 0) { 
        alert('Carregue pelo menos uma foto no Editor.'); return; 
    } 
    montarPolaroid(); 
});

document.getElementById('downloadPolaroidSvg').addEventListener('click', () => { const svg = document.querySelector('#polaroidSvgWrap svg'); if (!svg) { alert('Monte a polaroid.'); return; } const { filename } = getOutSizeByMode(); const src = new XMLSerializer().serializeToString(svg); const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src); const a = document.createElement('a'); a.href = url; a.download = `${filename}.svg`; a.click(); });

document.getElementById('downloadPolaroidSvgPng').addEventListener('click', async () => { const svg = document.querySelector('#polaroidSvgWrap svg'); if (!svg) { alert('Monte a polaroid.'); return; } const { w, h, filename } = getOutSizeByMode(); const canvas = await svgToPngCanvas(svg, w, h); canvas.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${filename}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }); });

// Função para capturar screenshot de um elemento
async function captureElementScreenshot(element, filename) {
  try {
    // Usa html2canvas para capturar o elemento
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2, // Aumenta a qualidade
      useCORS: true,
      allowTaint: true,
      logging: false
    });
    
    // Converte para blob e faz download
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png', 1.0);
    
  } catch (error) {
    console.error('Erro ao capturar screenshot:', error);
    alert('Erro ao capturar screenshot. Verifique se html2canvas está carregado.');
  }
}

// Event listeners para captura de screenshot
document.getElementById('screenshotSheet')?.addEventListener('click', () => {
  const element = document.getElementById('sheetSvgWrap');
  if (!element || !element.querySelector('svg')) {
    alert('Monte a folha 3x4 primeiro.');
    return;
  }
  captureElementScreenshot(element, 'folha-3x4-captura.png');
});

document.getElementById('screenshotPolaroid')?.addEventListener('click', () => {
  const element = document.getElementById('polaroidSvgWrap');
  if (!element || !element.querySelector('svg')) {
    alert('Monte a polaroid primeiro.');
    return;
  }
  const { filename } = getOutSizeByMode();
  captureElementScreenshot(element, `${filename}-captura.png`);
});

/********************
 * Abas de navegação *
 ********************/
document.querySelectorAll('.tab-btn').forEach(b => { b.addEventListener('click', () => { document.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active')); document.querySelectorAll('.panel').forEach(p => p.classList.remove('active')); b.classList.add('active'); document.getElementById(b.dataset.tab).classList.add('active'); }); });
/************************************
 * Integração com remove.bg API     *
 ************************************/
const REMOVE_BG_API_KEY = "DkJUSEQCLDALVvQ8eS3WFzv4"; // 🔑 coloque aqui sua API key

document.getElementById("removeBgBtn")?.addEventListener("click", async () => {
  if (images.length === 0) {
    alert("Carregue pelo menos uma foto no Editor primeiro.");
    return;
  }

  const btn = document.getElementById("removeBgBtn");
  const originalText = btn.textContent;
  btn.textContent = "Processando...";
  btn.disabled = true;

  try {
    console.log(`Iniciando remoção de fundo para ${images.length} imagens`);
    
    for (let i = 0; i < images.length; i++) {
      const imageData = images[i];
      console.log(`Processando imagem ${i + 1}/${images.length}: ${imageData.fileName}`);
      
      // Atualiza o texto do botão
      btn.textContent = `Processando ${i + 1}/${images.length}...`;
      
      // Envia dados como JSON para o proxy (mais compatível com Vercel)
      const proxyUrl = "/api/removebg";
      const resp = await fetch(proxyUrl, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageData: imageData.originalDataURL,
          fileName: imageData.fileName
        })
      });

      if (!resp.ok) {
        throw new Error(`Erro na API para imagem ${i + 1}: ${resp.status}`);
      }

      // Converte a resposta em DataURL
      const resultBlob = await resp.blob();
      const resultUrl = URL.createObjectURL(resultBlob);

      // Atualiza a imagem na coleção
      imageData.workingDataURL = resultUrl;
      
      // Se for a imagem atual no editor, atualiza a visualização
      if (i === currentImageIndex) {
        workingDataURL = resultUrl;
        await loadImageToEditor(resultUrl);
        centerImage();
      }
      
      // Delay apenas se houver múltiplas imagens (limite da API gratuita)
      if (images.length > 1 && i < images.length - 1) {
        console.log(`Aguardando 2 segundos antes da próxima imagem...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Atualiza as pré-visualizações
    updateImagePreviews();
    
    console.log("Remoção de fundo concluída para todas as imagens!");
    alert(`✅ Fundo removido com sucesso de ${images.length} imagem(ns)!`);
    
  } catch (err) {
    console.error(err);
    if (err.message.includes('Failed to fetch') || err.message.includes('CORS')) {
      alert(`Erro de CORS: Problema com o proxy da API.\n\nSoluções:\n1. Verifique se o deploy foi feito corretamente no Vercel\n2. Ou use uma ferramenta externa para remover fundo e re-upload`);
    } else {
      alert(`Falha ao remover fundo: ${err.message}`);
    }
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
});
// Emoji Picker melhorado - insere emoji Unicode no campo e detecta URLs para renderizar
// Função para inicializar o sistema de emojis
function initEmojiSystem() {
  console.log('Inicializando sistema de emojis...');
  
  const emojiBtns = document.querySelectorAll(".emoji-btn");
  console.log(`Encontrados ${emojiBtns.length} botões de emoji`);
  
  emojiBtns.forEach((btn, index) => {
    // Captura o emoji unicode original antes de trocar o conteúdo do botão
    const originalEmojiChar = (btn.textContent || '').trim();
    if (originalEmojiChar) {
      btn.setAttribute('data-emoji', originalEmojiChar);
    }

    // Se existir data-url, mostre a imagem no botão
    const url = btn.getAttribute('data-url');
    if (url) {
      btn.style.padding = '0';
      btn.style.width = '40px';
      btn.style.height = '40px';
      btn.style.display = 'flex';
      btn.style.alignItems = 'center';
      btn.style.justifyContent = 'center';
      btn.style.background = 'transparent';
      btn.style.border = 'none';
      // Substitui conteúdo por imagem
      btn.innerHTML = `<img src="${url}" alt="${originalEmojiChar || 'emoji'}" style="width:28px;height:28px;"/>`;
    }
    
    btn.addEventListener("click", function(e) {
      e.preventDefault();
      // Decide qual contenteditable receberá o emoji
      let target = null;
      const active = document.activeElement;
      if (active && (active.id === 'txt1ce' || active.id === 'txt2ce')) target = active;
      else if (lastFocusedTextInput && (lastFocusedTextInput.id === 'txt1ce' || lastFocusedTextInput.id === 'txt2ce')) target = lastFocusedTextInput;
      else target = document.getElementById('txt1ce');

      const emojiChar = this.getAttribute('data-emoji') || this.textContent;
      const emojiUrl  = this.getAttribute('data-url');
      if (target && emojiUrl) {
        insertEmojiImageAtCaret(target, emojiChar, emojiUrl);
        // Sincroniza com o input hidden correspondente
        const hiddenId = (target.id === 'txt1ce') ? 'txt1' : 'txt2';
        const hidden = document.getElementById(hiddenId);
        if (hidden) {
          hidden.value = getTextFromContentEditable(target, {});
          hidden.dispatchEvent(new Event('input'));
        }
      }
    });
  });
  
  console.log('Sistema de emojis inicializado!');
}

// Chama a função quando a página carrega
document.addEventListener('DOMContentLoaded', initEmojiSystem);

// Também chama se já estiver carregado
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEmojiSystem);
} else {
  initEmojiSystem();
}

// Botão restaurar (volta para a foto original)
document.getElementById("restoreBgBtn")?.addEventListener("click", async () => {
  if (images.length === 0) return;
  
  const btn = document.getElementById("restoreBgBtn");
  const originalText = btn.textContent;
  btn.textContent = "Restaurando...";
  btn.disabled = true;
  
  try {
    // Restaura todas as imagens para o estado original
    for (let i = 0; i < images.length; i++) {
      const imageData = images[i];
      imageData.workingDataURL = imageData.originalDataURL;
      
      // Se for a imagem atual no editor, atualiza a visualização
      if (i === currentImageIndex) {
        workingDataURL = imageData.originalDataURL;
        await loadImageToEditor(workingDataURL);
        centerImage();
      }
    }
    
    // Atualiza as pré-visualizações
    updateImagePreviews();
    
    console.log("Todas as imagens restauradas para o estado original!");
    alert(`✅ ${images.length} imagem(ns) restaurada(s) para o estado original!`);
    
  } catch (error) {
    console.error('Erro ao restaurar imagens:', error);
    alert('Erro ao restaurar imagens. Tente novamente.');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
});

// Atualiza o valor do tamanho da fonte em tempo real
document.getElementById('txtSize')?.addEventListener('input', (e) => {
  const sizeValue = document.getElementById('sizeValue');
  if (sizeValue) {
    sizeValue.textContent = e.target.value + 'px';
  }
});

// Atualiza o valor do tamanho dos emojis em tempo real
document.getElementById('emojiSize')?.addEventListener('input', (e) => {
  const emojiSizeValue = document.getElementById('emojiSizeValue');
  if (emojiSizeValue) {
    emojiSizeValue.textContent = e.target.value + 'px';
  }
});

// Atualiza a polaroid quando qualquer controle for alterado
function addTextControlListeners() {
  const controls = ['txtSize', 'txtFont', 'txtAlign', 'txtUpper', 'emojiSize'];
  controls.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('change', () => {
        // Se já existe uma polaroid montada, atualiza automaticamente
        const existingSvg = document.querySelector('#polaroidSvgWrap svg');
        if (existingSvg && workingDataURL) {
          montarPolaroid();
        }
      });
    }
  });
}

// Chama a função quando a página carrega
addTextControlListeners();

// Função para converter imagem para DataURL
async function imageToDataURL(imageUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => reject(new Error('Erro ao carregar imagem'));
    img.src = imageUrl;
  });
}

// Função para renderizar texto com emojis substituídos por imagens
async function renderizarTextoComEmojis(svg, texto, bbox, slotIndex, emojiMap, opts) {
  const { size=300, align='center', upper=false } = opts;
  const family = document.getElementById("txtFont")?.value || "Dancing Script, cursive";
  
  // Pega o tamanho dos emojis do controle (mínimo 50px)
  const emojiSize = Math.max(400, parseInt(document.getElementById('emojiSize')?.value || 400));
  
  // Se existir marcador [[EMOJI:url]], usa os marcadores e ignora unicode
  let partes;
  if (texto.includes('[[EMOJI:')) {
    const parts = texto.split(/(\[\[EMOJI:[^\]]+\]\])/g).filter(Boolean);
    partes = parts.map(p => {
      const m = p.match(/^\[\[EMOJI:([^\]]+)\]\]$/);
      if (m) return { tipo:'emoji', url:m[1], conteudo:'' };
      return { tipo:'texto', conteudo:p };
    });
  } else {
    // Divide o texto em partes (texto e emojis Unicode)
    const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const emojiKeys = Object.keys(emojiMap).sort((a,b)=>b.length - a.length).map(escapeRegExp);
    const emojiRegex = new RegExp('(' + emojiKeys.join('|') + ')', 'g');
    const rawParts = texto.split(emojiRegex).filter(part => part && part.length > 0);
    partes = rawParts.map(part => {
      if (emojiMap[part]) {
        return { tipo: 'emoji', conteudo: part, url: emojiMap[part] };
      }
      // Tenta Twemoji para unicode
      const tw = getTwemojiSvgUrl(part);
      if (tw) return { tipo: 'emoji', conteudo: part, url: tw };
      return { tipo: 'texto', conteudo: part };
    });
  }
  
  // Calcula o tamanho total para centralizar
  let larguraTotal = 0;
  const elementos = [];
  
  for (const parte of partes) {
    if (parte.tipo === 'texto') {
      const conteudo = upper ? parte.conteudo.toUpperCase() : parte.conteudo;
      let fontSize = size;
      let larguraTexto = medirTexto(conteudo, fontSize, family);
      
      // Ajusta o tamanho da fonte para ser mais generoso
      if (larguraTexto > bbox.width * 0.6) {
        while (larguraTexto > bbox.width * 0.6 && fontSize > 50) {
          fontSize -= 10;
          larguraTexto = medirTexto(conteudo, fontSize, family);
        }
      }
      
      elementos.push({ tipo: 'texto', conteudo, fontSize, largura: larguraTexto });
      larguraTotal += larguraTexto;
    } else {
      // Emoji: usa URL diretamente (evita taint/canvas). Marcador já traz a URL; caso unicode, pega do mapa
      try {
        const sourceUrl = parte.url || emojiMap[parte.conteudo];
        if (!sourceUrl) throw new Error('URL do emoji não encontrada');
        elementos.push({ tipo: 'emoji', url: sourceUrl, largura: emojiSize, altura: emojiSize });
        larguraTotal += emojiSize;
      } catch (error) {
        console.error('Erro ao preparar emoji:', error);
        elementos.push({ tipo: 'texto', conteudo: parte.conteudo || '❓', fontSize: emojiSize, largura: emojiSize });
        larguraTotal += emojiSize;
      }
    }
  }
  
  // Calcula posição inicial para centralizar
  let posX = bbox.x + (bbox.width - larguraTotal) / 2;
  if (align === 'left') {
    posX = bbox.x + size * 0.2;
  } else if (align === 'right') {
    posX = bbox.x + bbox.width - larguraTotal - size * 0.2;
  }
  
  // Renderiza cada elemento
  for (const elemento of elementos) {
    if (elemento.tipo === 'texto') {
      const t = document.createElementNS(SVG_NS, 'text');
      t.textContent = elemento.conteudo;
      t.setAttribute('font-family', family);
      t.setAttribute('font-size', elemento.fontSize);
      t.setAttribute('fill', '#0f172a');
      t.setAttribute('text-anchor', 'start');
      
      const y = bbox.y + bbox.height/2 + elemento.fontSize*0.35;
      t.setAttribute('x', posX);
      t.setAttribute('y', y);
      t.setAttribute('data-text-slot', slotIndex);
      svg.appendChild(t);
      
      posX += elemento.largura;
    } else {
      // Renderiza emoji como imagem (usa URL diretamente)
        const img = document.createElementNS(SVG_NS, 'image');
        img.setAttributeNS(XLINK_NS, 'href', elemento.url);
        img.setAttribute('x', posX);
        img.setAttribute('y', bbox.y + (bbox.height - elemento.altura) / 2);
        img.setAttribute('width', elemento.largura);
        img.setAttribute('height', elemento.altura);
        img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        img.setAttribute('data-text-slot', slotIndex);
        svg.appendChild(img);
      
      posX += elemento.largura;
    }
  }
  
  console.log(`Texto com emojis renderizado: ${texto} - Elementos: ${elementos.length} - Tamanho emojis: ${emojiSize}px - Tamanho texto: ${size}px`);
}

// Sistema de emojis configurado e funcionando

// Sistema de emojis otimizado para tamanhos maiores

// Botão de teste para o sistema do Spotify
document.getElementById('testSpotifyBtn')?.addEventListener('click', async () => {
  console.log('=== TESTE DO SPOTIFY ===');
  
  // Testa a detecção de URL
  const testUrl = 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh';
  console.log('Testando URL:', testUrl);
  
  const parsed = parseSpotifyUrl(testUrl);
  console.log('Resultado da detecção:', parsed);
  
  if (parsed) {
    console.log('✅ URL detectada corretamente');
    
    // Testa a geração da URL scannable
    const scannableUrl = buildScannableUrl({ 
      type: parsed.type, 
      id: parsed.id, 
      bg: '#7C3AED', 
      fg: 'black', 
      width: 750 
    });
    console.log('URL scannable gerada:', scannableUrl);
    
    try {
      // Testa o download da imagem
      const dataUrl = await fetchImageDataURL(scannableUrl);
      console.log('✅ Imagem baixada com sucesso, tamanho:', dataUrl.length);
      
      // Testa a visibilidade dos controles
      const txt1 = document.getElementById('txt1');
      if (txt1) {
        txt1.value = testUrl;
        txt1.dispatchEvent(new Event('input'));
        console.log('✅ URL inserida no campo txt1');
        
        // Verifica se os controles apareceram
        setTimeout(() => {
          const controls = document.getElementById('spotifyControls');
          if (controls && controls.style.display !== 'none') {
            console.log('✅ Controles do Spotify estão visíveis');
            
            // Testa a geração da polaroid
            console.log('🧪 Testando geração da polaroid...');
            if (workingDataURL) {
              console.log('✅ Foto carregada no editor, testando montar polaroid...');
              montarPolaroid().then(() => {
                console.log('✅ Polaroid montada com sucesso!');
                alert('✅ Teste completo! Controles visíveis e polaroid montada. Verifique se o código do Spotify aparece na polaroid.');
              }).catch(error => {
                console.error('❌ Erro ao montar polaroid:', error);
                alert('❌ Erro ao montar polaroid: ' + error.message);
              });
            } else {
              console.log('⚠️ Nenhuma foto carregada no editor. Carregue uma foto primeiro para testar a polaroid.');
              alert('✅ Controles visíveis! Agora carregue uma foto no Editor e monte a polaroid para ver o código do Spotify.');
            }
          } else {
            console.log('❌ Controles do Spotify NÃO estão visíveis');
            alert('❌ Controles do Spotify não apareceram. Verifique o console.');
          }
        }, 100);
      }
      
    } catch (error) {
      console.error('❌ Erro no teste:', error);
      alert('❌ Erro no teste do Spotify: ' + error.message);
    }
  } else {
    console.error('❌ URL não foi detectada');
    alert('❌ URL do Spotify não foi detectada corretamente');
  }
});

// Botão de teste para o sistema de emojis
document.getElementById('testEmojiSystem')?.addEventListener('click', () => {
  console.log('=== TESTANDO SISTEMA DE EMOJIS ===');
  
  // Testa inserção de emoji
  const txt1 = document.getElementById('txt1');
  if (txt1) {
    txt1.focus();
    txt1.value = 'Teste ❤️ Emoji ✨';
    txt1.dispatchEvent(new Event('input'));
    console.log('Emoji inserido no txt1:', txt1.value);
    
    // Testa montar polaroid se houver foto
    if (workingDataURL) {
      console.log('Montando polaroid de teste...');
      setTimeout(async () => {
        try {
          await montarPolaroid();
          console.log('Polaroid montada com sucesso!');
          
          // Testa conversão para PNG
          const svg = document.querySelector('#polaroidSvgWrap svg');
          if (svg) {
            console.log('Testando conversão para PNG...');
            const canvas = await svgToPngCanvas(svg, 1181, 1772);
            console.log('PNG gerado com sucesso!', canvas);
          }
        } catch (error) {
          console.error('Erro ao montar polaroid:', error);
        }
      }, 500);
    } else {
      console.log('Carregue uma foto primeiro para testar a polaroid');
    }
  }
  
  console.log('Teste concluído!');
});
