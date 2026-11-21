import catalog from '../../../data/permissionCatalog.json';
export const normalizeFeatureName=feature=>String(feature||'').trim();
export const normalizeRoleName=role=>String(role||'').trim().toLowerCase().replace(/[-\s]+/g,'_');
export const roleProfile=role=>['owner','clinic_owner'].includes(normalizeRoleName(role))?'owner':['doctor','assistant_doctor','veterinarian'].includes(normalizeRoleName(role))?'doctor':normalizeRoleName(role);
export const permissionAvailable=(role,item)=>catalog.receptionistOnly?.includes(item)&&!['owner','receptionist'].includes(roleProfile(role))?false:catalog.ownerDoctorOnly.includes(item)&&!['owner','doctor'].includes(roleProfile(role))?false:roleProfile(role)==='owner'?!catalog.clinicalOnly.includes(item):
  ['doctor','receptionist'].includes(roleProfile(role))&&!catalog.ownerOnly.includes(item)&&(roleProfile(role)==='doctor'||(!catalog.clinicalOnly.includes(item)&&!catalog.receptionistExcluded.includes(item)));
export const hasAction=(permissions,role,item)=>normalizeRoleName(role)==='super_admin'||catalog.groups.some(([group])=>permissionAvailable(role,item)&&permissions?.[group]?.[item]===true);
const featureAction=(permissions,role,feature,action)=>{
  if(normalizeRoleName(role)==='super_admin')return true;
  const map=catalog.features[normalizeFeatureName(feature)];
  if(map){
    const key=action==='export'?'Export Reports':map[({view:1,create:2,edit:3,delete:4})[action]];
    if(!key||action==='export'&&!['Reports','Disease Monitoring','Risk Monitoring','Community Analytics','Intelligence Dashboard'].includes(feature))return false;
    if(!permissionAvailable(role,key))return false;
    const group=action==='export'?'Disease Intelligence':map[0];
    if(typeof permissions?.[group]?.[key]==='boolean')return permissions[group][key];
  }
  return permissions?.[normalizeFeatureName(feature)]?.[action]===true;
};
export const canViewFeature=(p,r,f)=>featureAction(p,r,f,'view');
export const canCreateFeature=(p,r,f)=>featureAction(p,r,f,'create');
export const canEditFeature=(p,r,f)=>featureAction(p,r,f,'edit');
export const canDeleteFeature=(p,r,f)=>featureAction(p,r,f,'delete');
export const canExportFeature=(p,r,f)=>featureAction(p,r,f,'export');
export const canInteractWithFeature=(p,r,f)=>['create','edit','delete','export'].some(action=>featureAction(p,r,f,action));
export const hasPermissionForFeature=(p,r,f)=>['view','create','edit','delete','export'].some(action=>featureAction(p,r,f,action));
