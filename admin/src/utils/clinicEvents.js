export function watchClinicEvents(user) {
  const controller=new AbortController();
  let retry;
  const connect=async()=>{
    try{
      const api=(import.meta.env.VITE_API_URL||'http://localhost:3000/api').replace(/\/+$/,'');
      const response=await fetch(`${api}/clinic-records/events`,{headers:{Authorization:`Bearer ${user.token}`},signal:controller.signal});
      if(!response.ok||!response.body)throw new Error('Live events unavailable');
      const reader=response.body.getReader(),decoder=new TextDecoder();let pending='';
      while(!controller.signal.aborted){const {done,value}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});let end;while((end=pending.indexOf('\n\n'))>=0){const packet=pending.slice(0,end);pending=pending.slice(end+2);if(packet.startsWith('data: ')){window.dispatchEvent(new Event('vetintel:appointment-updated'));window.dispatchEvent(new Event('vetintel:billing-updated'));try { if (JSON.parse(packet.slice(6)).type === 'registration') window.dispatchEvent(new Event('vetintel:registration-updated')); } catch {}}}}
    }catch(error){if(error.name==='AbortError')return;}
    if(!controller.signal.aborted)retry=window.setTimeout(connect,3000);
  };
  connect();return()=>{controller.abort();window.clearTimeout(retry);};
}
