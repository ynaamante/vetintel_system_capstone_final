const db=require('../config/db');
(async()=>{try{await require('../controllers/restockRequestController').ensureSchema();console.log('Owner overview restock-request schema installed. Existing clinic records preserved.');}finally{await db.pool.end();}})().catch(error=>{console.error(error.code||error.message);process.exitCode=1;});
