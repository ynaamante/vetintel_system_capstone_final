export default function ServiceInventorySummary({service}) {
  const items=service?.inventory_links||[];
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  return <span className="service-inventory-summary" style={{display:'grid',gap:3,marginTop:5,fontSize:'.7rem',lineHeight:1.45,fontWeight:400,color:'#526b64',whiteSpace:'normal'}}>
    {items.length ? items.map(item=>{
      const expired=item.expiry_date&&item.expiry_date<today;
      const available=item.active&&!expired&&Number(item.quantity)>0;
      const status=!item.active?'Unavailable':expired?'Expired':Number(item.quantity)<=0?'Out of stock':`${item.quantity} ${item.unit} ${item.is_equipment?'in inventory':'available'}`;
      return <span key={item.id} style={{display:'block',color:available?'#526b64':'#a35a06'}}>{item.name} — {status}</span>;
    }) : <span>No inventory linked</span>}
    {service?.inventory_notes&&<span style={{display:'block',color:'#a35a06'}}>{service.inventory_notes}</span>}
  </span>;
}
