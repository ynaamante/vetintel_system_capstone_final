const db=require('../config/db');
(async()=>{try{await require('../services/diseaseMonitoring').ensureSchema();console.log('Disease monitoring rules and alert review schema installed.');}finally{await db.pool.end();}})().catch(error=>{console.error(error.code||error.message);process.exitCode=1;});
