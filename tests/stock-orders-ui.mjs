import fs from 'node:fs';import path from 'node:path';import ts from 'typescript';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const cache=new Map();function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;const require=createRequire(file),exports={};cache.set(file,exports);new Function('require','exports',output)(specifier=>{if(!specifier.startsWith('.'))return require(specifier);const base=path.resolve(path.dirname(file),specifier);return load([base,base+'.ts',base+'.tsx'].find(f=>fs.existsSync(f)))},exports);return exports;}
function nodes(node,type){if(!node||typeof node!=='object')return [];return [...(node.type===type?[node]:[]),...React.Children.toArray(node.props?.children).flatMap(child=>nodes(child,type))];}
const {RecordEditor}=load('app/maintenance/record-editor.tsx'),{OrderFields}=load('app/maintenance/order-fields.tsx'),{StockView}=load('app/maintenance/stock.tsx'),{OrdersView}=load('app/maintenance/orders.tsx');
function captureOrders(model){let tree;function Capture(){tree=OrdersView({model});return tree;}renderToStaticMarkup(React.createElement(Capture));return tree;}
let draft;const part={id:'part1',kind:'part',site:'site-principal',name:'Roulement',reference:'SKF-6205',minimum:2,machines:['m1']};
const model={user:{role:'admin'},onSessionChanged(){},modal:{kind:'part',name:'Nouvelle pièce',quantity:6,machines:[]},machines:[{id:'m1',name:'Calandre'}],parts:[part],displayedParts:[part],records:[part],site:'site-principal',tab:'Magasin',qty(){return 7},setModal(value){draft=value},save(){},saving:false,error:''};
const render=model=>renderToStaticMarkup(React.createElement(RecordEditor,{model}));
let html=render(model);assert(html.includes('Quantité ajoutée au stock'));assert(html.includes('value="6"'));assert(!html.includes('Stock minimum'));
html=render({...model,modal:{...part}});assert(!html.includes('Quantité ajoutée au stock'));assert(!html.includes('Stock minimum'));
const stock=StockView({model});nodes(stock,'button').find(button=>button.props['aria-label']==='Modifier le minimum de Roulement').props.onClick();assert.equal(draft.action,'minimum');assert.equal(draft.minimum,2);
html=render({...model,modal:draft});assert(html.includes('Minimum à garder en stock'));assert(html.includes('ne modifie pas la quantité disponible'));
nodes(stock,'button').find(button=>button.props['aria-label']==='Supprimer Roulement').props.onClick();assert.equal(draft.action,'delete-part');assert.equal(draft.id,'part1');html=render({...model,modal:draft});assert(html.includes('Supprimer du magasin'));assert(html.includes('Stock actuel : 7'));assert(html.includes('conservés'));
const purchase={id:'order1',kind:'order',site:'site-principal',name:'Roulement',reference:'SKF-6205',part:'part1',quantity:4,supplier:'SKF France',status:'Commandé',revision:1};
html=render({...model,modal:purchase});assert(html.includes('Référence déjà en magasin'));assert(html.includes('SKF France'));assert(html.includes('Quantité commandée'));assert(html.includes('Pièce reçue'));
const fields=OrderFields({model:{...model,modal:purchase}});nodes(fields,'input').find(input=>input.props.type==='checkbox').props.onChange({target:{checked:true}});assert.equal(draft.status,'Reçu');assert.equal(draft.quantity,4);
html=render({...model,modal:{...purchase,part:'',name:'Nouvelle pièce',status:'Devis'}});assert(html.includes('Nom de la nouvelle pièce'));assert(html.includes('créera cette référence'));
const receivedFields=OrderFields({model:{...model,modal:{...purchase,status:'Reçu',receivedAt:'2026-10-02'}}});assert(nodes(receivedFields,'input').find(input=>input.props.type==='number').props.disabled);assert(nodes(receivedFields,'input').find(input=>input.props.type==='checkbox').props.disabled);
const orderModel={...model,tab:'Devis & achats',records:[purchase]},orders=captureOrders(orderModel);html=renderToStaticMarkup(orders);assert(html.includes('Fournisseur'));assert(html.includes('SKF France'));nodes(orders,'button').find(button=>React.Children.toArray(button.props.children).includes('Marquer reçu')).props.onClick();assert.equal(draft.status,'Reçu');assert.equal(draft.originalStatus,'Commandé');assert.equal(draft.part,'part1');
console.log('PASS: initial quantity without minimum, independent minimum editing, reference removal confirmation, supplier and quantity fields, existing/new reference selection and receipt controls.');
// PDFs can be selected before creating a quote; deletion controls are visible only to admins.
html=render({...model,modal:{kind:'order',name:'Devis neuf',quantity:1,status:'Devis'}});assert(html.includes('Joindre un PDF au devis'));assert(html.includes('application/pdf,.pdf'));
const file=new File(['%PDF-1.7\nTest devis\n%%EOF'],'devis-test.pdf',{type:'application/pdf'});const pdfFields=OrderFields({model:{...model,modal:purchase}});nodes(pdfFields,'input').find(input=>input.props.type==='file').props.onChange({target:{files:[file]}});assert.equal(draft.pdfFile,file);assert.match(draft.documentId,/^[a-f0-9-]{36}$/);
const adminOrders=captureOrders(orderModel);nodes(adminOrders,'button').find(button=>React.Children.toArray(button.props.children).includes('Supprimer')).props.onClick();assert.equal(draft.action,'delete-order');assert.equal(draft.id,'order1');
html=render({...model,modal:{...draft,status:'Reçu'}});assert(html.includes('Supprimer le devis'));assert(html.includes('restent dans le stock'));
for(const role of ['director','manager','technician']){assert(!renderToStaticMarkup(StockView({model:{...model,user:{role}}})).includes('Supprimer'));assert(!renderToStaticMarkup(React.createElement(OrdersView,{model:{...orderModel,user:{role}}})).includes('Supprimer'))}
assert(!renderToStaticMarkup(React.createElement(OrdersView,{model:{...orderModel,records:[{...purchase,deleted:true}]}})).includes('SKF France'));
// Exercise the save workflow when quote creation succeeds but PDF upload needs a retry.
let hookStates=[],stateIndex=0,refs=[],refIndex=0;
const fakeReact={...React,useState(initial){const index=stateIndex++;if(!(index in hookStates))hookStates[index]=typeof initial==='function'?initial():initial;return [hookStates[index],value=>{hookStates[index]=typeof value==='function'?value(hookStates[index]):value}]},useRef(initial){const index=refIndex++;return refs[index]|| (refs[index]={current:initial})},useCallback(fn){return fn},useEffect(){}};
const maintenanceFile=path.resolve('app/maintenance/use-maintenance.ts'),maintenanceCode=ts.transpileModule(fs.readFileSync(maintenanceFile,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,maintenanceExports={},maintenanceRequire=createRequire(maintenanceFile);
new Function('require','exports',maintenanceCode)(specifier=>specifier==='react'?fakeReact:maintenanceRequire(specifier),maintenanceExports);
const stableQuoteId=crypto.randomUUID(),stablePdfId=crypto.randomUUID(),postPayloads=[],uploadIds=[];let uploadAttempts=0;
const originalFetch=globalThis.fetch;
globalThis.fetch=async (url,options={})=>{
 if(url==='/api/data'&&options.method==='POST'){const payload=JSON.parse(options.body);postPayloads.push(payload);return Response.json({ok:true,record:{id:stableQuoteId,kind:'order',site:'site-principal',name:'Test',part:'',quantity:2,status:'Reçu',receivedAt:'2026-10-02',revision:postPayloads.length}})}
 if(url==='/api/order-documents'){uploadIds.push(options.body.get('uploadId'));return ++uploadAttempts===1?Response.json({error:'Stockage temporairement indisponible'},{status:503}):Response.json({document:{id:stablePdfId}})}
 return Response.json({records:[],movements:[],sites:[{id:'site-principal',name:'Site principal'}],reports:null});
};
function maintenance(){stateIndex=0;refIndex=0;return maintenanceExports.useMaintenance({role:'admin',site:'site-principal'},()=>{})}
try{
 let active=maintenance();await active.save({kind:'order',site:'site-principal',name:'Test',quantity:2,status:'Reçu',clientId:stableQuoteId,pdfFile:file,documentId:stablePdfId});
 active=maintenance();assert(active.error.includes('Le devis est enregistré'));assert.equal(active.modal.id,stableQuoteId);assert.equal(active.modal.revision,1);assert.equal(active.modal.pdfFile,file);assert.equal(postPayloads[0].pdfFile,undefined);
 await active.save(active.modal);active=maintenance();assert.equal(active.modal,null);assert.equal(postPayloads[1].id,stableQuoteId);assert.equal(postPayloads[1].revision,1);assert.deepEqual(uploadIds,[stablePdfId,stablePdfId]);
 const beforeInvalid=postPayloads.length;await active.save({kind:'order',name:'Test',pdfFile:new File(['not a pdf'],'bad.pdf')});assert.equal(postPayloads.length,beforeInvalid);
}finally{globalThis.fetch=originalFetch}
console.log('PASS: quote PDF selection, admin-only deletion controls, hidden deleted quotes, and safe PDF retry after the quote has already been saved.');
assert(render({...model,modal:purchase}).includes('Associer à un rapport en attente de pièce'));
assert(!renderToStaticMarkup(OrderFields({model:{...model,modal:purchase},hideReportLink:true})).includes('Associer à un rapport en attente de pièce'));
console.log('PASS: quote-to-report association control and shared inline fields without recursive report linking.');
// Quote lists use creation order, independently of identifiers, names or receipt status.
const sortedQuotes=[{...purchase,id:'quote-old',name:'Z ancien',creationOrder:10,status:'Reçu'}, {...purchase,id:'quote-new',name:'A récent',creationOrder:30}, {...purchase,id:'quote-mid',name:'M intermédiaire',creationOrder:20}];
const sortedHtml=renderToStaticMarkup(React.createElement(OrdersView,{model:{...orderModel,records:sortedQuotes}}));
assert(sortedHtml.indexOf('A récent')<sortedHtml.indexOf('M intermédiaire'));assert(sortedHtml.indexOf('M intermédiaire')<sortedHtml.indexOf('Z ancien'));
const machineSortedHtml=renderToStaticMarkup(React.createElement(OrdersView,{model:{...orderModel,selected:{id:purchase.machine || 'm1'},records:sortedQuotes.map(q=>({...q,machine:purchase.machine || 'm1'}))}}));assert(machineSortedHtml.indexOf('A récent')<machineSortedHtml.indexOf('Z ancien'));
assert.equal(sortedQuotes[0].id,'quote-old');
console.log('PASS: newest quotes appear first in site and machine lists without mutating source records.');
