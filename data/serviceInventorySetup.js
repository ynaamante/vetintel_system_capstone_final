// Planning resources for the supplied mock catalog. No dosages, drug regimens, or automatic consumption.
const source=require('./importedServicesPricing.json');
const sku=n=>`VI-${String(n).padStart(4,'0')}`;
const exam=[103,113,186,187,188];
const surgery=[104,105,110,160,162,163,164,166,167,194,195,197,198];
const dental=[103,105,110];
const vaccineProducts={'VS-0010':1,'VS-0011':2,'VS-0014':4,'VS-0015':3,'VS-0016':5,'VS-0017':7,'VS-0018':9,'VS-0021':1};
const labs={30:[143,192],31:[144,191,193],32:[148,154],33:[149,152,146,147,190],34:[153],35:[155],36:[156],37:[157],38:[158],39:[159],40:[162,146,147,190],41:[114,146,147,190],42:[112],43:[112]};
module.exports=source.items.map(service=>{
  const number=Number(service.code.slice(3));let items=[],notes='';
  switch(service.category){
    case 'Consultation': items=exam;break;
    case 'Vaccination':
      items=[103,106,132];
      if(vaccineProducts[service.code])items.push(vaccineProducts[service.code]);
      if(number!==16)items.push(115,122);
      if([12,13].includes(number))notes='The exact combination vaccine is not assigned. Confirm antigen coverage and link the stocked product before administration.';
      if(number===19)notes='No standalone FeLV vaccine is listed in the supplied inventory. The combination FeLV/RCP product is linked to Feline 4-in-1.';
      if(number===20)notes='Select the specific vaccine service and its linked product for this booster; price follows that service.';
      break;
    case 'Treatment':
      items=[103];
      if(number>=22&&number<=28)notes='The doctor selects the patient-specific medicine and quantity from clinic inventory during consultation. No drug is preselected.';
      if(number===29){items.push(110);notes='Tick-removal instruments are not listed in the supplied inventory.';}
      if(number===72)items.push(106,124,125,126,131);
      if(number===73){items.push(127,128,129,200);notes='The doctor selects the prescribed fluid and volume from inventory.';}
      if(number===74)items.push(110,133,134,135,137,138);
      if(number===75){items.push(106,115,116,117,120,121,122,132);notes='Select the prescribed injectable medicine, syringe and needle size for the patient.';}
      break;
    case 'Laboratory':items=[103,...(labs[number]||[])];if([42,43].includes(number))notes=`${number===42?'X-ray':'Ultrasound'} equipment is not included in the supplied inventory; only available supporting supplies are linked.`;break;
    case 'Surgery':items=surgery;notes='Planning resources only. The doctor selects anesthesia, medication, suture type, sizes and quantities for the patient.';break;
    case 'Dental':items=number===56?dental:[...dental,104,163,166,172,173,174,195,197,198,203];if(number>=58)notes='Extraction instruments are not listed in the supplied inventory. The doctor selects the necessary medications and supplies.';break;
    case 'Grooming':
      if(number>=60&&number<=62)items=[175,178,204,205];
      else if(number>=63&&number<=66)items=[175,178,182,183,204,205];
      else if(number===67){items=[103,204];notes='Nail clippers are not listed in the supplied inventory.';}
      else if(number===68)items=[103,108,179];
      else items=[103,108,184];
      break;
    case 'Confinement':items=[103,112,185,186,187,199];if(number===71)items.push(196,197,200);notes='The doctor selects patient-specific treatments, fluids, medicines and quantities.';break;
    default:throw Error('Unmapped service category '+service.category);
  }
  return {service_code:service.code,inventory_skus:[...new Set(items)].map(sku),notes};
});
