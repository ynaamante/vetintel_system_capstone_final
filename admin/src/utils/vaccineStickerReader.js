export const compact = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export function matchStickerBatch(text, batches) {
  const normalized=compact(text);
  const matches=batches.filter(batch=>{const lot=compact(batch.batch_number);return lot.length>=4&&normalized.includes(lot);});
  return matches.length===1 ? { batch:matches[0], ambiguous:false } : { batch:null, ambiguous:matches.length>1 };
}
export async function readVaccineSticker(file) {
  if(file.type==='application/pdf') {
    const pdfjs=await import('pdfjs-dist');
    const {default:workerUrl}=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;
    const doc=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;
    try{
      const page=await doc.getPage(1),content=await page.getTextContent();
      const text=content.items.map(item=>item.str||'').join(' ');
      if(text.trim().length>20)return text;
      const viewport=page.getViewport({scale:1.5}),canvas=document.createElement('canvas');
      canvas.width=viewport.width;canvas.height=viewport.height;
      await page.render({canvas,canvasContext:canvas.getContext('2d'),viewport}).promise;
      const {createWorker}=await import('tesseract.js');const worker=await createWorker('eng');
      try{return(await worker.recognize(canvas)).data.text||'';}finally{await worker.terminate();}
    }finally{await doc.destroy();}
  }
  const {createWorker}=await import('tesseract.js');
  const bitmap=await createImageBitmap(file);
  const canvas=document.createElement('canvas');
  const scale=Math.min(2,2400/Math.max(bitmap.width,bitmap.height));
  canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
  const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
  context.filter='grayscale(1) contrast(1.4)';context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  const worker=await createWorker('eng');
  try {const result=await worker.recognize(canvas);return result.data.text||'';}finally{await worker.terminate();}
}

export function validateStickerText(text,batch){
  if(!compact(text).includes(compact(batch.product_name)))return 'The sticker product does not match the inventory product.';
  if(!compact(text).includes(compact(batch.batch_number)))return 'The sticker batch does not match inventory.';
  const dates=[...String(text).matchAll(/\b(20\d{2})[-/.](\d{2})[-/.](\d{2})\b/g)].map(m=>m[1]+'-'+m[2]+'-'+m[3]);
  if(!dates.length)return 'Sticker expiry could not be read. Upload a clearer label with YYYY-MM-DD expiry.';
  if(!dates.includes(batch.expiry_date)||dates.some(d=>d!==batch.expiry_date))return 'Sticker expiry conflicts with inventory. Review the physical label and inventory record.';
  return '';
}
