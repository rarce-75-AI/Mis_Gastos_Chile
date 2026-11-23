const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('fs'),assert=require('assert');
const html=fs.readFileSync('www/index.html','utf8');
const errs=[];const vc=new VirtualConsole();
vc.on('jsdomError', e=>errs.push(e.message));
const dom=new JSDOM(html,{url:'https://localhost',runScripts:'dangerously',virtualConsole:vc,pretendToBeVisual:true});
const w=dom.window,d=w.document;
function check(t,fn){try{fn();console.log('OK '+t)}catch(e){console.error('FALLO '+t+': '+e.stack);process.exitCode=1}}
check('Inicio carga sin errores',()=>{assert.equal(errs.length,0,errs.join('\n'));assert(d.querySelector('#nav button'));});
check('Navegación a Cuentas',()=>{d.querySelector('[data-tab="cuentas"]').click();assert(d.querySelector('#app').textContent.includes('Cuentas por pagar'));});
check('Abrir formulario de cuenta',()=>{d.querySelector('button[onclick*="openEntryForm"]').click();assert(d.querySelector('#overlay.on'));assert(d.querySelector('#amt'));});
check('Guardar cuenta atrasada',()=>{d.querySelector('#amt').value='48000';d.querySelector('#due').value='2026-10-15';w.save();assert(!d.querySelector('#overlay.on'));assert(d.querySelector('#app').textContent.includes('48.000'));});
check('Navegar a inicio',()=>{d.querySelector('[data-tab="inicio"]').click();assert(d.querySelector('#app').textContent.includes('Saldo total disponible del mes'));});
if(errs.length){console.error(errs.join('\n'));process.exitCode=1}
