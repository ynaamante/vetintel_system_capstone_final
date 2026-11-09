import { parseServiceDuration } from '../utils/serviceDuration';
import ServiceInventoryLinksDialog from './ServiceInventoryLinksDialog';
import {useEffect,useRef,useState} from 'react';
import RecordActionsModal from './RecordActionsModal';
import StatusIndicator from './StatusIndicator';
import {Icons} from '../icons';
import './sharedCatalog.css';
import '../pages/receptionist/appointmentWorkflow.css';
const api=(import.meta.env.VITE_API_URL||'http://localhost:3000/api').replace(/\/+$/,'');
const types={Consultation:'consultation',Treatment:'treatment',Medication:'medication',Vaccination:'vaccination',Laboratory:'lab_test',Confinement:'inpatient',Product:'product'};
async function request(user,path,method='GET',body){const r=await fetch(`${api}/clinic-records${path}`,{method,headers:{Authorization:`Bearer ${user.token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const result=await r.json();if(!r.ok)throw new Error(result.error||'Catalog request failed.');return result;}
function PriceDialog({row,user,categories,onClose,onSaved}){
  const ref=useRef(null),[form,setForm]=useState({...row,name:row?.name||'',category:row?.category||'Consultation',item_type:row?.item_type||'consultation',unit:row?.unit||'service',unit_price:row?.unit_price??'',active:row?.active??true}),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{const previous=document.activeElement;ref.current.showModal();return()=>previous?.focus();},[]);
  const change=(key,value)=>setForm(current=>({...current,[key]:value}));
  return <dialog ref={ref} className="reception-workflow-dialog clinic-record-details-modal" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}><form onSubmit={async event=>{event.preventDefault();if(form.duration?.trim()&&parseServiceDuration(form.duration)===null){setError('Enter a duration between 5 and 1440 minutes, e.g. 30 minutes or 1 hour.');return;}if(form.unit_price===''||!Number.isFinite(Number(form.unit_price))||Number(form.unit_price)<0){setError('Enter the owner-approved price, including zero only if the item is intentionally free.');return;}setBusy(true);try{await request(user,`/billing-catalog${row?`/${row.id}`:''}`,row?'PUT':'POST',{...form,unit_price:Number(form.unit_price)});onSaved();onClose();}catch(e){setError(e.message);}finally{setBusy(false);}}}><header className="clinic-record-details-header"><div><h2>{row?'Edit Catalog Item':'Add Service'}</h2><p>{row?.source_sku||'Owner-managed service pricing'}</p></div><button type="button" disabled={busy} onClick={onClose}>Close</button></header><section className="reception-workflow-body record-details-content">{error&&<p role="alert" className="reception-action-error">{error}</p>}<div className="shared-catalog-fields"><label>Name<input required value={form.name} onChange={event=>change('name',event.target.value)}/></label><label>Category<select value={form.category} onChange={event=>change('category',event.target.value)}>{[...new Set([...Object.keys(types).filter(k=>k!=='Product'),...categories,form.category])].map(name=><option key={name}>{name}</option>)}</select></label><label>Item type<select value={form.item_type} onChange={event=>change('item_type',event.target.value)}>{Object.entries(types).map(([name,value])=><option key={value} value={value}>{name}</option>)}</select></label><label>Owner price (PHP)<input required type="number" min="0" step="0.01" placeholder="Enter price" value={form.unit_price} onChange={event=>change('unit_price',event.target.value)}/></label><label>Unit<input required value={form.unit} onChange={event=>change('unit',event.target.value)}/></label><label>Duration<input value={form.duration||''} placeholder="e.g. 30 minutes" onChange={event=>change('duration',event.target.value)}/></label><label className="shared-catalog-check"><input type="checkbox" checked={form.active} onChange={event=>change('active',event.target.checked)}/> Available</label></div></section><footer><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="is-save" disabled={busy}>{busy?'Saving…':'Save Changes'}</button></footer></form></dialog>;
}
export default function SharedServicesCatalog({user,sectionTabs}){
  const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[view,setView]=useState('catalog'),[search,setSearch]=useState(''),[category,setCategory]=useState('all'),[status,setStatus]=useState('all'),[page,setPage]=useState(1),[links,setLinks]=useState(null),[selected,setSelected]=useState(null),[edit,setEdit]=useState(null);
  const load=async()=>{try{setRows(await request(user,'/billing-catalog?include_inactive=true&include_unpriced=true'));setError('');}catch(e){setError(e.message);}finally{setLoading(false);}};
  useEffect(()=>{load();const refresh=()=>{if(!document.hidden)load();};window.addEventListener('vetintel:appointment-updated',refresh);window.addEventListener('focus',refresh);return()=>{window.removeEventListener('vetintel:appointment-updated',refresh);window.removeEventListener('focus',refresh);};},[user.token]);
  const services=rows.filter(row=>(row.catalog_kind||'service')==='service');
  const products=rows.filter(row=>row.catalog_kind==='product');
  const categories=[...new Set(services.map(row=>row.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const availabilityOf=row=>!row.active?'Unavailable':row.unit_price==null?'Awaiting Price':'Available';
  const statusCounts={
    total:services.length,
    available:services.filter(row=>availabilityOf(row)==='Available').length,
    unavailable:services.filter(row=>availabilityOf(row)!=='Available').length,
  };
  const categoryTone=name=>({
    consultation:'consultation',
    treatment:'treatment',
    medication:'medication',
    vaccination:'vaccination',
    laboratory:'laboratory',
    surgery:'surgery',
    dental:'dental',
    confinement:'confinement',
  }[String(name||'').toLowerCase()]||'general');
  const sourceRows=view==='products'?products:view==='archived'?services.filter(row=>!row.active):services.filter(row=>row.active);
  const filtered=sourceRows.filter(row=>
    (category==='all'||row.category===category)
    &&(status==='all'||availabilityOf(row)===status)
    &&[row.name,row.category,row.source_sku].some(value=>String(value||'').toLowerCase().includes(search.toLowerCase()))
  );
  const categoryRows=categories.map(name=>({name,count:services.filter(row=>row.category===name&&row.active).length}));
  const pageSize=8,pageCount=Math.max(1,Math.ceil(filtered.length/pageSize));
  const visibleRows=filtered.slice((page-1)*pageSize,page*pageSize);
  useEffect(()=>{setPage(1);},[view,search,category,status]);
  const selectView=nextView=>{setView(nextView);setCategory('all');setStatus('all');setSearch('');};
  const statusClass=row=>availabilityOf(row).toLowerCase().replaceAll(' ','-');
  const descriptionOf=row=>row.description&&!row.description.startsWith('Mock PHP pricing from ')?row.description:'';
  const money=value=>value==null?'Not set':new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(value);
  const tableRows=visibleRows.map(row=><tr key={row.id} className="clinic-action-row shared-service-row" tabIndex={0} onClick={()=>setSelected(row)} onKeyDown={event=>{if(event.target===event.currentTarget&&['Enter',' '].includes(event.key)){event.preventDefault();setSelected(row);}}}>
    <td data-label={view==='products'?'Product':'Service'}><div className="shared-service-name">{row.name}<span>{descriptionOf(row)||row.source_sku||row.unit||'Owner-managed catalog item'}</span></div></td>
    <td data-label="Category"><span className={`shared-category-pill is-${categoryTone(row.category)}`}>{row.category||'General'}</span></td>
    <td data-label="Price" className="shared-service-price">{money(row.unit_price)}</td>
    <td data-label="Duration">{row.duration||'—'}</td>
    <td data-label="Status"><StatusIndicator className={`shared-service-status is-${statusClass(row)}`} status={statusClass(row)==='awaiting-price'?'pending':statusClass(row)} label={availabilityOf(row)}/></td>
    <td data-label="Actions" className="lab-result-actions"><button type="button" className="lab-row-action-trigger clinic-record-actions-trigger" onClick={event=>{event.stopPropagation();setSelected(row);}} aria-label={`Actions for ${row.name}`}>{Icons.chevronRight}</button></td>
  </tr>);
  return <div className="shared-catalog-panel">
    <section className="shared-catalog-stats shared-service-stats">
      {[['Total Services',statusCounts.total,'total'],['Available Services',statusCounts.available,'available'],['Unavailable Services',statusCounts.unavailable,'unavailable']].map(([label,value,tone])=><article className={`is-${tone}`} key={label}><span>{label}</span><strong>{loading?'—':value}</strong></article>)}
    </section>
    <div className="shared-service-toolbar">
      {sectionTabs}
      <div className="shared-service-toolbar-actions">
        <button type="button" className="shared-service-archive" aria-pressed={view==='archived'} onClick={()=>selectView(view==='archived'?'catalog':'archived')}>{view==='archived'?'Back to Services':'Archived Services'}</button>
        <button type="button" className="shared-catalog-add" onClick={()=>setEdit({row:null})}>{Icons.plus} Add Service</button>
      </div>
    </div>
    <section className="shared-catalog-card shared-service-card">
      {view==='categories' ? <div className="shared-category-view">
        <div className="shared-service-heading"><div><h2>Service Categories</h2><p>Browse services by their owner-managed category.</p></div><span>{categories.length} categories</span></div>
        {error&&<p role="alert" className="reception-action-error">{error}</p>}
        {loading?<p className="shared-service-empty">Loading categories…</p>:categoryRows.length?<div className="shared-category-grid">{categoryRows.map(({name,count})=><button type="button" className="shared-category-card" key={name} onClick={()=>{setCategory(name);setView('catalog');}}><span className={`shared-category-pill is-${categoryTone(name)}`}>{name}</span><strong>{count}</strong><small>{count===1?'available service':'available services'}</small></button>)}</div>:<p className="shared-service-empty">No service categories yet.</p>}
      </div>:<>
        <header className="shared-service-heading"><div><h2>{view==='archived'?'Archived Services':view==='products'?'Inventory Products':'Services Catalog'}</h2><p>{view==='archived'?'Unavailable records are kept here and can be restored by editing them.':view==='products'?'Inventory products linked to the clinic catalog.':'Manage service pricing, duration, and availability.'}</p></div></header>
        {view==='catalog'&&<p className="shared-pricing-note">{services.length?'Service rates use the supplied mock pricing list in PHP. The combination booster follows the selected vaccine rate; select that vaccine service when booking. Inventory product prices remain separate and unset.':'No service pricing has been imported yet. Unpriced entries cannot be billed.'}</p>}
        {error&&<p role="alert" className="reception-action-error">{error}</p>}
        <div className="shared-catalog-filters shared-service-filters">
          <label className="lab-results-search">{Icons.search}<input aria-label={`Search ${view==='products'?'products':'services'}`} value={search} placeholder={view==='products'?'Search products or category…':'Search services, category, or SKU…'} onChange={event=>setSearch(event.target.value)}/></label>
          <select aria-label="Filter by status" value={status} onChange={event=>setStatus(event.target.value)}><option value="all">All Statuses</option><option value="Available">Available</option><option value="Awaiting Price">Awaiting Price</option><option value="Unavailable">Unavailable</option></select>
          <select aria-label="Filter by category" value={category} onChange={event=>setCategory(event.target.value)}><option value="all">All Categories</option>{(view==='products'?[...new Set(products.map(row=>row.category).filter(Boolean))].sort():categories).map(name=><option key={name} value={name}>{name}</option>)}</select>
        </div>
        <div className="lab-results-table-wrap shared-service-table-wrap"><table className="lab-results-table shared-service-table"><thead><tr>{[view==='products'?'Product':'Service','Category','Price','Duration','Status',''].map(label=><th key={label} aria-label={label||'Catalog actions'}>{label}</th>)}</tr></thead><tbody>
          {loading?<tr><td colSpan={6} className="lab-results-empty">Loading catalog…</td></tr>:tableRows.length?tableRows:<tr><td colSpan={6} className="lab-results-empty">{view==='archived'?'No archived services.':view==='products'?'No products match these filters.':'No services match these filters.'}</td></tr>}
        </tbody></table></div>
        <footer className="shared-service-footer"><span>Showing {filtered.length?`${(page-1)*pageSize+1}–${Math.min(page*pageSize,filtered.length)} of `:''}{filtered.length} {view==='products'?'products':view==='archived'?'archived services':'services'}</span><div className="shared-service-pagination" aria-label="Catalog pagination"><button type="button" aria-label="Previous page" disabled={page<=1} onClick={()=>setPage(value=>Math.max(1,value-1))}>{Icons.chevronRight}</button>{Array.from({length:pageCount},(_,index)=>index+1).map(number=><button type="button" key={number} className={number===page?'active':''} aria-current={number===page?'page':undefined} onClick={()=>setPage(number)}>{number}</button>)}<button type="button" aria-label="Next page" disabled={page>=pageCount} onClick={()=>setPage(value=>Math.min(pageCount,value+1))}>{Icons.chevronRight}</button></div></footer>
      </>}
    </section>
    {selected&&<RecordActionsModal title="Catalog Actions" recordLabel={selected.source_sku||'Service'} recordName={selected.name} recordMeta={`${selected.category} · ${selected.unit}`} status={selected.unit_price==null?'pending':selected.active?'active':'inactive'} onClose={()=>setSelected(null)} actions={[...(selected.catalog_kind==='service'?[{label:'Link Inventory',description:'Choose products and supplies used by this service across doctor workflows.',onClick:()=>{setLinks(selected);setSelected(null);}}]:[]),{label:selected.unit_price==null?'Set Price':'Edit Details & Price',description:'Save the owner-approved rate used by doctor billing and booking.',onClick:()=>{setEdit({row:selected});setSelected(null);}}]}/>}
    {links&&<ServiceInventoryLinksDialog user={user} row={links} onClose={()=>setLinks(null)} onSaved={load}/>}
    {edit&&<PriceDialog {...edit} user={user} categories={categories} onClose={()=>setEdit(null)} onSaved={load}/>}
  </div>;
}
