
/* Suscripciones y gastos fijos: importes definidos por el usuario, sin precios supuestos. */
'use strict';
const subCatalog={
 'Netflix':['Estándar con anuncios','Estándar','Premium','Otro plan'],
 'Spotify':['Individual','Duo','Familiar','Estudiantes','Otro plan'],
 'Max (HBO Max)':['Básico con anuncios','Estándar','Premium','Otro plan'],
 'Disney+':['Estándar','Premium','Otro plan'],
 'ChatGPT':['Go','Plus','Pro','Business','Otro plan'],
 'Amazon Prime':['Prime','Prime Video','Otro plan'],
 'Google One':['100 GB','200 GB','2 TB','5 TB','Otro plan'],
 'YouTube Premium':['Individual','Familiar','Estudiantes','Otro plan'],
 'Apple Music':['Individual','Familiar','Estudiantes','Otro plan'],
 'iCloud+':['50 GB','200 GB','2 TB','6 TB','12 TB','Otro plan'],
 'Microsoft 365':['Personal','Familia','Otro plan'],
 'Crunchyroll':['Fan','Mega Fan','Otro plan'],
 'Paramount+':['Estándar','Premium','Otro plan'],
 'Otro servicio':['Personalizado']
};
function subNormalize(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();}
function subDate(day,from=today()){
  const [y,m]=from.split('-').map(Number),last=new Date(y,m,0).getDate();
  return iso(new Date(y,m-1,Math.min(+day,last)));
}
function subNextDate(day,current){
  const [year,mo]=current.split('-').map(Number);
  const last=new Date(year,mo+1,0).getDate();
  return iso(new Date(year,mo,Math.min(+day,last)));
}
function subSeries(){
  const map=new Map();
  db.items.filter(x=>x.type==='bill'&&x.subscriptionId).forEach(x=>{
    const k=x.subscriptionId,arr=map.get(k)||[];arr.push(x);map.set(k,arr);
  });
  return Array.from(map.entries()).map(([key,arr])=>{
    arr.sort((a,b)=>a.due.localeCompare(b.due));
    const pending=arr.filter(x=>owed(x)>0);
    return {key,entries:arr,latest:arr[arr.length-1],next:pending[0]||null,active:arr.some(x=>x.recurring)};
  }).sort((a,b)=>(a.next?.due||'9999').localeCompare(b.next?.due||'9999'));
}
function subEscape(s){return esc(s);}
function subManage(){
  const services=subSeries();
  modal('<div class="row"><h2>Suscripciones y gastos fijos</h2><button class="closeX" aria-label="Cerrar" onclick="financeCloseWithoutPrompt()">×</button></div>'+
   '<p class="muted">Registra una vez tu plan, el importe real y el día de cobro. Los meses siguientes quedan pendientes hasta registrar el pago.</p>'+
   '<button class="btn primary full" onclick="subForm()">＋ Agregar suscripción</button>'+
   (services.length?services.map(s=>{
      const x=s.latest,ex=s.next;
      return '<div class="subRow"><div class="row"><strong>'+subEscape(x.subscriptionService||'Suscripción')+'</strong>'+
       '<span class="tag '+(!s.active?'late':'')+'">'+(s.active?'Activa':'Pausada')+'</span></div>'+
       '<small>'+subEscape(x.subscriptionPlan||'Plan')+' · '+money(x.amount)+' al mes</small>'+
       '<small>'+(ex?'Próximo vencimiento pendiente: '+financeDateText(ex.due):'Sin pagos pendientes')+'</small>'+
       '<div class="actions"><button class="btn" onclick="subForm(\''+subEscape(s.key)+'\')">Editar plan</button>'+
       '<button class="btn" onclick="subToggle(\''+subEscape(s.key)+'\')">'+(s.active?'Pausar':'Reactivar')+'</button>'+
       (ex?'<button class="btn primary" onclick="financeDetail(\''+subEscape(ex.id)+'\')">Ver cuenta</button>':'')+'</div></div>';
    }).join(''):'<p class="empty">Todavía no tienes suscripciones configuradas.</p>'));
}
function subForm(key=null){
  const row=key?subSeries().find(x=>x.key===key):null,x=row?.latest;
  const services=Object.keys(subCatalog);
  modal('<form id="subForm" onsubmit="event.preventDefault();subSave()">'+
   '<div class="row"><h2>'+(key?'Editar suscripción':'Nueva suscripción')+'</h2><button type="button" class="closeX" onclick="subManage()">×</button></div>'+
   '<label for="subService">Servicio</label><select id="subService" onchange="subUpdatePlans()">'+
     services.map(s=>'<option value="'+subEscape(s)+'"'+(x?.subscriptionService===s?' selected':'')+'>'+subEscape(s)+'</option>').join('')+'</select>'+
   '<label for="subCustomService">Nombre (si elegiste Otro servicio)</label><input id="subCustomService" maxlength="80" placeholder="Nombre del servicio" value="'+subEscape(x?.subscriptionCustomService||'')+'">'+
   '<label for="subPlan">Plan contratado</label><select id="subPlan" onchange="subUpdateCustomPlan()"></select>'+
   '<input id="subCustomPlan" maxlength="80" placeholder="Escribe tu plan" value="'+subEscape(x?.subscriptionCustomPlan||'')+'">'+
   '<label for="subAmount">¿Cuánto pagas cada mes? (CLP)</label><input id="subAmount" type="number" min="1" step="1" inputmode="numeric" required placeholder="Monto real en pesos" value="'+(x?.amount||'')+'">'+
   '<label for="subDay">Día habitual de vencimiento / cobro</label><input id="subDay" type="number" min="1" max="31" required value="'+(x?.subscriptionDay||'')+'" placeholder="Ejemplo: 15">'+
   '<small class="muted">Si un mes tiene menos días, se utiliza su último día. No se cobran pagos automáticamente.</small>'+
   (!key?'<label for="subFirstMonth">Primer mes a registrar</label><input id="subFirstMonth" type="month" value="'+today().slice(0,7)+'">':'')+
   '<div class="error" id="subError" role="alert"></div><button type="submit" class="btn primary full">'+(key?'Guardar cambios':'Agregar gasto fijo')+'</button></form>');
  $('subForm').dataset.edit=key||'';
  subUpdatePlans(x?.subscriptionPlan);
}
function subUpdatePlans(existing){
  const service=$('subService').value;
  const plans=subCatalog[service]||['Personalizado'];
  $('subPlan').innerHTML=plans.map(p=>'<option value="'+subEscape(p)+'">'+subEscape(p)+'</option>').join('');
  $('subPlan').value=existing&&plans.includes(existing)?existing:plans[0];
  $('subCustomService').style.display=service==='Otro servicio'?'block':'none';
  subUpdateCustomPlan();
}
function subUpdateCustomPlan(){
  const plan=$('subPlan').value;
  $('subCustomPlan').style.display=plan==='Otro plan'||plan==='Personalizado'?'block':'none';
}
function subSave(){
  const service=$('subService').value;
  const customService=$('subCustomService').value.trim();
  const selectedPlan=$('subPlan').value;
  const customPlan=$('subCustomPlan').value.trim();
  const name=service==='Otro servicio'?customService:service;
  const plan=selectedPlan==='Otro plan'||selectedPlan==='Personalizado'?customPlan:selectedPlan;
  const amount=Number($('subAmount').value),day=Number($('subDay').value);
  const key=$('subForm').dataset.edit;
  if(!name||!plan||!Number.isSafeInteger(amount)||amount<=0||!Number.isInteger(day)||day<1||day>31){
    $('subError').textContent='Completa servicio, plan, importe y un día válido entre 1 y 31.';return;
  }
  if(key){
    const series=db.items.filter(x=>x.subscriptionId===key&&x.type==='bill');
    if(!series.length){$('subError').textContent='No se encontró la suscripción.';return;}
    for(const x of series){
      x.subscriptionService=name;x.subscriptionPlan=plan;x.subscriptionDay=day;
      x.subscriptionCustomService=customService;x.subscriptionCustomPlan=customPlan;
      if(owed(x)>0){
        if(paid(x)>amount){$('subError').textContent='Hay un mes con pagos superiores al nuevo monto. Corrige sus abonos primero.';return;}
      }
    }
    for(const x of series){
      if(owed(x)>0){
        x.amount=amount;x.note=name+' · '+plan;
        const [y,m]=x.due.split('-').map(Number);
        x.due=subDate(day,String(y)+'-'+String(m).padStart(2,'0')+'-01');
      }
    }
  }else{
    const first=$('subFirstMonth').value;if(!/^\d{4}-\d{2}$/.test(first)){$('subError').textContent='Selecciona un mes inicial válido.';return;}
    const duplicate=subSeries().some(s=>s.active&&subNormalize(s.latest.subscriptionService)===subNormalize(name)&&subNormalize(s.latest.subscriptionPlan)===subNormalize(plan));
    if(duplicate){$('subError').textContent='Ya tienes ese servicio y plan activo. Edítalo en vez de duplicarlo.';return;}
    const keyId=id(),due=subDate(day,first+'-01');
    db.items.push({id:id(),type:'bill',category:'Otros',amount,date:today(),due,note:name+' · '+plan,payments:[],
      recurring:true,seriesId:keyId,subscriptionId:keyId,subscriptionService:name,subscriptionPlan:plan,subscriptionDay:day,
      subscriptionCustomService:customService,subscriptionCustomPlan:customPlan});
  }
  try{persist();financeExpandRecurring();}catch(e){$('subError').textContent='No se pudo guardar en el teléfono.';return;}
  queueReminderSync();render();subManage();financeNotify('Suscripción guardada. Sus vencimientos quedan pendientes.');
}
function subToggle(key){
  const entries=db.items.filter(x=>x.type==='bill'&&x.subscriptionId===key);
  if(!entries.length)return;
  const enabled=entries.some(x=>x.recurring);
  if(enabled&&!confirm('¿Pausar esta suscripción? No se crearán más meses. Los pagos e historial existentes se conservan.'))return;
  for(const x of entries)x.recurring=!enabled;
  persist();queueReminderSync();subManage();financeNotify(enabled?'Suscripción pausada.':'Suscripción reactivada.');
}
const subBaseAccounts=accounts;
accounts=function(){
  return '<section class="card subscriptionCard"><div class="row"><h2>Suscripciones y gastos fijos</h2><button class="btn primary" onclick="subManage()">Administrar</button></div>'+
    '<p class="muted">Netflix, Spotify, Max, Disney+, ChatGPT, Amazon Prime, Google One y otras.</p>'+
    '<button class="btn full" onclick="subForm()">＋ Nueva suscripción</button></section>'+subBaseAccounts();
};
const subBaseSettings=settings;
settings=function(){
  return '<section class="card"><h2>🔁 Suscripciones mensuales</h2>'+
    '<p class="muted">Gestiona servicios, planes, montos y vencimientos. No se hacen cargos automáticos.</p>'+
    '<button class="btn primary full" onclick="subManage()">Administrar suscripciones</button></section>'+subBaseSettings();
};
Object.assign(window,{subCatalog,subForm,subManage,subSave,subToggle,subUpdatePlans,subUpdateCustomPlan,subSeries,subDate,subNextDate});
render();
