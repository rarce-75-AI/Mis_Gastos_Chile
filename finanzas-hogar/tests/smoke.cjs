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
check('Abrir formulario de cuenta',()=>{d.querySelector('button[onclick*="openEntryForm"]').click();assert(d.querySelector('#overlay.on'));assert(d.querySelector('#amt'));assert(d.querySelector('#receiptPick'));});
check('Guardar cuenta atrasada',()=>{d.querySelector('#amt').value='48000';d.querySelector('#due').value='2026-10-15';w.save();assert(!d.querySelector('#overlay.on'));assert(d.querySelector('#app').textContent.includes('48.000'));});
check('Navegar a inicio',()=>{d.querySelector('[data-tab="inicio"]').click();assert(d.querySelector('#app').textContent.includes('Balance de ingresos y gastos del mes'));});

check('Cerrar formulario con X',()=>{w.openEntryForm('bill');assert(d.querySelector('#overlay.on'));d.querySelector('#sheet .row button').click();assert(!d.querySelector('#overlay.on'));});
check('Cerrar formulario con Atrás',()=>{w.openEntryForm('bill');assert(d.querySelector('#overlay.on'));w.backInApp();assert(!d.querySelector('#overlay.on'));});
check('Cerrar formulario con Escape',()=>{w.openEntryForm('bill');d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert(!d.querySelector('#overlay.on'));});
check('Ajustes sencillos sin presupuesto',()=>{d.querySelector('[data-tab="ajustes"]').click();assert(d.querySelector('#app').textContent.includes('Copias de seguridad'));assert(!d.querySelector('#app').textContent.includes('Guardar presupuesto'));});
check('Volver a Inicio desde Ajustes',()=>{assert(w.backInApp());assert(d.querySelector('#app').textContent.includes('Balance de ingresos y gastos del mes'));});
check('Opciones de recibos y formulario',()=>{w.openEntryForm('expense');assert(d.querySelector('#receiptPick').accept.includes('pdf'));assert(d.querySelector('#cat').options.length>5);w.dismissSheet();});
check('Filtro de categorías para ingresos',()=>{w.openEntryForm('income');assert.equal(d.querySelector('#cat').value,'Sueldo');assert(!d.querySelector('#billfields').offsetParent||d.querySelector('#billfields').style.display==='none');w.dismissSheet();});
check('Exportar desde Ajustes',()=>{d.querySelector('[data-tab="ajustes"]').click();assert(d.querySelector('#app').textContent.includes('Exportar para Excel'));assert(d.querySelector('#app').textContent.includes('Copias de seguridad'));});
check('Se conserva el icono en el proyecto',()=>{assert(fs.existsSync('assets/icon.svg'));assert(fs.existsSync('scripts/generate_icons.py'));});
check('Recordatorios 5 y 3 días antes',()=>{
  const due=new Date();due.setDate(due.getDate()+12);
  const date=[due.getFullYear(),String(due.getMonth()+1).padStart(2,'0'),String(due.getDate()).padStart(2,'0')].join('-');
  w.openEntryForm('bill');
  d.querySelector('#amt').value='35000';
  d.querySelector('#due').value=date;
  w.save();
  w.eval('remindersEnabled=true');
  const reminders=w.reminderPlan().filter(x=>x.body.includes('35.000'));
  assert.equal(reminders.length,2);
  assert.deepEqual(reminders.map(x=>x.extra.days).sort(),[3,5]);
  w.eval('remindersEnabled=false');
});
check('Panel de notificaciones en ajustes',()=>{
  d.querySelector('[data-tab="ajustes"]').click();
  assert(d.querySelector('#app').textContent.includes('5 días'));
  assert(d.querySelector('#app').textContent.includes('3 días'));
  assert(d.querySelector('#app').textContent.includes('Activar recordatorios'));
});
if(errs.length){console.error(errs.join('\n'));process.exitCode=1}
