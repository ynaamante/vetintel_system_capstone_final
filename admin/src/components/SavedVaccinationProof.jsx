import {useEffect,useRef,useState} from 'react';

export default function SavedVaccinationProof({attachmentId,user}){
  const dialog=useRef(null);
  const [file,setFile]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();let url='';setFile(null);setError('');
    const api=(import.meta.env.VITE_API_URL||'http://localhost:3000/api').replace(/\/+$/,'');
    fetch(`${api}/clinic-records/attachments/${encodeURIComponent(attachmentId)}/content?clinic_id=${encodeURIComponent(user.clinic_id)}`,{headers:{Authorization:`Bearer ${user.token}`},signal:controller.signal}).then(async response=>{
      if(!response.ok)throw new Error(response.status===404?'Saved attachment was not found.':'Unable to load the saved attachment.');
      const blob=await response.blob();if(controller.signal.aborted)return;
      url=URL.createObjectURL(blob);setFile({url,type:blob.type});
    }).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
    return()=>{controller.abort();if(url)URL.revokeObjectURL(url);};
  },[attachmentId,user.token,user.clinic_id,retry]);
  const pdf=file?.type.includes('pdf');
  return <div style={{marginTop:10}}>
    {error?<p role="alert" className="vve-error">{error} <button type="button" onClick={()=>setRetry(value=>value+1)}>Retry</button></p>:file?<div style={{display:'flex',alignItems:'center',gap:12}}>
      {!pdf&&<button type="button" aria-label="Preview saved vaccine sticker" onClick={()=>dialog.current.showModal()} style={{padding:0,border:'1px solid #d3e4df',borderRadius:7,background:'#fff',cursor:'pointer'}}><img src={file.url} alt="Saved vaccine sticker" style={{display:'block',width:120,height:78,objectFit:'contain'}}/></button>}
      <button type="button" onClick={()=>dialog.current.showModal()}>View Saved {pdf?'PDF':'Sticker'}</button>
    </div>:<p role="status">Loading saved attachment…</p>}
    <dialog ref={dialog} aria-label="Saved vaccination attachment" style={{width:'min(850px,calc(100vw - 40px))',maxWidth:'calc(100vw - 40px)',maxHeight:'calc(100dvh - 40px)',padding:18,border:'1px solid #d3e4df',borderRadius:12,color:'#004f43'}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:12}}><strong>Vaccination Attachment</strong><button type="button" onClick={()=>dialog.current.close()}>Close</button></header>
      {file&&(pdf?<iframe src={file.url} title="Saved vaccination PDF" style={{width:'100%',height:'65vh',border:0}}/>:<img src={file.url} alt="Full saved vaccination sticker" style={{display:'block',maxWidth:'100%',maxHeight:'65vh',objectFit:'contain',margin:'0 auto'}}/>)}
      {file&&<a href={file.url} download={`vaccination-proof-${attachmentId}.${pdf?'pdf':file.type.includes('png')?'png':file.type.includes('webp')?'webp':'jpg'}`} style={{display:'inline-block',marginTop:12}}>Download attachment</a>}
    </dialog>
  </div>;
}
