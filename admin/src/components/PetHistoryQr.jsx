import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import './petHistoryQr.css';

const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
const labels = key => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
function HistorySection({ title, items }) {
  return <section className="pet-share-history-section"><h3>{title}</h3>{!items.length ? <p>No records recorded.</p> : items.map((item, index) => <dl key={index}>{Object.entries(item).filter(([,value]) => value != null && value !== '').map(([key,value]) => <div key={key}><dt>{labels(key)}</dt><dd>{typeof value === 'boolean' ? value ? 'Yes' : 'No' : String(value)}</dd></div>)}</dl>)}</section>;
}
export default function PetHistoryQr({ user }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [camera, setCamera] = useState(false);
  const video = useRef(null), stream = useRef(null), frame = useRef(null), working = useRef(false), generation = useRef(0);
  const doctor = ['doctor','assistant_doctor','veterinarian'].includes(String(user?.role || '').toLowerCase().replace(/[\s-]+/g,'_'));
  const stop = () => { if (frame.current) cancelAnimationFrame(frame.current); stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; setCamera(false); };
  useEffect(() => () => { generation.current++; if (frame.current) cancelAnimationFrame(frame.current); stream.current?.getTracks().forEach(track => track.stop()); }, []);
  const call = async (path, body) => {
    const response = await fetch(apiUrl + path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${user.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to process this request.');
    return data;
  };
  const requestAccess = async value => {
    if (working.current) return;
    if (!/^vetintel:pet-share:[a-f0-9]{64}$/.test(value.trim())) { setError('Choose a valid PetWatch medical-history QR code.'); return; }
    working.current = true; setBusy(true); setError(''); stop();
    const revision = ++generation.current;
    try { const data = await call('/pet-sharing/requests', { token: value.trim() }); if (revision === generation.current) setResult(data); }
    catch (failure) { if (revision === generation.current) setError(failure.message); }
    finally { working.current = false; setBusy(false); }
  };
  useEffect(() => {
    if (!open || !result?.id || !['pending','approved'].includes(result.status)) return;
    let active = true, fetching = false;
    const refresh = async () => {
      if (fetching) return; fetching = true;
      try { const data = await call(`/pet-sharing/requests/${encodeURIComponent(result.id)}`); if (active) { setResult(data); setError(''); } }
      catch (failure) { if (active) { setResult(current => ({ id: current.id, status: 'unavailable' })); setError(failure.message); } }
      finally { fetching = false; }
    };
    void refresh(); const timer = setInterval(refresh, 3000);
    return () => { active = false; clearInterval(timer); };
  }, [open,result?.id,result?.status,user?.token]);
  const startCamera = async () => {
    setError(''); const revision = ++generation.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera requires HTTPS or localhost. You can upload a QR image instead.');
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (revision !== generation.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media; setCamera(true);
      video.current.srcObject = media; await video.current.play();
      const canvas = document.createElement('canvas'), context = canvas.getContext('2d', { willReadFrequently: true });
      let last = 0;
      const scan = time => {
        if (!stream.current || revision !== generation.current) return;
        if (time-last > 250 && video.current?.readyState >= 2) {
          last = time;
          const width = video.current.videoWidth, height = video.current.videoHeight;
          const scale = Math.min(1, 1000 / Math.max(width,height)); canvas.width = Math.round(width*scale); canvas.height = Math.round(height*scale);
          context.drawImage(video.current,0,0,canvas.width,canvas.height);
          const pixels = context.getImageData(0,0,canvas.width,canvas.height), found = jsQR(pixels.data,pixels.width,pixels.height);
          if (found?.data?.startsWith('vetintel:pet-share:')) { setCode(found.data); void requestAccess(found.data); return; }
        }
        frame.current = requestAnimationFrame(scan);
      };
      frame.current = requestAnimationFrame(scan);
    } catch (failure) { stop(); setError(failure.message || 'Unable to open camera. Allow camera access or upload a QR image.'); }
  };
  const readImage = async event => {
    const file = event.target.files?.[0]; if (!file) return;
    setError(''); const url = URL.createObjectURL(file);
    try {
      const image = new Image(); await new Promise((resolve,reject) => { image.onload=resolve;image.onerror=reject;image.src=url; });
      const canvas=document.createElement('canvas'),context=canvas.getContext('2d',{willReadFrequently:true});
      const scale=Math.min(1,1600/Math.max(image.width,image.height));canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);context.drawImage(image,0,0,canvas.width,canvas.height);
      const pixels=context.getImageData(0,0,canvas.width,canvas.height),found=jsQR(pixels.data,pixels.width,pixels.height);
      if(!found)throw new Error('No QR found. Choose a clear image of the pet QR.');setCode(found.data);await requestAccess(found.data);
    } catch(failure){setError(failure.message || 'Unable to read this QR image.');}
    finally{URL.revokeObjectURL(url);event.target.value='';}
  };
  const close = () => { generation.current++; stop(); setOpen(false);setResult(null);setCode('');setError(''); };
  if (!doctor) return null;
  return <><button type="button" className="records-add" onClick={() => setOpen(true)}>Scan Pet QR</button>{open && <div className="pet-share-backdrop"><section className="pet-share-dialog" role="dialog" aria-modal="true" aria-label="Scan pet medical-history QR"><header><div><h2>Pet medical-history QR</h2><p>Owner approval is required before any medical history is shown.</p></div><button type="button" onClick={close} aria-label="Close QR scanner">×</button></header>
    {error && <p role="alert" className="pet-share-error">{error}</p>}
    {!result && <><video ref={video} playsInline muted hidden={!camera} className="pet-share-camera" /><div className="pet-share-actions"><button type="button" disabled={busy || camera} onClick={startCamera}>Open camera</button>{camera && <button type="button" onClick={stop}>Stop camera</button>}<label className="pet-share-upload">Upload QR image<input type="file" accept="image/*" disabled={busy} onChange={readImage} /></label></div><label className="pet-share-code">Or paste a PetWatch QR code<textarea value={code} onChange={e=>setCode(e.target.value)} placeholder="vetintel:pet-share:…" /></label><button type="button" disabled={busy || !code.trim()} onClick={() => requestAccess(code)}>{busy ? 'Sending request…' : 'Request owner approval'}</button></>}
    {result && <div className="pet-share-status"><strong>{({pending:'Waiting for owner approval',approved:'Owner approved access',denied:'Owner declined access',revoked:'Owner revoked access',expired:'Access request or permission expired',unavailable:'Access is unavailable'})[result.status] || result.status}</strong><p>{result.status==='pending'?'Ask the owner to open Alerts in PetWatch and choose Allow access. Medical history stays hidden until then.':result.status==='approved'?`Read-only access expires ${new Date(result.accessExpiresAt).toLocaleTimeString()}.`:'Ask the owner for a new QR if you need another access request.'}</p></div>}
    {result?.status==='approved' && result.history && <div className="pet-share-history"><HistorySection title="Pet details" items={[result.history.pet]} />{['consultations','vaccinations','diagnoses','treatments','medications'].map(key=><HistorySection key={key} title={labels(key)} items={result.history[key]} />)}</div>}
    {result && !['pending','approved'].includes(result.status) && <button type="button" onClick={() => {setResult(null);setCode('');setError('');}}>Scan another QR</button>}
  </section></div>}</>;
}
