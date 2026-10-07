import ts from 'typescript';import fs from 'node:fs';import {createInterface} from 'node:readline/promises';
let source=fs.readFileSync(new URL('../lib/auth.ts',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace(/\bexport /g,'');
const code=ts.transpile(source,{target:ts.ScriptTarget.ES2022});
const {passwordHash,validatePassword}=new Function(code+';return {passwordHash,validatePassword};')();
const rl=createInterface({input:process.stdin,output:process.stdout});
const password=await rl.question('Mot de passe provisoire (saisie visible, uniquement en local) : ');rl.close();
validatePassword(password);console.log(await passwordHash(password));
