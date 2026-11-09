const { EventEmitter } = require('events');
const events = new EventEmitter();
events.setMaxListeners(0);
exports.publish = (clinicId, type) => events.emit(String(clinicId), { type });
exports.stream = (req,res) => {
  const clinic=Number(req.user?.clinic_id);
  const role=String(req.user?.role||'').toLowerCase().replace(/[\s-]+/g,'_');
  if(!Number.isInteger(clinic)||clinic<1||!['doctor','assistant_doctor','veterinarian','receptionist','clinic_owner','owner'].includes(role))return res.status(403).json({error:'Clinic staff access required.'});
  res.setHeader('Content-Type','text/event-stream');res.setHeader('Cache-Control','no-cache, no-transform');res.setHeader('Connection','keep-alive');res.setHeader('X-Accel-Buffering','no');
  res.flushHeaders();res.write(': connected\n\n');
  const listener=event=>res.write(`data: ${JSON.stringify(event)}\n\n`);
  events.on(String(clinic),listener);
  const timer=setInterval(()=>res.write(': heartbeat\n\n'),25000);
  req.on('close',()=>{clearInterval(timer);events.off(String(clinic),listener);});
};
