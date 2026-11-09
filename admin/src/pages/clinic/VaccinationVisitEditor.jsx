import VaccinationVisitModal from './VaccinationVisitModal';
import {useEffect,useRef,useState} from 'react';
import StatusIndicator from '../../components/StatusIndicator';
import ClinicAttachmentImage from '../../components/ClinicAttachmentImage';
import LabDateTimePicker from '../../components/LabDateTimePicker';
import {visitRequest} from './VisitWorkflowDialog';
import {matchStickerBatch,readVaccineSticker,validateStickerText} from '../../utils/vaccineStickerReader';
import './vaccinationVisit.css';
const api=(import.meta.env.VITE_API_URL||'http://localhost:3000/api').replace(/\/+$/,'');
const clock=value=>value?new Date(value).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'—';
const dataUrl=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Unable to read sticker image.'));reader.readAsDataURL(file);});
export default function VaccinationVisitEditor({user,appointmentId,onClose,onChanged,onEnded}){
  const dialog=useRef(null),fileInput=useRef(null),batchInput=useRef(null),scanVersion=useRef(0);
  const [data,setData]=useState(null),[inventory,setInventory]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[stickerText,setStickerText]=useState(''),[stickerIssue,setStickerIssue]=useState(''),[scan,setScan]=useState(''),[file,setFile]=useState(null),[preview,setPreview]=useState(''),[proofRemoved,setProofRemoved]=useState(false);
  const [form,setForm]=useState({inventory_batch_id:'',dose:'',route:'',next_due:'',manufacturer:'',batch_number:'',expiry_date:'',vaccine_name:'',details_confirmed:false,proof_confirmed:false});
  const [verifyAttestation,setVerifyAttestation]=useState(false),[now,setNow]=useState(Date.now());
  const load=async initial=>{
    const result=await visitRequest(user,appointmentId);setData(result);
    if(initial){const draft=result.visit.notes?.vaccination_draft||{},v=result.vaccinations[0]||{},details=result.visit.notes?.vaccination_details||{};setForm({inventory_batch_id:draft.inventory_batch_id||'',dose:draft.dose||v.dose||details.dose||'',manufacturer:draft.manufacturer||v.manufacturer||details.manufacturer||'',batch_number:draft.batch_number||v.batch_number||details.lot_number||'',expiry_date:draft.expiry_date||v.expiry_date||details.expiry_date||'',vaccine_name:v.vaccine_name||result.visit.notes?.vaccination_type||'',route:draft.route||'',next_due:draft.next_due||v.next_due||details.next_due||'',details_confirmed:!!draft.details_confirmed,proof_confirmed:!!draft.proof_confirmed});}
    return result;
  };
  useEffect(()=>{
    dialog.current?.showModal();const previous=document.activeElement;let active=true;
    Promise.all([visitRequest(user,appointmentId),fetch(`${api}/clinic-records/vaccine-inventory`,{headers:{Authorization:`Bearer ${user.token}`}}).then(async r=>{const body=await r.json();if(!r.ok)throw new Error(body.error||'Unable to load vaccine inventory.');return body;})]).then(([result,stock])=>{
      if(!active)return;setData(result);setInventory(stock);const draft=result.visit.notes?.vaccination_draft||{},v=result.vaccinations[0]||{},details=result.visit.notes?.vaccination_details||{};
      setForm({inventory_batch_id:draft.inventory_batch_id||'',dose:draft.dose||v.dose||details.dose||'',manufacturer:draft.manufacturer||v.manufacturer||details.manufacturer||'',batch_number:draft.batch_number||v.batch_number||details.lot_number||'',expiry_date:draft.expiry_date||v.expiry_date||details.expiry_date||'',vaccine_name:v.vaccine_name||result.visit.notes?.vaccination_type||'',route:draft.route||'',next_due:draft.next_due||v.next_due||details.next_due||'',details_confirmed:!!draft.details_confirmed,proof_confirmed:!!draft.proof_confirmed});
    }).catch(e=>{if(active)setError(e.message);});
    const timer=window.setInterval(()=>setNow(Date.now()),30000);
    return()=>{active=false;scanVersion.current++;window.clearInterval(timer);previous?.focus();};
  },[appointmentId,user.token]);
  useEffect(()=>{if(!file){setPreview('');return undefined;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
  const batch=inventory.find(row=>String(row.id)===String(form.inventory_batch_id)),visit=data?.visit,vaccine=data?.vaccinations[0];
  const administered=vaccine&&vaccine.status!=='scheduled',verified=!!vaccine?.verified,ended=visit?.consultation_status==='completed',active=visit?.consultation_status==='in_progress';
  const hasProof=!!file||(!proofRemoved&&!!vaccine?.sticker_attachment_id);
  const service=data?.catalog.find(row=>String(row.id)===String(visit?.notes?.service_catalog_item_id||batch?.catalog_item_id));
  const productIssue=form.inventory_batch_id&&!service?.inventory_links?.some(item=>String(item.vaccine_batch_id)===String(form.inventory_batch_id))?'Wrong product batch: use an inventory product linked to this service.':'';
  const change=(key,value)=>setForm(current=>({...current,[key]:value,...(['dose','route','next_due','manufacturer','batch_number','expiry_date'].includes(key)?{details_confirmed:false}:{}),...(['manufacturer','batch_number','expiry_date'].includes(key)?{inventory_batch_id:''}:{})}));
  const chooseBatch=(row,automatic=false)=>{
    setForm(current=>({...current,inventory_batch_id:row?.id||'',vaccine_name:row?.product_name||current.vaccine_name,manufacturer:row?.manufacturer||'',batch_number:row?.batch_number||'',expiry_date:row?.expiry_date||'',dose:current.dose||row?.default_dose||'',route:current.route||row?.default_route||'',details_confirmed:false}));
    if(!automatic)setScan('Inventory batch selected. Review its details against the physical sticker.');
  };
  const selectFile=async event=>{
    const selected=event.target.files?.[0];event.target.value='';if(!selected)return;
    if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(selected.type)||selected.size>5*1024*1024){setError('Choose a JPG, PNG, WEBP, or PDF proof file up to 5 MB.');return;}
    setStickerText('');setStickerIssue('Reading sticker. Wait for validation to finish.');
    const version=++scanVersion.current;setFile(selected);setProofRemoved(false);setError('');setScan('Reading sticker and matching inventory…');
    setForm(current=>({...current,inventory_batch_id:'',details_confirmed:false,proof_confirmed:false}));
    try{const text=await readVaccineSticker(selected);if(version!==scanVersion.current)return;setStickerText(text);const match=matchStickerBatch(text,inventory);
      if(match.batch){const linked=service?.inventory_links?.some(item=>String(item.vaccine_batch_id)===String(match.batch.id));const problem=!linked?'Wrong vaccine: this sticker belongs to a product that is not linked to the selected service.':validateStickerText(text,match.batch);if(problem){setStickerIssue(problem);setError(problem);setScan('Sticker rejected. Upload the correct product label.');return;}setStickerIssue('');chooseBatch(match.batch,true);setScan('Sticker batch matched to inventory. Manufacturer, batch, and expiry are filled from the saved batch.');}
      else {setStickerIssue('No unique saved batch matched this sticker. Upload a clearer correct label.');setScan(match.ambiguous?'Multiple inventory batches match. Review and enter the manufacturer, batch, and expiry.':'No unique inventory match found. Upload a clearer correct label.');}
    }catch(e){if(version===scanVersion.current){setStickerIssue('Sticker could not be read. Upload a clearer image to validate it.');setScan('Sticker validation unsuccessful.');}}
  };
  const save=async action=>{
    if(action==='record_vaccination'&&stickerIssue){setError(stickerIssue);return;}
    setBusy(true);setError('');try{
      const proof=file?{filename:file.name,content_type:file.type,data:await dataUrl(file),ocr_text:stickerText}:undefined;
      await visitRequest(user,appointmentId,{action,...form,vaccine_name:form.vaccine_name||vaccine?.vaccine_name||visit?.notes?.vaccination_type,proof});
      setFile(null);setProofRemoved(false);await load(false);onChanged?.();window.dispatchEvent(new Event('vetintel:appointment-updated'));
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const verify=async()=>{setBusy(true);setError('');try{
    const response=await fetch(`${api}/clinic-records/vaccinations/${vaccine.id}/verification`,{method:'PATCH',headers:{Authorization:`Bearer ${user.token}`,'Content-Type':'application/json'},body:JSON.stringify({verified:true,attestation_confirmed:verifyAttestation,reason:'Veterinarian confirmed administration and checked inventory-linked sticker proof.'})});
    const body=await response.json();if(!response.ok)throw new Error(body.error||'Unable to verify vaccination.');await load(false);onChanged?.();
  }catch(e){setError(e.message);}finally{setBusy(false);}};
  const end=async()=>{setBusy(true);setError('');try{await visitRequest(user,appointmentId,{action:'end'});await load(false);onChanged?.();window.dispatchEvent(new Event('vetintel:appointment-updated'));onEnded?.(appointmentId);}catch(e){setError(e.message);}finally{setBusy(false);}};
  return <VaccinationVisitModal dialog={dialog} user={user} appointmentId={appointmentId} data={data} error={error||stickerIssue||productIssue} validationError={stickerIssue||(!service?.inventory_links?.some(item=>String(item.vaccine_batch_id)===String(form.inventory_batch_id))?'Select the correct linked product batch.':'')} busy={busy} scan={scan} file={file} fileInput={fileInput} preview={preview} form={form} change={change} selectFile={selectFile} save={save} verify={verify} end={end} verifyAttestation={verifyAttestation} setVerifyAttestation={setVerifyAttestation} hasProof={hasProof} administered={administered} verified={verified} ended={ended} active={active} service={service} now={now} onClose={onClose} />;
}
