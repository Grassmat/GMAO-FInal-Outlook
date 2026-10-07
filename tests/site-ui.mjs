import fs from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const source=fs.readFileSync('app/maintenance/sites.tsx','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const exports={};new Function('require','exports',compiled)(require,exports);
let draft;
const model={tab:'Sites',site:'site-principal',sites:[{id:'site-principal',name:'Site principal'},{id:'site-b',name:'Deuxième blanchisserie'}],records:[{kind:'machine',id:'m1',site:'site-principal',archived:false}],setModal(value){draft=value}};
const element=exports.SitesView({model});const html=renderToStaticMarkup(element);
assert.equal((html.match(/Modifier le nom/g)||[]).length,2);assert(html.includes('Site principal'));assert(html.includes('Deuxième blanchisserie'));
function buttons(node){if(!node||typeof node!=='object')return [];const children=React.Children.toArray(node.props?.children);return [...(node.type==='button'?[node]:[]),...children.flatMap(buttons)]}
const actions=buttons(element);actions[0].props.onClick();assert.equal(draft.id,'site-principal');assert.equal(draft.name,'Site principal');actions[1].props.onClick();assert.equal(draft.id,'site-b');assert.equal(draft.name,'Deuxième blanchisserie');
console.log('PASS: rename buttons open the correct site, including the original site.');
