const catalog=require('../data/permissionCatalog.json');
const normalize=role=>String(role||'').trim().toLowerCase().replace(/[\s-]+/g,'_');
const profile=role=>['owner','clinic_owner'].includes(normalize(role))?'owner':['doctor','assistant_doctor','veterinarian'].includes(normalize(role))?'doctor':normalize(role);
const allowed=(role,item)=>catalog.ownerDoctorOnly.includes(item)&&!['owner','doctor'].includes(profile(role))?false:profile(role)==='owner'?!catalog.clinicalOnly.includes(item):
  ['doctor','receptionist'].includes(profile(role)) && !catalog.ownerOnly.includes(item) && (profile(role)==='doctor'||(!catalog.clinicalOnly.includes(item)&&!catalog.receptionistExcluded.includes(item)));
const parse=value=>{try{return typeof value==='string'?JSON.parse(value):value||{};}catch{return {};}};
function resolve(role,stored,override) {
  const source=parse(override ?? stored), result={};
  for(const [group,items] of catalog.groups) {
    result[group]={};
    for(const item of items) {
      let value=source[group]?.[item];
      if(typeof value!=='boolean') {
        const equivalent=[];
        for(const [feature,[g,view,create,edit,remove]] of Object.entries(catalog.features)) if(g===group) {
          for(const [key,label] of Object.entries({view,create,edit,delete:remove,export:feature==='Reports'?'Export Reports':null})) {
            if(label===item && typeof source[feature]?.[key]==='boolean') equivalent.push(source[feature][key]);
          }
        }
        value=equivalent.length?equivalent.some(Boolean):override!=null?false:profile(role)==='owner'||(catalog.defaults[profile(role)]||[]).includes(item);
      }
      result[group][item]=profile(role)==='owner'&&catalog.ownerOnly.includes(item) ? true : allowed(role,item)&&value===true;
    }
  }
  return result;
}
const has=(user,item)=>normalize(user?.role)==='super_admin'||allowed(user?.role,item)&&catalog.groups.some(([group])=>user?.permissions?.[group]?.[item]===true);
module.exports={catalog,normalize,profile,allowed,resolve,has};
