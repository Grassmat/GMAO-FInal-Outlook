import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+f,'utf8'));
function statement(query,values=[]){return {bind(...v){return statement(query,v)},async first(){return sql.prepare(query).get(...values)||null},async all(){return {results:sql.prepare(query).all(...values)}},async run(){if(/RETURNING/.test(query))return {results:sql.prepare(query).all(...values),meta:{changes:1}};const r=sql.prepare(query).run(...values);return {results:[],meta:{changes:Number(r.changes)}}}}}
const db={prepare:statement,async batch(list){sql.exec('BEGIN');try{const result=[];for(const s of list)result.push(await s.run());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};
function module(file,deps,returns){let code=fs.readFileSync(file,'utf8').replace(/^import .*;$/gm,'').replace(/\bexport /g,'');code=ts.transpile(code,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS});return new Function(...Object.keys(deps),code+';return {'+returns.join(',')+'};')(...Object.values(deps))}


const env={};const auth=module('lib/auth.ts',{env,database:()=>db},['AppError','globalAccess','allowReadSite','allowSite','passwordHash','seedAdmin']);
const repo=module('lib/maintenance/repository.ts',{database:()=>db,...auth},['initializeMaintenance','validSite','saveSite']);
const forms=module('lib/interventions/service.ts',{database:()=>db,...auth,...repo,initialQuestions:[{id:'technicians',type:'multiselect',options:[]} ]},['initializeInterventions','getInterventionForm']);
await repo.initializeMaintenance();await forms.initializeInterventions();
assert.equal(sql.prepare('SELECT COUNT(*) n FROM records').get().n,0);
assert.equal(sql.prepare('SELECT COUNT(*) n FROM interventions').get().n,0);
assert.equal(sql.prepare('SELECT COUNT(*) n FROM users').get().n,0);
assert.equal(sql.prepare('SELECT COUNT(*) n FROM mail_configuration').get().n,0);
env.BOOTSTRAP_ADMIN_HASH=await auth.passwordHash('Initial test phrase');await auth.seedAdmin();
const admin=sql.prepare('SELECT * FROM users').get();assert.equal(admin.name,'Administrateur');assert.equal(admin.role,'admin');assert.equal(admin.change_password,1);
await repo.saveSite(admin,{name:'Entreprise de test'});const site=sql.prepare("SELECT id FROM records WHERE kind='site'").get().id;
sql.prepare('INSERT INTO users(id,username,name,role,site,password,active,change_password) VALUES(?,?,?,?,?,?,1,0)').run('tech','tech','Technicien fictif','technician',site,env.BOOTSTRAP_ADMIN_HASH);
assert.deepEqual((await forms.getInterventionForm(site)).questions[0].options,['Technicien fictif']);
assert.equal(sql.prepare('SELECT COUNT(*) n FROM movements').get().n,0);
console.log('PASS: genuinely blank schema, no company imports, explicit first admin, first site and dynamic technicians.');
