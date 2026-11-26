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
