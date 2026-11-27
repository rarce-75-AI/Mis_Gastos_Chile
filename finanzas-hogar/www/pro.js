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

/* Theme preference is independent of financial data and PRO. */
function financeThemeApply(){let light=false;try{light=localStorage.getItem('financeTheme')==='light';}catch(e){}document.documentElement.classList.toggle('finance-light',light);const b=document.querySelector('[data-theme-toggle]');if(b){b.textContent=light?'☾':'☀';b.setAttribute('aria-label',light?'Activar tema oscuro':'Activar tema claro');}}
function financeToggleTheme(){try{localStorage.setItem('financeTheme',document.documentElement.classList.contains('finance-light')?'dark':'light');}catch(e){}financeThemeApply();}
const themeStyle=document.createElement('style');themeStyle.textContent=`
html.finance-light{color-scheme:light;--bg:#f1f5f4;--card:#fff;--line:#d6e2df;--mint:#08765a;--muted:#526477;--red:#b42336}
.finance-light body{background:var(--bg);color:#17283a}
.finance-light header{background:#e3f2ed;border-color:#c5ded5}
.finance-light .card,.finance-light .statcard,.finance-light .sheet{background:#fff;border-color:#d6e2df;color:#17283a}
.finance-light .balance{background:linear-gradient(135deg,#d6f4e7,#e3edf7)}
.finance-light nav{background:#fff;border-color:#d6e2df;box-shadow:0 -4px 16px #14223915}
.finance-light nav button.on{color:#08765a}
.finance-light input,.finance-light select,.finance-light textarea{background:#f7faf9;color:#17283a;border-color:#b8cbc6}
.finance-light .btn,.finance-light button,.finance-light .financeTypes button{background:#e0ebe8;color:#17283a;border-color:#c7d8d3}
.finance-light .btn.primary,.finance-light .filters button.on,.finance-light .financeTypes button.selected{background:#08765a;color:white}
.finance-light nav button{background:transparent;color:#526477}
.finance-light .financeCheck{color:#17283a}
.finance-light .tag{background:#e0ebe8;color:#17283a}
.finance-light .tag.late,.finance-light .urgent{background:#fce4e6;color:#9b2432}
.finance-light .primaryHero{background:#e0ebe8}
.finance-light .primaryHero .plus{background:#c6e5db}
.finance-light .progress{background:#d6e2df}
.finance-light .plot span{background:#fff}
header [data-theme-toggle]{position:absolute;left:10px;top:8px;min-width:44px;padding:6px;font-size:22px}
header{position:relative}
`;document.head.appendChild(themeStyle);
const themeRender=render;render=function(){themeRender();const h=document.querySelector('header');if(h&&!h.querySelector('[data-theme-toggle]')){const b=document.createElement('button');b.dataset.themeToggle='1';b.onclick=financeToggleTheme;h.appendChild(b);}financeThemeApply();};render();

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

/* Privacy on home: mask monetary amounts, including charts and recent movements. */
let financeAmountsVisible=false;
const financePrivacyMoney=money;
let financePrivacyRendering=false;
money=function(value){return financePrivacyRendering&&!financeAmountsVisible?'••••••':financePrivacyMoney(value);};
const financePrivacySummary=summary;
summary=function(){financePrivacyRendering=true;try{return financePrivacySummary();}finally{financePrivacyRendering=false;}};
function financeToggleAmounts(){financeAmountsVisible=!financeAmountsVisible;render();}
const financePrivacyRender=render;
render=function(){financePrivacyRender();const card=document.querySelector('.balance');if(!card)return;card.style.position='relative';const b=document.createElement('button');b.type='button';b.style.cssText='position:absolute;right:8px;top:8px;min-width:44px;padding:8px;background:transparent;color:inherit';b.setAttribute('aria-label',financeAmountsVisible?'Ocultar montos':'Mostrar montos');b.setAttribute('aria-pressed',String(financeAmountsVisible));b.innerHTML='<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'+(!financeAmountsVisible?'<path d="M3 3l18 18"/>':'')+'</svg>';b.onclick=financeToggleAmounts;card.appendChild(b);};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&financeAmountsVisible){financeAmountsVisible=false;render();}});
render();
