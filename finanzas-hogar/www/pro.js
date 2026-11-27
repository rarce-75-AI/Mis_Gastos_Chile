/* Native Play entitlement; never unlock from a local flag. */
let financePro=false,financePrice='';
const financeBilling=()=>window.Capacitor?.registerPlugin?.('FinanceBilling');
async function financeRefreshPro(){try{const b=financeBilling();if(!b||!window.Capacitor.isNativePlatform())return;const r=await b.status();financePro=r.owned===true;financePrice=r.price||'';render();}catch(e){console.warn('Billing unavailable',e);}}
function financeProInfo(){modal('<div class="row"><h2>Mis Finanzas PRO</h2><button class="closeX" onclick="dismissSheet()">×</button></div><p>Pago único · Sin publicidad</p><p>Importación bancaria, exportación CSV y cuentas ilimitadas.</p><p>'+ (financePro?'PRO activo':esc(financePrice||'Precio disponible en Google Play'))+'</p><button class="btn primary full" onclick="financeBuy()">Desbloquear PRO</button><button class="btn full" onclick="financeRestore()">Restaurar compra</button>');}
async function financeBuy(){try{await financeBilling().buy();await financeRefreshPro();}catch(e){financeNotify('Compra no disponible: '+(e.message||'intenta desde Google Play'),true);}}
async function financeRestore(){await financeRefreshPro();financeNotify(financePro?'Compra PRO restaurada':'No se encontró una compra activa. Comprueba tu cuenta de Google Play.',!financePro);}
function financeRequirePro(){if(financePro)return true;financeProInfo();return false;}
function financeAccountCount(){return new Set(db.items.filter(x=>x.type==='bill'&&owed(x)>0).map(x=>x.subscriptionId||x.seriesId||x.id)).size;}
const proRender=render;render=function(){proRender();const h=document.querySelector('header');if(!h)return;let b=h.querySelector('[data-pro]');if(!b){b=document.createElement('button');b.dataset.pro='1';b.className='btn';b.style.cssText='float:right;margin-top:-28px;font-size:12px';b.onclick=financeProInfo;h.appendChild(b);}b.textContent=financePro?'PRO activo':'Gratis · Ver PRO';};
const proCsv=csv;csv=function(){if(financeRequirePro())return proCsv();};
const proBank=bankHandleFile;bankHandleFile=function(e){if(financeRequirePro())return proBank(e);if(e?.target)e.target.value='';};
const proImport=bankImportConfirmed;bankImportConfirmed=function(){if(financeRequirePro())return proImport();};
const proSave=financeSave;financeSave=async function(){const old=db.items.find(x=>x.id===editing);if(!financePro&&$('type')?.value==='bill'&&old?.type!=='bill'&&financeAccountCount()>=5){$('err').textContent='Gratis permite hasta 5 cuentas pendientes. PRO permite cuentas ilimitadas.';return;}return proSave();};save=financeSave;
const proSub=subSave;subSave=function(){if(!financePro&&!$('subForm')?.dataset.edit&&financeAccountCount()>=5){$('subError').textContent='Alcanzaste el límite gratuito de 5 cuentas o suscripciones.';return;}return proSub();};
render();financeRefreshPro();document.addEventListener('visibilitychange',()=>{if(!document.hidden)financeRefreshPro();});

/* Local-only rotating backups. Private app storage; manual export remains available. */
let localBackupBusy=false;
const localBackupFS=()=>window.Capacitor?.isNativePlatform?.()?window.Capacitor.registerPlugin('Filesystem'):null;
async function financeLocalBackup(force=false){
 const fs=localBackupFS();if(!fs||localBackupBusy)return;
 const stamp=today();if(!force&&localStorage.getItem('financeLastBackup')===stamp)return;
 localBackupBusy=true;
 try{
  const snapshot=JSON.parse(JSON.stringify(db)),attachments={};
  for(const key of financeBackupFileKeys()){const blob=await receiptRead(key);if(!blob)throw Error('Comprobante no disponible');attachments[key]=await blobDataUrl(blob);}
  const slot=new Date().getDay();
  await fs.writeFile({path:'local-backups/day-'+slot+'.json',directory:'DATA',encoding:'utf8',recursive:true,data:JSON.stringify({schema:4,data:snapshot,attachments,createdAt:new Date().toISOString()})});
  localStorage.setItem('financeLastBackup',stamp);
  if(force)financeNotify('Respaldo local guardado.');
 }catch(e){console.warn('Local backup failed',e);if(force)financeNotify('No se pudo guardar el respaldo local.',true);}
 finally{localBackupBusy=false;}
}
async function financeRestoreLocal(){
 const fs=localBackupFS();if(!fs){financeNotify('Disponible en Android.',true);return;}
 const copies=[];
 for(let i=0;i<7;i++){try{const f=await fs.readFile({path:'local-backups/day-'+i+'.json',directory:'DATA',encoding:'utf8'});const v=JSON.parse(f.data);if(Array.isArray(v.data?.items))copies.push(v);}catch(e){}}
 copies.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
 if(!copies.length){financeNotify('No hay respaldos locales disponibles.',true);return;}
 const v=copies[0];if(!confirm('Recuperar respaldo del '+new Date(v.createdAt).toLocaleString()+'? Se reemplazarán los registros actuales.'))return;
 try{for(const key of Object.keys(v.attachments||{}))await receiptStore(key,dataUrlBlob(v.attachments[key]));db=v.data;persist();queueReminderSync();render();financeNotify('Respaldo local recuperado.');}catch(e){financeNotify('No se pudo recuperar el respaldo.',true);}
}
const localBackupSettings=settings;settings=function(){return '<section class="card"><h2>Respaldo automático local</h2><p class="muted">Copia diaria al abrir la aplicación, hasta siete copias en el almacenamiento privado del teléfono. No se envían datos a internet. Si desinstalas la aplicación, estas copias pueden perderse: guarda también una copia manual fuera de la app.</p><button class="btn full" onclick="financeLocalBackup(true)">Crear respaldo local ahora</button><button class="btn full" onclick="financeRestoreLocal()">Recuperar último respaldo local</button></section>'+localBackupSettings();};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)financeLocalBackup();});
financeLocalBackup();

