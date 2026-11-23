
/* Cartolas bancarias: revisión local, sin subir datos a ningún servidor. */
'use strict';
let bankPreview=[],bankFilename='',bankPage=0,bankFileBalance=null;
const bankPageSize=40;
const bankLabels={expense:'Gasto',income:'Ingreso',transfer:'Traspaso (no contabilizar)',skip:'Excluir'};
function bankNormalize(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();}
function bankMoney(v){
  if(v==null||String(v).trim()==='')return 0;
  if(typeof v==='number')return Math.round(v);
  let s=String(v).replace(/[^\d,.\-]/g,'');
  if(!s)return 0;
  const comma=s.lastIndexOf(','),dot=s.lastIndexOf('.');
  if(comma>=0&&dot>=0)s=comma>dot?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
  else if(comma>=0)s=/,\d{1,2}$/.test(s)?s.replace(',','.'):s.replace(/,/g,'');
  else if(dot>=0&&/(\.\d{3})+$/.test(s))s=s.replace(/\./g,'');
  const n=Number(s);return Number.isFinite(n)?Math.round(n):NaN;
}
function bankDate(v){
  if(v instanceof Date&&!Number.isNaN(v.valueOf()))return iso(v);
  if(typeof v==='number'&&Number.isFinite(v)){
    const d=new Date(Date.UTC(1899,11,30)+Math.round(v)*86400000);
    return d.toISOString().slice(0,10);
  }
  const s=String(v||'').trim(),m=s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if(m){const d=new Date(+m[3],+m[2]-1,+m[1]);return d.getFullYear()===+m[3]&&d.getMonth()+1===+m[2]&&d.getDate()===+m[1]?iso(d):'';}
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)){const d=new Date(s+'T12:00:00');return !Number.isNaN(d.valueOf())&&iso(d)===s?s:'';}
  return '';
}
function bankCategory(desc){
  const s=bankNormalize(desc);
  if(/COPEC|SHELL|ENEX|PETROBRAS|BENCIN/.test(s))return 'Bencina';
  if(/FARMAC|ORTHOCLINIK|CLINIC|HOSPITAL|MEDIC/.test(s))return 'Salud';
  if(/SUPERMARKET|SUPERMERCADO|LIDER|JUMBO|UNIMARC|SANTA ISABEL|EL CASERO/.test(s))return 'Supermercado';
  if(/ESTACIONAM|CONCESIONES|AUTOPISTA|TAG|PEAJE/.test(s))return 'Transporte';
  if(/GOOGLE PLAY|APPLE.COM|NETFLIX|SPOTIFY/.test(s))return 'Otros';
  if(/ENEL|ELECTRIC/.test(s))return 'Luz';
  if(/AGUAS ANDINAS/.test(s))return 'Agua';
  if(/METROGAS|GASCO|ABASTIBLE/.test(s))return 'Gas';
  if(/VTR|MOVISTAR|ENTEL|CLARO/.test(s))return 'Internet';
  return 'Otros';
}
function bankRecommendation(desc,amount,flow){
  const s=bankNormalize(desc);
  if(/TRANSF\.|TRANSFERENCIA|TRASPASO|TEF/.test(s))return {kind:'transfer',category:'Otros',reason:'Revisar si es traspaso entre cuentas propias o pago a un tercero.'};
  if(/CMR|FALABELLA|PAGO SERVIPAG|PAGO TARJETA|PAGO CREDITO|PAC /.test(s))
    return {kind:'skip',category:'Otros',reason:'Posible pago de tarjeta o cuenta ya registrada; revisar antes de contar como gasto.'};
  return {kind:flow==='credit'?'income':'expense',category:flow==='credit'?'Otros':bankCategory(desc),reason:''};
}
function bankColumns(row){
  const r=row.map(x=>bankNormalize(x));
  const names=[['FECHA'],['DESCRIPCION','DETALLE','GLOSA'],['CARGO','DEBITO','EGRESO'],['ABONO','CREDITO','INGRESO'],['SALDO']];
  const idx=names.map(choices=>r.findIndex(c=>choices.some(n=>c===n||c.includes(n))));
  return idx.every(i=>i>=0)?idx:null;
}
function bankKey(x){
  return [x.date,bankNormalize(x.description),x.flow,x.amount,x.balance==null?'':x.balance,x.occurrence].join('|');
}
function bankExistingSignature(x){
  return [x.date,x.type,Number(x.amount)].join('|');
}
function bankReadRows(matrix,filename='cartola'){
  if(!Array.isArray(matrix)||!matrix.length)throw Error('El archivo está vacío.');
  let start=-1,col=null;
  for(let i=0;i<Math.min(matrix.length,35);i++){
    if(!Array.isArray(matrix[i]))continue;
    const found=bankColumns(matrix[i]);
    if(found){start=i;col=found;break;}
  }
  if(!col)throw Error('No encontré las columnas Fecha, Descripción, Cargo, Abono y Saldo.');
  const data=[],seen=new Map();
  for(let i=start+1;i<matrix.length;i++){
    const row=matrix[i];if(!Array.isArray(row))continue;
    const date=bankDate(row[col[0]]),description=String(row[col[1]]??'').replace(/\s+/g,' ').trim();
    const debit=bankMoney(row[col[2]]),credit=bankMoney(row[col[3]]),balanceText=row[col[4]];
    if(!date&&!description)continue;
    if(!date||!description)continue;
    if(!Number.isFinite(debit)||!Number.isFinite(credit)||debit<0||credit<0||debit>0&&credit>0||debit===0&&credit===0)continue;
    const flow=debit>0?'debit':'credit',amount=debit||credit;
    const balance=balanceText==null||String(balanceText).trim()===''?null:bankMoney(balanceText);
    if(balance!==null&&!Number.isFinite(balance))continue;
    const base=[date,bankNormalize(description),flow,amount,balance??''].join('|');
    const occurrence=seen.get(base)||0;seen.set(base,occurrence+1);
    const suggested=bankRecommendation(description,amount,flow);
    data.push({date,description,amount,flow,balance,occurrence,
      kind:suggested.kind,category:suggested.category,reason:suggested.reason,
      selected:suggested.kind!=='transfer'&&suggested.kind!=='skip',duplicate:false});
  }
  if(!data.length)throw Error('No hay movimientos válidos. Verifica fechas y montos de la cartola.');
  const already=new Set(db.items.map(x=>x.bankImportKey).filter(Boolean));
  const manual=new Map();
  db.items.filter(x=>x.type!=='bill'&&!x.bankImportKey).forEach(x=>{
    const key=bankExistingSignature(x);manual.set(key,(manual.get(key)||0)+1);
  });
  for(const x of data){
    const key=bankKey(x),simple=[x.date,x.kind==='income'?'income':'expense',x.amount].join('|');
    if(already.has(key)||((x.kind==='expense'||x.kind==='income')&&(manual.get(simple)||0)>0)){
      x.duplicate=true;x.selected=false;x.reason='Posible duplicado: ya existe un movimiento con fecha y monto similares.';
      const count=manual.get(simple)||0;if(count)manual.set(simple,count-1);
    }
  }

  // Un cargo de una suscripción todavía pendiente debe conciliarse, no contarse de nuevo.
  // Por prudencia, aquí solo se marca para revisión; nunca se paga automáticamente.
  for(const x of data){
    if(x.flow!=='debit'||x.duplicate)continue;
    const desc=bankNormalize(x.description);
    const aliases={'Netflix':['NETFLIX'],'Spotify':['SPOTIFY'],'Max (HBO Max)':['HBO MAX','HBOMAX','MAX.COM'],
      'Disney+':['DISNEY PLUS','DISNEY+'],'ChatGPT':['CHATGPT','OPENAI'],
      'Amazon Prime':['AMAZON PRIME','PRIME VIDEO'],'Google One':['GOOGLE ONE','GOOGLEONE'],
      'YouTube Premium':['YOUTUBE PREMIUM'],'Apple Music':['APPLE MUSIC'],'iCloud+':['ICLOUD'],
      'Microsoft 365':['MICROSOFT 365'],'Crunchyroll':['CRUNCHYROLL'],'Paramount+':['PARAMOUNT']};
    const match=db.items.find(z=>{
      if(z.type!=='bill'||!z.subscriptionId||owed(z)<=0||owed(z)!==x.amount)return false;
      const terms=aliases[z.subscriptionService]||[bankNormalize(z.subscriptionService)];
      if(!terms.some(t=>t&&desc.includes(bankNormalize(t))))return false;
      const diff=Math.abs(new Date(x.date+'T12:00:00')-new Date(z.due+'T12:00:00'))/86400000;
      return diff<=7;
    });
    if(match){
      x.duplicate=true;x.selected=false;x.kind='skip';
      x.reason='Posible cobro de '+match.subscriptionService+' ya registrado como cuenta pendiente. Registra su pago desde Cuentas para evitar duplicarlo.';
    }
  }
  bankPreview=data;bankFilename=filename;bankPage=0;
  const ordered=[...data].filter(x=>x.balance!==null).sort((a,b)=>b.date.localeCompare(a.date));
  bankFileBalance=ordered[0]?{date:ordered[0].date,amount:ordered[0].balance,filename}:null;
  return data;
}
function bankCsvRows(text){
  text=String(text||'').replace(/^\uFEFF/,'');
  const first=text.split(/\r?\n/).find(x=>x.trim())||'';
  const counts=[';',',','\t'].map(d=>[d,(first.split(d).length-1)]).sort((a,b)=>b[1]-a[1]);
  const delimiter=counts[0][0];
  const rows=[],row=[];let field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
    else if(!quoted&&c===delimiter){row.push(field);field='';}
    else if(!quoted&&(c==='\n'||c==='\r')){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(v=>v.trim()))rows.push([...row]);row.length=0;field='';}
    else field+=c;
  }
  row.push(field);if(row.some(v=>v.trim()))rows.push(row);
  return rows;
}
function bankReview(){
  const start=bankPage*bankPageSize,items=bankPreview.slice(start,start+bankPageSize);
  const included=bankPreview.filter(x=>x.selected&&(x.kind==='expense'||x.kind==='income')).length;
  const pending=bankPreview.filter(x=>x.kind==='transfer'||x.kind==='skip').length;
  const rows=items.map((x,i)=>{
    const idx=start+i;
    const options=['expense','income','transfer','skip'].map(v=>'<option value="'+v+'"'+(x.kind===v?' selected':'')+'>'+bankLabels[v]+'</option>').join('');
    const categories=(x.kind==='income'?['Sueldo','Honorarios','Ventas','Otros']:cats).map(v=>'<option value="'+esc(v)+'"'+(x.category===v?' selected':'')+'>'+esc(v)+'</option>').join('');
    return '<div class="bankItem '+(x.duplicate?'bankDup':'')+'"><label class="bankChoice"><input aria-label="Importar movimiento" type="checkbox" '+(x.selected?'checked':'')+
      ' onchange="bankSelect('+idx+',this.checked)"> <strong>'+financeDateText(x.date)+'</strong> · <strong>'+
      (x.flow==='credit'?'+':'−')+money(x.amount)+'</strong></label>'+
      '<div>'+esc(x.description)+'</div>'+
      (x.reason?'<small class="muted">'+esc(x.reason)+'</small>':'')+
      '<div class="bankControls"><select aria-label="Tratamiento" onchange="bankSetKind('+idx+',this.value)">'+options+'</select>'+
      '<select aria-label="Categoría" onchange="bankSetCategory('+idx+',this.value)">'+categories+'</select></div></div>';
  }).join('');
  modal('<div class="row"><h2>Revisar cartola</h2><button class="closeX" onclick="financeCloseWithoutPrompt()">×</button></div>'+
    '<p class="muted">'+esc(bankFilename)+' · '+bankPreview.length+' operaciones · '+included+' seleccionadas</p>'+
    '<p class="muted">Las transferencias y pagos de tarjeta se excluyen por precaución hasta que decidas cómo contabilizarlos.</p>'+
    (pending?'<p class="muted">'+pending+' operaciones necesitan clasificación manual.</p>':'')+
    '<div class="bankToolbar"><button onclick="bankSelectPage(true)">Seleccionar página</button><button onclick="bankSelectPage(false)">Deseleccionar página</button></div>'+
    rows+
    '<div class="bankToolbar"><button '+(bankPage===0?'disabled':'')+' onclick="bankPage--;bankReview()">Anterior</button>'+
    '<span>Página '+(bankPage+1)+' / '+Math.ceil(bankPreview.length/bankPageSize)+'</span>'+
    '<button '+((start+bankPageSize)>=bankPreview.length?'disabled':'')+' onclick="bankPage++;bankReview()">Siguiente</button></div>'+
    '<button class="btn primary full" onclick="bankImportConfirmed()">Importar '+included+' movimientos revisados</button>'+
    '<small class="muted">Nada se incorpora hasta pulsar Importar. Puedes excluir cualquier movimiento.</small>');
}
function bankSelect(idx,value){if(bankPreview[idx])bankPreview[idx].selected=value;bankReview();}
function bankSetKind(idx,value){
  const x=bankPreview[idx];if(!x)return;
  x.kind=value;
  if(value==='transfer'||value==='skip')x.selected=false;
  else {x.selected=!x.duplicate;x.category=value==='income'?'Otros':bankCategory(x.description);}
  bankReview();
}
function bankSetCategory(idx,value){if(bankPreview[idx]){bankPreview[idx].category=value;bankReview();}}
function bankSelectPage(value){
  bankPreview.slice(bankPage*bankPageSize,(bankPage+1)*bankPageSize).forEach(x=>{
    if(!x.duplicate&&(x.kind==='expense'||x.kind==='income'))x.selected=value;
  });bankReview();
}
function bankImportConfirmed(){
  const included=bankPreview.filter(x=>x.selected&&(x.kind==='expense'||x.kind==='income'));
  if(!included.length){financeNotify('No seleccionaste movimientos para importar.',true);return;}
  if(!confirm('¿Incorporar '+included.length+' movimientos de '+bankFilename+'? Los movimientos existentes se conservarán.'))return;
  const existing=new Set(db.items.map(x=>x.bankImportKey).filter(Boolean));
  const additions=[];
  for(const x of included){
    const key=bankKey(x);if(existing.has(key))continue;
    additions.push({id:id(),type:x.kind,amount:x.amount,date:x.date,due:'',category:x.category,
      note:x.description,payments:[],bankImportKey:key,bankSource:'Cuenta principal'});
    existing.add(key);
  }
  const previousBalance=db.bankBalance;
  const previousCount=db.items.length;
  try{
    db.items.push(...additions);
    if(bankFileBalance&&(!previousBalance||bankFileBalance.date>=previousBalance.date)){
      db.bankBalance={...bankFileBalance,source:'Cuenta principal'};
    }
    persist();
  }catch(e){
    db.items.splice(previousCount);db.bankBalance=previousBalance;
    financeNotify('No se guardaron los movimientos: revisa el espacio disponible.',true);return;
  }
  bankPreview=[];financeCloseWithoutPrompt();render();queueReminderSync();
  financeNotify('Importados '+additions.length+' movimientos. Se conservaron los datos anteriores.');
}
async function bankHandleFile(event){
  const file=event.target.files?.[0];if(!file)return;
  try{
    if(file.size>12*1024*1024)throw Error('El archivo supera 12 MB.');
    const ext=(file.name.split('.').pop()||'').toLowerCase();
    let rows;
    if(ext==='xlsx'){
      if(typeof window.CartolaExcel?.read!=='function')throw Error('El lector de Excel no está disponible.');
      rows=await window.CartolaExcel.read(file);
    }else if(ext==='csv'||ext==='txt')rows=bankCsvRows(await file.text());
    else throw Error('Selecciona Excel .xlsx o CSV.');
    bankReadRows(rows,file.name);bankReview();
  }catch(e){financeNotify('No se pudo leer la cartola: '+e.message,true);}
  finally{event.target.value='';}
}
function bankSettings(){
  return '<section class="card"><h2>🏦 Cuenta bancaria principal</h2>'+
   (db.bankBalance?'<p>Último saldo informado por el banco: <strong>'+money(db.bankBalance.amount)+'</strong></p>'+
     '<small class="muted">Cartola '+financeDateText(db.bankBalance.date)+' · '+esc(db.bankBalance.filename||'')+'</small>':
     '<p class="muted">Importa la cartola de tu cuenta principal para registrar movimientos sin volver a digitarlos.</p>')+
   '<p class="muted">Compatible con Excel (.xlsx) y CSV con columnas Fecha, Descripción, Cargo, Abono y Saldo. La lectura se realiza en tu teléfono.</p>'+
   '<button class="btn primary full" onclick="$(\'bankFile\').click()">Importar cartola bancaria</button>'+
   '<input id="bankFile" type="file" accept=".xlsx,.csv,.txt" style="display:none" onchange="bankHandleFile(event)">'+
   '<small class="muted">Puedes revisar, clasificar y excluir movimientos antes de guardarlos. No se borrará ningún registro existente.</small></section>';
}
const bankOriginalSettings=settings;
settings=function(){return bankSettings()+bankOriginalSettings();};
const bankBaseSummary=summary;
summary=function(){
  const top=db.bankBalance?'<section class="card bankBalance"><div class="row"><div><small>Saldo informado por el banco</small><h2>'+money(db.bankBalance.amount)+'</h2>'+
    '<small>Al '+financeDateText(db.bankBalance.date)+'</small></div><button onclick="financeGo(\'ajustes\')">Importar</button></div>'+
    '<small>Saldo bancario de referencia; no se suma al balance mensual.</small></section>':'';
  return bankBaseSummary()+top;
};
const bankBaseBackup=backup;
backup=async function(){return bankBaseBackup();};
render();

Object.assign(window,{bankCsvRows,bankReadRows,bankDate,bankMoney,bankImportConfirmed,bankHandleFile,bankReview});
