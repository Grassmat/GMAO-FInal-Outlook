import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
if(!fs.existsSync('dist/server/wrangler.json'))throw Error('Exécuter npm run build avant.');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gmao-schema-')),file=path.join(dir,'schema.sql');
try{const sql=fs.readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort().map(n=>fs.readFileSync('drizzle/'+n,'utf8')).join('\n');
fs.writeFileSync(file,sql);
const result=spawnSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state','--file',file],{stdio:'inherit'});
if(result.error)throw result.error;process.exitCode=result.status??1;
}finally{fs.rmSync(dir,{recursive:true,force:true});}
