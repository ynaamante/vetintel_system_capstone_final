import { createWorker } from 'tesseract.js';
import * as pdfjs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const ANALYTES = [
  ['WBC', /\bWBC\b|white blood cells?/i],
  ['RBC', /\bRBC\b|red blood cells?/i],
  ['HGB', /\bHGB\b|hemoglobin/i],
  ['HCT', /\bHCT\b|hematocrit/i],
  ['MCV', /\bMCV\b|mean corpuscular volume/i],
  ['MCH', /\bMCH\b|mean corpuscular hemoglobin(?! concentration)/i],
  ['MCHC', /\bMCHC\b|mean corpuscular hemoglobin concentration/i],
  ['Platelets', /\bPLT\b|platelets?/i],
  ['Neutrophils (Segmented)', /neutrophils?\s*\(?segmented\)?|\bNEU\b/i],
  ['Lymphocytes', /lymphocytes?|\bLYM\b/i],
  ['Monocytes', /monocytes?|\bMON\b/i],
  ['Eosinophils', /eosinophils?|\bEOS\b/i],
  ['Basophils', /basophils?|\bBAS\b/i],
];

const parseReportText = text => {
  const lines = String(text || '').split(/\r?\n/).map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const measurements = [];
  const seen = new Set();
  lines.forEach(line => {
    const match = ANALYTES.find(([name, pattern]) => !seen.has(name) && pattern.test(line));
    if (!match) return;
    const rangePattern = /(-?\d+(?:\.\d+)?)\s*(?:-|[\u2010-\u2015\u2212]|to)\s*(-?\d+(?:\.\d+)?)/i;
    let range = line.match(rangePattern);
    const numbers = [...line.matchAll(/-?\d+(?:\.\d+)?/g)];
    if (!range && numbers.length >= 3) {
      const lowToken = numbers[numbers.length - 2];
      const highToken = numbers[numbers.length - 1];
      range = [line.slice(lowToken.index, highToken.index + highToken[0].length), lowToken[0], highToken[0]];
      range.index = lowToken.index;
    }
    if (!range) return;
    const resultCandidates = [...line.slice(0, range.index).matchAll(/-?\d+(?:\.\d+)?/g)];
    if (!resultCandidates.length) return;
    const [name] = match;
    const valueToken = resultCandidates[0];
    const low = range[1];
    const high = range[2];
    const unit = line.slice(valueToken.index + valueToken[0].length, range.index)
      .replace(/[|()[\]]/g, '').trim();
    const afterRange = line.slice(range.index + range[0].length);
    const status = /\bcritical\b/i.test(afterRange) ? 'Critical'
      : /\bhigh\b/i.test(afterRange) ? 'High'
        : /\blow\b/i.test(afterRange) ? 'Low'
          : /\bnormal\b/i.test(afterRange) ? 'Normal' : 'Not assessed';
    measurements.push({ name, value: valueToken[0], unit, referenceRange: `${low} - ${high}`, status });
    seen.add(name);
  });
  const captureSection = (heading, stopHeadings) => {
    const start = lines.findIndex(line => heading.test(line));
    if (start < 0) return '';
    const headingMatch = lines[start].match(heading);
    const headingTail = headingMatch ? lines[start].slice(headingMatch.index + headingMatch[0].length).replace(/^\s*[:\-–—]*\s*/, '') : '';
    const content = headingTail ? [headingTail] : [];
    for (const line of lines.slice(start + 1)) {
      if (stopHeadings.some(pattern => pattern.test(line))) break;
      if (line) content.push(line);
    }
    return content.join(' ').slice(0, 500);
  };
  const summary = captureSection(/laboratory findings/i, [/veterinarian interpretation/i, /reviewed by/i, /report finalized/i]);
  const interpretation = captureSection(/veterinarian interpretation/i, [/reviewed by/i, /report finalized/i]);
  return { summary, interpretation, measurements, text: lines.join('\n') };
};

const recognizeImage = async image => {
  const bitmap = await createImageBitmap(image);
  const scale = Math.min(2, 2400 / Math.max(bitmap.width, bitmap.height));
  const canvas = globalThis.document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.filter = 'grayscale(1) brightness(1.12) contrast(1.55)';
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const worker = await createWorker('eng');
  try {
    const result = await worker.recognize(canvas);
    return result.data.text || '';
  } finally {
    await worker.terminate();
  }
};

export async function readLabReport(file, onProgress) {
  let text = '';
  if (file.type === 'application/pdf') {
    const pdfDocument = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= Math.min(pdfDocument.numPages, 4); pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const content = await page.getTextContent();
      const rows = new Map();
      content.items.forEach(item => {
        const y = Math.round(item.transform?.[5] || 0);
        rows.set(y, [...(rows.get(y) || []), item.str || '']);
      });
      const pageText = [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, items]) => items.join(' ')).join('\n');
      pages.push(pageText);
      if (pageText.replace(/\s/g, '').length < 40) {
        onProgress?.(`Reading report page ${pageNumber} of ${Math.min(pdfDocument.numPages, 4)}...`);
        const viewport = page.getViewport({ scale: 1.8 });
        const canvas = globalThis.document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise;
        pages.push(await recognizeImage(canvas));
      }
    }
    text = pages.join('\n');
    await pdfDocument.destroy();
  } else {
    onProgress?.('Reading report image...');
    text = await recognizeImage(file);
  }
  return parseReportText(text);
}

export { parseReportText };
