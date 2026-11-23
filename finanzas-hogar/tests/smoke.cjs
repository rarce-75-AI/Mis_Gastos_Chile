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

check('Acciones principales separadas',()=>{
  d.querySelector('[data-tab="inicio"]').click();
  const buttons=d.querySelectorAll('.financeQuick button');
  assert.equal(buttons.length,3);
  assert(buttons[0].textContent.includes('Gasto'));
  assert(buttons[1].textContent.includes('Ingreso'));
  assert(buttons[2].textContent.includes('Cuenta'));
});
check('Ingreso no ofrece cuentas de servicios',()=>{
  w.openEntryForm('income');
  const categories=Array.from(d.querySelector('#cat').options).map(x=>x.value);
  assert(categories.includes('Sueldo'));assert(!categories.includes('Luz'));
  w.dismissSheet();
});
check('Cuenta pendiente se indica sin gasto negativo',()=>{
  d.querySelector('[data-tab="cuentas"]').click();
  const txt=d.querySelector('#app').textContent;
  assert(txt.includes('Por pagar'));assert(txt.includes('48.000'));
});
check('No perder comprobante al editar',()=>{
  const x=w.eval('db.items.find(x=>x.type==="bill")');
  x.receipt={name:'original.pdf',mime:'application/pdf',size:200};
  w.financeForm('bill',x.id);
  d.querySelector('#note').value='Edición sin cambiar comprobante';
  w.save();
  assert.equal(w.eval('db.items.find(x=>x.id==='+JSON.stringify(x.id)+').receipt.name'),'original.pdf');
});
check('Abono individual puede editarse y elimina saldo',()=>{
  w.confirm=()=>true;
  w.openEntryForm('bill');
  d.querySelector('#amt').value='30000';
  d.querySelector('#cat').value='Agua';
  d.querySelector('#note').value='Prueba abono';
  d.querySelector('#due').value='2027-04-30';
  w.save();
  const id=w.eval('db.items.find(x=>x.note==="Prueba abono").id');
  w.financePaymentForm(id);
  d.querySelector('#payAmt').value='10000';
  w.financeSavePayment(id,'');
  let account=w.eval('db.items.find(x=>x.id==='+JSON.stringify(id)+')');
  assert.equal(account.payments.length,1);assert.equal((account.amount-account.payments.reduce((a,p)=>a+p.amount,0)),20000);
  const payId=account.payments[0].id;
  w.financePaymentForm(id,payId);
  d.querySelector('#payAmt').value='12000';
  w.financeSavePayment(id,payId);
  account=w.eval('db.items.find(x=>x.id==='+JSON.stringify(id)+')');
  assert.equal((account.amount-account.payments.reduce((a,p)=>a+p.amount,0)),18000);
  w.financeDeletePayment(id,payId);
  account=w.eval('db.items.find(x=>x.id==='+JSON.stringify(id)+')');
  assert.equal((account.amount-account.payments.reduce((a,p)=>a+p.amount,0)),30000);
});
check('Cuenta recurrente crea siguiente pendiente y evita duplicados',()=>{
  w.openEntryForm('bill');
  d.querySelector('#amt').value='25000';
  d.querySelector('#cat').value='Internet';
  d.querySelector('#note').value='Prueba recurrencia';
  d.querySelector('#due').value='2027-01-31';
  d.querySelector('#recurring').checked=true;
  d.querySelector('#fully').checked=true;
  w.save();
  const entries=w.eval('db.items.filter(x=>x.note==="Prueba recurrencia")');
  assert.equal(entries.length,2);
  assert(entries.some(x=>x.due==='2027-02-28'&&(x.amount-x.payments.reduce((a,p)=>a+p.amount,0))===25000));
  assert(entries.some(x=>x.due==='2027-01-31'&&(x.amount-x.payments.reduce((a,p)=>a+p.amount,0))===0));
});
check('Formulario advierte cambios sin guardar',()=>{
  w.openEntryForm('expense');
  d.querySelector('#amt').value='5000';
  w.confirm=()=>false;
  w.dismissSheet();
  assert(d.querySelector('#overlay.on'));
  w.confirm=()=>true;
  w.dismissSheet();
  assert(!d.querySelector('#overlay.on'));
});
check('Buscador y filtro de movimientos',()=>{
  d.querySelector('[data-tab="movimientos"]').click();
  assert(d.querySelector('#financeSearch'));
  assert(d.querySelector('input[type="month"]'));
  assert(d.querySelector('#app').textContent.includes('Movimientos'));
});
check('Respaldo incluye abonos y sus comprobantes',()=>{
  const x=w.eval('db.items.find(x=>x.note==="Prueba abono")');
  x.payments.push({id:'abc123',date:'2027-03-01',amount:1000,method:'Débito',receipt:{name:'pago.jpg',mime:'image/jpeg'}});
  assert(w.financeBackupFileKeys().includes('payment:abc123'));
});


w.eval(fs.readFileSync('www/bank-import.js','utf8'));
check('Cartola bancaria aparece en ajustes',()=>{
  d.querySelector('[data-tab="ajustes"]').click();
  assert(d.querySelector('#bankFile'));
  assert(d.querySelector('#app').textContent.includes('Cuenta bancaria principal'));
});
check('CSV Chile interpretado con separador y montos CLP',()=>{
  const csv='Fecha;Descripcion;Cargo;Abono;Saldo\n24-11-2026;COPEC;60.079;;618.254\n23-11-2026;Transf. de Roberto Arce;;500.000;1.118.254';
  const matrix=w.bankCsvRows(csv);
  assert.equal(matrix.length,3);
  const parsed=w.bankReadRows(matrix,'prueba.csv');
  assert.equal(parsed.length,2);
  assert.equal(parsed[0].amount,60079);
  assert.equal(parsed[0].category,'Bencina');
  assert.equal(parsed[1].amount,500000);
  assert.equal(parsed[1].kind,'transfer');
  assert.equal(parsed[1].selected,false);
});
check('Importa cargos sin contabilizar traspasos y conserva registros',()=>{
  const before=w.eval('db.items.length');
  w.bankImportConfirmed();
  const after=w.eval('db.items.length');
  assert.equal(after-before,1);
  assert.equal(w.eval('db.items.find(x=>x.note==="COPEC").amount'),60079);
  assert.equal(w.eval('db.bankBalance.amount'),618254);
});
check('No importa el mismo movimiento por segunda vez',()=>{
  const rows=w.bankCsvRows('Fecha;Descripcion;Cargo;Abono;Saldo\n24-11-2026;COPEC;60.079;;618.254');
  const arr=w.bankReadRows(rows,'duplicado.csv');
  assert(arr[0].duplicate);
  assert(!arr[0].selected);
});
check('Importador reconoce fechas Excel y montos bancarios',()=>{
  assert.equal(w.bankDate('24-11-2026'),'2026-11-24');
  assert.equal(w.bankMoney('$ 1.014.270'),1014270);
  assert.equal(w.bankMoney('1,234.50'),1235);
});

w.eval(fs.readFileSync('www/subscriptions.js','utf8'));
check('Catálogo incluye suscripciones solicitadas y Google One',()=>{
  const names=w.eval('Object.keys(subCatalog)');
  ['Netflix','Spotify','Max (HBO Max)','Disney+','ChatGPT','Amazon Prime','Google One'].forEach(name=>assert(names.includes(name),name));
  assert(w.eval('subCatalog["Google One"].includes("2 TB")'));
});
check('Suscripción registra plan, importe y día de cobro',()=>{
  w.subForm();
  d.querySelector('#subService').value='Google One';w.subUpdatePlans();
  d.querySelector('#subPlan').value='2 TB';
  d.querySelector('#subAmount').value='12000';
  d.querySelector('#subDay').value='31';
  d.querySelector('#subFirstMonth').value='2026-11';
  w.subSave();
  const entries=w.eval('db.items.filter(x=>x.subscriptionService==="Google One")');
  assert(entries.length>0);
  assert(entries.every(x=>x.subscriptionPlan==='2 TB'&&x.subscriptionDay===31));
  assert(entries.some(x=>x.due==='2026-11-30'));
});
check('El día 31 se mantiene después de febrero',()=>{
  assert.equal(w.financeRecurringDue({due:'2027-02-28',subscriptionDay:31}),'2027-03-31');
  assert.equal(w.financeRecurringDue({due:'2027-01-31',subscriptionDay:31}),'2027-02-28');
});
check('Suscripción se pausa conservando cobros anteriores',()=>{
  const key=w.eval('db.items.find(x=>x.subscriptionService==="Google One").subscriptionId');
  const before=w.eval('db.items.filter(x=>x.subscriptionId==='+JSON.stringify(key)+').length');
  w.confirm=()=>true;w.subToggle(key);
  assert(w.eval('db.items.filter(x=>x.subscriptionId==='+JSON.stringify(key)+').every(x=>!x.recurring)'));
  assert.equal(w.eval('db.items.filter(x=>x.subscriptionId==='+JSON.stringify(key)+').length'),before);
  w.subToggle(key);
  assert(w.eval('db.items.some(x=>x.subscriptionId==='+JSON.stringify(key)+'&&x.recurring)'));
});
check('Cartola coincide con suscripción y se excluye para evitar doble gasto',()=>{
  w.subForm();
  d.querySelector('#subService').value='Netflix';w.subUpdatePlans();
  d.querySelector('#subAmount').value='11990';
  d.querySelector('#subDay').value='24';
  d.querySelector('#subFirstMonth').value='2026-11';
  w.subSave();
  const rows=w.bankCsvRows('Fecha;Descripcion;Cargo;Abono;Saldo\n24-11-2026;Netflix.com;11.990;;200.000');
  const matched=w.bankReadRows(rows,'netflix.csv');
  assert.equal(matched.length,1);
  assert.equal(matched[0].selected,false);
  assert(matched[0].reason.includes('Netflix'));
});

if(errs.length){console.error(errs.join('\n'));process.exitCode=1}
