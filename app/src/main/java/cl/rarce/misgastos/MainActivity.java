package cl.rarce.misgastos;

import android.app.*;
import android.os.*;
import android.content.*;
import android.database.Cursor;
import android.database.sqlite.*;
import android.graphics.Color;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.view.*;
import android.widget.*;
import java.text.*;
import java.util.*;
import java.io.*;

public class MainActivity extends Activity {
    private static final int PICK_RECEIPT = 100;
    private static final int CREATE_CSV = 101;
    private DB db;
    private LinearLayout root, items;
    private TextView balanceView, totalView;
    private Spinner typeInput, categoryInput;
    private EditText amountInput, noteInput;
    private CheckBox paidInput;
    private TextView receiptView;
    private String receiptUri = "";
    private final String[] types = {"Gasto", "Ingreso", "Cuenta por pagar"};
    private final String[] expenseCategories = {"Luz", "Agua", "Gas", "Internet", "Plan celular", "Arriendo", "Bencina", "Diésel", "Parafina", "Supermercado", "Alimentación", "Transporte", "Salud", "Educación", "Crédito", "Tarjeta", "Otros"};
    private final String[] incomeCategories = {"Sueldo", "Ventas", "Honorarios", "Regalos", "Otros"};
    private String currency;
    private EditText dueInput;
    private long dueValue = 0;
    private LinearLayout quickContainer;
    private int accent = Color.rgb(20, 110, 112);
    private int slate = Color.rgb(30, 49, 65);
    private int screen = 0, filter=0, monthShift=0;
    private final int navy=Color.rgb(13,25,43),panel=Color.rgb(29,43,65),green=Color.rgb(50,219,144),soft=Color.rgb(174,190,213),red=Color.rgb(255,116,119);
    private long[] monthTotals=new long[3];

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        db = new DB(this);
        currency = getPreferences(MODE_PRIVATE).getString("currency", "CLP");
        draw();
    }
    private int dp(int n) { return (int)(getResources().getDisplayMetrics().density * n + .5f); }
    private LinearLayout vertical() { LinearLayout l = new LinearLayout(this); l.setOrientation(LinearLayout.VERTICAL); return l; }
    private TextView text(String value, int size, boolean bold) { TextView t = new TextView(this); t.setText(value); t.setTextSize(size); t.setTextColor(Color.rgb(31,45,54)); if(bold) t.setTypeface(null,1); return t; }
    private Button button(String value) { Button b = new Button(this); b.setText(value); b.setAllCaps(false); return b; }
    private void addSpace(LinearLayout to, int size) { View v=new View(this);to.addView(v,new LinearLayout.LayoutParams(1,dp(size))); }
    private EditText input(String hint, int inputType) { EditText e=new EditText(this); e.setHint(hint); e.setSingleLine(true); e.setInputType(inputType); return e; }
    private String money(long val) { DecimalFormat f = new DecimalFormat("#,##0", new DecimalFormatSymbols(new Locale("es","CL"))); return currency + " " + f.format(val); }
    private TextView white(String value,int size,boolean bold){TextView t=text(value,size,bold);t.setTextColor(Color.WHITE);return t;}
    private TextView light(String value,int size){TextView t=text(value,size,false);t.setTextColor(soft);return t;}
    private void cardLine(LinearLayout card,String key,String value){
        LinearLayout row=new LinearLayout(this);row.setGravity(Gravity.CENTER_VERTICAL);card.addView(row);
        TextView a=light(key,13);row.addView(a,new LinearLayout.LayoutParams(0,-2,1));row.addView(white(value,15,true));
    }
    private LinearLayout panel(LinearLayout parent){
        LinearLayout p=vertical();p.setBackground(rounded(panel));p.setPadding(dp(15),dp(15),dp(15),dp(15));
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.bottomMargin=dp(12);parent.addView(p,lp);return p;
    }
    private TextView tap(String name,Runnable action){
        TextView t=white(name,14,true);t.setGravity(Gravity.CENTER);t.setPadding(dp(10),dp(15),dp(10),dp(15));
        t.setBackground(rounded(panel));t.setOnClickListener(v->action.run());return t;
    }
    private void draw(){
        LinearLayout page=vertical();page.setBackgroundColor(navy);
        getWindow().setStatusBarColor(navy);getWindow().setNavigationBarColor(navy);
        setContentView(page);
        LinearLayout bar=new LinearLayout(this);bar.setGravity(Gravity.CENTER_VERTICAL);bar.setPadding(dp(18),dp(12),dp(18),dp(12));page.addView(bar);
        TextView title=white("Mis Gastos Chile",21,true);bar.addView(title,new LinearLayout.LayoutParams(0,-2,1));
        TextView config=light("⚙",25);bar.addView(config);config.setOnClickListener(v->chooseCurrency());
        ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.setVerticalScrollBarEnabled(false);page.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        root=vertical();root.setPadding(dp(16),dp(6),dp(16),dp(14));scroll.addView(root);
        if(screen==0)home();
        else if(screen==1)bills();
        else if(screen==2)history();
        else if(screen==3)form();
        else settings();
        LinearLayout nav=new LinearLayout(this);nav.setGravity(Gravity.CENTER);nav.setPadding(dp(5),dp(7),dp(5),dp(7));nav.setBackgroundColor(Color.rgb(19,32,51));page.addView(nav);
        String[] labels={"⌂\nInicio","◷\nCuentas","▥\nMovimientos","＋\nAgregar","⚙\nAjustes"};
        int[] pages={0,1,2,3,4};
        for(int i=0;i<labels.length;i++){
            final int target=pages[i];TextView item=text(labels[i],11,screen==i);item.setGravity(Gravity.CENTER);
            item.setTextColor(screen==i?green:soft);item.setPadding(dp(2),dp(6),dp(2),dp(6));
            nav.addView(item,new LinearLayout.LayoutParams(0,-2,1));item.setOnClickListener(v->{screen=target;draw();});
        }
    }
    private void heading(String title,String subtitle){
        root.addView(white(title,23,true));if(subtitle!=null)root.addView(light(subtitle,13));addSpace(root,14);
    }
    private Calendar selectedMonth(){
        Calendar c=Calendar.getInstance();c.set(Calendar.DAY_OF_MONTH,1);c.add(Calendar.MONTH,monthShift);return c;
    }
    private boolean inMonth(long timestamp){
        Calendar c=Calendar.getInstance();c.setTimeInMillis(timestamp);
        Calendar m=selectedMonth();return c.get(Calendar.YEAR)==m.get(Calendar.YEAR)&&c.get(Calendar.MONTH)==m.get(Calendar.MONTH);
    }
    private String monthName(){
        String s=new SimpleDateFormat("MMMM yyyy",new Locale("es","CL")).format(selectedMonth().getTime());
        return s.substring(0,1).toUpperCase(new Locale("es","CL"))+s.substring(1);
    }
    private void calculate(){
        Arrays.fill(monthTotals,0);
        try(Cursor c=db.getReadableDatabase().rawQuery("SELECT kind,amount,paid,created FROM movements",null)){
            while(c.moveToNext()){
                int kind=c.getInt(0),paid=c.getInt(2);long amount=c.getLong(1);
                if(inMonth(c.getLong(3))){
                    if(kind==1)monthTotals[0]+=amount;else if(kind==0||paid==1)monthTotals[1]+=amount;
                }
            }
        }
        try(Cursor c=db.getReadableDatabase().rawQuery("SELECT amount FROM movements WHERE kind=2 AND paid=0",null)){
            while(c.moveToNext())monthTotals[2]+=c.getLong(0);
        }
    }
    private void home(){
        calculate();
        LinearLayout month=new LinearLayout(this);month.setGravity(Gravity.CENTER);root.addView(month);
        TextView previous=white("‹",29,true);previous.setPadding(dp(12),0,dp(12),0);month.addView(previous);previous.setOnClickListener(v->{monthShift--;draw();});
        TextView label=white(monthName(),16,true);label.setGravity(Gravity.CENTER);month.addView(label,new LinearLayout.LayoutParams(0,-2,1));
        TextView next=white("›",29,true);next.setPadding(dp(12),0,dp(12),0);month.addView(next);next.setOnClickListener(v->{monthShift++;draw();});
        addSpace(root,8);
        LinearLayout available=panel(root);available.setBackground(rounded(Color.rgb(10,65,65)));
        TextView caption=light("BALANCE DEL MES",12);caption.setGravity(Gravity.CENTER);available.addView(caption);
        TextView amount=white(money(monthTotals[0]-monthTotals[1]),30,true);amount.setTextColor(green);amount.setGravity(Gravity.CENTER);available.addView(amount);
        addSpace(available,9);
        cardLine(available,"↑ Ingresos",money(monthTotals[0]));addSpace(available,5);
        cardLine(available,"↓ Gastos pagados",money(monthTotals[1]));addSpace(available,5);
        cardLine(available,"⏳ Cuentas pendientes (total)",money(monthTotals[2]));
        LinearLayout add=panel(root);
        TextView addTitle=white("＋ Agregar gasto, ingreso o cuenta",16,true);add.addView(addTitle);
        add.addView(light("Registra en pocos pasos, con fecha de vencimiento si corresponde.",12));
        add.setOnClickListener(v->{screen=3;draw();});
        LinearLayout graph=panel(root);
        graph.addView(white("Distribución de gastos",17,true));addSpace(graph,7);
        graph.addView(new Donut(this),new LinearLayout.LayoutParams(-1,dp(175)));
        graph.addView(light("Gráfico de gastos pagados del mes seleccionado.",12));
        LinearLayout upcoming=panel(root);upcoming.addView(white("Cuentas por pagar",18,true));addSpace(upcoming,8);
        renderRows(upcoming,1,4);
        TextView see=tap("Ver todas las cuentas  ›",()->{screen=1;draw();});root.addView(see);
        addSpace(root,12);
        LinearLayout recent=panel(root);recent.addView(white("Últimos movimientos",18,true));addSpace(recent,8);renderRows(recent,0,5);
    }
    private void bills(){
        heading("Mis cuentas","Pendientes, vencidas y pagadas");
        long pending=0,late=0;int count=0;
        try(Cursor c=db.getReadableDatabase().rawQuery("SELECT amount,due FROM movements WHERE kind=2 AND paid=0",null)){
            while(c.moveToNext()){pending+=c.getLong(0);count++;if(c.getLong(1)>0&&c.getLong(1)<todayStart())late+=c.getLong(0);}
        }
        LinearLayout summary=panel(root);summary.addView(light("TOTAL POR PAGAR",12));
        TextView total=white(money(pending),27,true);total.setTextColor(green);summary.addView(total);
        cardLine(summary,count+" cuentas pendientes","");if(late>0){TextView l=white("⚠ Vencidas: "+money(late),15,true);l.setTextColor(red);summary.addView(l);}
        TextView create=tap("＋ Agregar cuenta de luz, agua, gas, internet...",()->{screen=3;draw();typeInput.setSelection(2);});root.addView(create);addSpace(root,12);
        LinearLayout p=panel(root);p.addView(white("Pendientes y atrasadas",17,true));addSpace(p,9);renderRows(p,1,150);
        LinearLayout q=panel(root);q.addView(white("Cuentas pagadas",17,true));addSpace(q,9);renderRows(q,2,60);
    }
    private void history(){
        heading("Movimientos","Ingresos, gastos y pagos registrados");
        LinearLayout p=panel(root);renderRows(p,0,200);
        TextView csv=tap("Exportar movimientos a CSV",()->exportCsv());root.addView(csv);
    }
    private void settings(){
        heading("Configuración","Mis Gastos Chile");
        TextView curr=tap("Moneda actual: "+currency,()->chooseCurrency());root.addView(curr);addSpace(root,8);
        TextView csv=tap("Exportar mis datos a CSV",()->exportCsv());root.addView(csv);
        addSpace(root,16);root.addView(light("Tus movimientos se almacenan en este dispositivo. Cambiar la moneda no convierte los montos antiguos.",13));
    }
    private class Donut extends View {
        Paint paint=new Paint(3);Donut(Context ctx){super(ctx);}
        @Override protected void onDraw(Canvas c){
            super.onDraw(c);float cx=getWidth()*.28f,cy=getHeight()*.5f,r=Math.min(getHeight()*.36f,getWidth()*.24f);
            String[] cats={"Servicios","Alimentación","Transporte","Hogar","Otros"};
            int[] cols={Color.rgb(52,129,243),Color.rgb(47,216,143),Color.rgb(249,158,64),Color.rgb(137,109,237),Color.rgb(253,110,100)};
            long[] vals=new long[5];long total=0;
            try(Cursor cur=db.getReadableDatabase().rawQuery("SELECT kind,category,amount,paid,created FROM movements",null)){
                while(cur.moveToNext()){
                    if(!inMonth(cur.getLong(4))||(cur.getInt(0)!=0&&!(cur.getInt(0)==2&&cur.getInt(3)==1)))continue;
                    String cat=cur.getString(1);int group=cat.matches("Luz|Agua|Gas|Internet|Plan celular")?0:cat.matches("Supermercado|Alimentación")?1:cat.matches("Bencina|Diésel|Parafina|Transporte")?2:cat.matches("Arriendo|Crédito|Tarjeta")?3:4;
                    vals[group]+=cur.getLong(2);total+=cur.getLong(2);
                }
            }
            paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(dp(22));
            if(total==0){paint.setColor(Color.rgb(58,74,93));c.drawCircle(cx,cy,r,paint);}
            else {float start=-90;for(int i=0;i<5;i++){if(vals[i]==0)continue;float sweep=360f*vals[i]/total;paint.setColor(cols[i]);c.drawArc(cx-r,cy-r,cx+r,cy+r,start,sweep,false,paint);start+=sweep;}}
            paint.setStyle(Paint.Style.FILL);paint.setTextSize(dp(12));
            float x=getWidth()*.57f;for(int i=0;i<5;i++){
                paint.setColor(cols[i]);c.drawCircle(x,dp(28+i*28),dp(5),paint);
                paint.setColor(Color.WHITE);c.drawText(cats[i],x+dp(12),dp(32+i*28),paint);
            }
        }
    }
    private void renderRows(LinearLayout parent,int mode,int max){
        String where=mode==1?"WHERE kind=2 AND paid=0":mode==2?"WHERE kind=2 AND paid=1":"";
        String order=mode==0?"created DESC":"CASE WHEN due>0 THEN due ELSE 9223372036854775807 END ASC,created DESC";
        int n=0;
        try(Cursor cur=db.getReadableDatabase().rawQuery("SELECT id,kind,category,amount,note,paid,receipt,created,due FROM movements "+where+" ORDER BY "+order+" LIMIT "+max,null)){
            while(cur.moveToNext()){
                n++;long id=cur.getLong(0),amount=cur.getLong(3),due=cur.getLong(8);int kind=cur.getInt(1),paid=cur.getInt(5);
                String cat=cur.getString(2),note=cur.getString(4),receipt=cur.getString(6);
                boolean late=kind==2&&paid==0&&due>0&&due<todayStart();
                LinearLayout line=new LinearLayout(this);line.setGravity(Gravity.CENTER_VERTICAL);line.setPadding(dp(2),dp(10),dp(2),dp(10));parent.addView(line);
                TextView emoji=white(iconFor(cat),22,false);emoji.setGravity(Gravity.CENTER);line.addView(emoji,new LinearLayout.LayoutParams(dp(38),-2));
                LinearLayout middle=vertical();line.addView(middle,new LinearLayout.LayoutParams(0,-2,1));
                middle.addView(white(cat,15,true));
                String state=kind==1?"Ingreso":kind==0?"Gasto":paid==1?"Pagada":late?"VENCIDA":"Pendiente";
                String deadline=due>0?" · vence "+date(due):"";
                TextView info=light(state+deadline+(note.isEmpty()?"":" · "+note),11);
                if(late)info.setTextColor(red);middle.addView(info);
                TextView price=white((kind==1?"+":"−")+money(amount),14,true);price.setTextColor(kind==1?green:(late?red:Color.WHITE));line.addView(price);
                line.setOnClickListener(v->entryOptions(id,kind,paid,cat,amount,receipt));
                View divider=new View(this);divider.setBackgroundColor(Color.rgb(48,61,81));parent.addView(divider,new LinearLayout.LayoutParams(-1,dp(1)));
            }
        }
        if(n==0)parent.addView(light("Aún no hay registros aquí.",13));
    }
    private String iconFor(String cat){
        if(cat.equals("Luz"))return "⚡";if(cat.equals("Agua"))return "💧";if(cat.equals("Gas"))return "🔥";
        if(cat.equals("Internet"))return "🌐";if(cat.equals("Plan celular"))return "📱";
        if(cat.equals("Bencina")||cat.equals("Diésel")||cat.equals("Parafina"))return "⛽";
        if(cat.equals("Arriendo"))return "🏠";if(cat.equals("Supermercado")||cat.equals("Alimentación"))return "🛒";
        if(cat.equals("Sueldo"))return "💵";return "💳";
    }
    private String date(long v){return new SimpleDateFormat("dd/MM/yyyy",new Locale("es","CL")).format(new Date(v));}
    private void entryOptions(long id,int kind,int paid,String category,long amount,String receipt){
        ArrayList<String> ops=new ArrayList<>();
        if(kind==2)ops.add(paid==0?"Marcar cuenta pagada":"Volver a pendiente");
        if(receipt!=null&&!receipt.isEmpty())ops.add("Ver comprobante");
        ops.add("Eliminar registro");
        new AlertDialog.Builder(this).setTitle(category+" · "+money(amount))
        .setItems(ops.toArray(new String[0]),(d,which)->{
            String op=ops.get(which);
            if(op.startsWith("Marcar")||op.startsWith("Volver")){
                int v=paid==0?1:0;
                new AlertDialog.Builder(this).setMessage(v==1?"¿Confirmar que esta cuenta está totalmente pagada?":"¿Marcar nuevamente como pendiente?")
                .setNegativeButton("Cancelar",null).setPositiveButton("Confirmar",(dlg,w)->{
                    db.getWritableDatabase().execSQL("UPDATE movements SET paid=? WHERE id=?",new Object[]{v,id});draw();
                }).show();
            }else if(op.equals("Ver comprobante"))openReceipt(receipt);
            else new AlertDialog.Builder(this).setTitle("Eliminar movimiento").setMessage("Esto no se puede deshacer.")
              .setNegativeButton("Cancelar",null).setPositiveButton("Eliminar",(dlg,w)->{
                  db.getWritableDatabase().execSQL("DELETE FROM movements WHERE id=?",new Object[]{id});draw();
              }).show();
        }).setNegativeButton("Cerrar",null).show();
    }
    private void form(){
        heading("Nuevo registro","Elige un tipo, categoría y monto");
        LinearLayout p=panel(root);
        p.addView(light("TIPO DE MOVIMIENTO",12));
        typeInput=new Spinner(this);typeInput.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,types));p.addView(typeInput);
        p.addView(light("CATEGORÍA",12));categoryInput=new Spinner(this);p.addView(categoryInput);
        typeInput.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){
            public void onNothingSelected(android.widget.AdapterView<?> parent){}
            public void onItemSelected(android.widget.AdapterView<?> parent,View view,int position,long id){
                String selected=categoryInput.getSelectedItem()==null?"":categoryInput.getSelectedItem().toString();
                String[] cats=position==1?incomeCategories:expenseCategories;
                categoryInput.setAdapter(new ArrayAdapter<>(MainActivity.this,android.R.layout.simple_spinner_dropdown_item,cats));
                int i=Arrays.asList(cats).indexOf(selected);if(i>=0)categoryInput.setSelection(i);
                paidInput.setVisibility(position==2?View.VISIBLE:View.GONE);
                dueInput.setVisibility(position==2?View.VISIBLE:View.GONE);
            }
        });
        p.addView(light("MONTO",12));amountInput=input("Ej. 48000",android.text.InputType.TYPE_CLASS_NUMBER);p.addView(amountInput);
        p.addView(light("EMPRESA, PERIODO O DETALLE",12));noteInput=input("Ej. Enel · noviembre 2026",android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);p.addView(noteInput);
        dueInput=input("Toca aquí para elegir vencimiento",android.text.InputType.TYPE_CLASS_TEXT);
        dueInput.setFocusable(false);dueInput.setOnClickListener(v->pickDueDate());p.addView(dueInput);
        paidInput=new CheckBox(this);paidInput.setText("Esta cuenta ya está pagada");paidInput.setTextColor(Color.WHITE);p.addView(paidInput);
        paidInput.setVisibility(View.GONE);dueInput.setVisibility(View.GONE);
        TextView attach=tap("📎 Adjuntar comprobante (opcional)",()->openReceiptPicker());p.addView(attach);
        receiptView=light("Sin comprobante adjunto",12);p.addView(receiptView);
        addSpace(root,5);TextView save=tap("✓ GUARDAR MOVIMIENTO",()->saveEntry());
        save.setBackground(rounded(Color.rgb(15,110,92)));root.addView(save);
        addSpace(root,12);
        root.addView(light("Para cuentas atrasadas: selecciona «Cuenta por pagar» e indica la fecha real de vencimiento, aunque sea anterior a hoy.",13));
    }
    private android.graphics.drawable.GradientDrawable rounded(int color){
        android.graphics.drawable.GradientDrawable d=new android.graphics.drawable.GradientDrawable();
        d.setColor(color);d.setCornerRadius(dp(14));return d;
    }
    private void pickDueDate(){
        Calendar c=Calendar.getInstance();
        if(dueValue>0)c.setTimeInMillis(dueValue);
        new DatePickerDialog(this,(view,year,month,day)->{
            Calendar picked=Calendar.getInstance();picked.clear();picked.set(year,month,day);dueValue=picked.getTimeInMillis();
            dueInput.setText("Vence: "+new SimpleDateFormat("dd/MM/yyyy",new Locale("es","CL")).format(new Date(dueValue)));
        },c.get(Calendar.YEAR),c.get(Calendar.MONTH),c.get(Calendar.DAY_OF_MONTH)).show();
    }
    private long todayStart(){
        Calendar c=Calendar.getInstance();c.set(Calendar.HOUR_OF_DAY,0);c.set(Calendar.MINUTE,0);c.set(Calendar.SECOND,0);c.set(Calendar.MILLISECOND,0);return c.getTimeInMillis();
    }
    private void chooseCurrency(){
        String[] vals={"CLP","USD","BRL","ARS","PEN","MXN","COP","EUR"};
        new AlertDialog.Builder(this).setTitle("Moneda de registro").setSingleChoiceItems(vals,Arrays.asList(vals).indexOf(currency),(d,which)->{
            currency=vals[which];getPreferences(MODE_PRIVATE).edit().putString("currency",currency).apply();d.dismiss();draw();
        }).setNegativeButton("Cancelar",null).show();
    }
    private void openReceiptPicker(){
        Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("*/*");
        i.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"application/pdf","image/jpeg","image/png","image/webp"});
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(i,PICK_RECEIPT);
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);if(result!=RESULT_OK || data==null)return;
        Uri uri=data.getData();if(uri==null)return;
        if(request==PICK_RECEIPT){
            try{getContentResolver().takePersistableUriPermission(uri,Intent.FLAG_GRANT_READ_URI_PERMISSION);}catch(Exception ignored){}
            receiptUri=uri.toString();if(receiptView!=null)receiptView.setText("Comprobante seleccionado ✓");
        }else if(request==CREATE_CSV){
            try(OutputStream out=getContentResolver().openOutputStream(uri)){
                if(out==null)throw new IOException("No se abrió archivo");
                out.write(new byte[]{(byte)0xEF,(byte)0xBB,(byte)0xBF});
                out.write(db.exportCsv().getBytes(java.nio.charset.StandardCharsets.UTF_8));
                Toast.makeText(this,"CSV guardado correctamente",Toast.LENGTH_LONG).show();
            }catch(Exception e){new AlertDialog.Builder(this).setMessage("No se pudo exportar: "+e.getMessage()).setPositiveButton("OK",null).show();}
        }
    }
    private void saveEntry(){
        String a=amountInput.getText().toString().trim();long amount;
        try{amount=Long.parseLong(a);if(amount<=0)throw new NumberFormatException();}catch(Exception e){amountInput.setError("Ingresa un monto mayor que cero");return;}
        int kind=typeInput.getSelectedItemPosition();
        db.getWritableDatabase().execSQL("INSERT INTO movements (kind,category,amount,note,paid,receipt,created,due) VALUES(?,?,?,?,?,?,?,?)",new Object[]{kind,categoryInput.getSelectedItem().toString(),amount,noteInput.getText().toString().trim(),kind==2&&paidInput.isChecked()?1:0,receiptUri,System.currentTimeMillis(),kind==2?dueValue:0});
        amountInput.setText("");noteInput.setText("");paidInput.setChecked(false);dueValue=0;dueInput.setText("");receiptUri="";receiptView.setText("Sin comprobante adjunto");screen=0;draw();
        Toast.makeText(this,"Movimiento guardado",Toast.LENGTH_SHORT).show();
    }
    private void exportCsv(){ Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("text/csv");intent.putExtra(Intent.EXTRA_TITLE,"mis_gastos_"+new SimpleDateFormat("yyyyMMdd",Locale.US).format(new Date())+".csv");startActivityForResult(intent,CREATE_CSV); }
    private void openReceipt(String str){
        try{Uri uri=Uri.parse(str);Intent i=new Intent(Intent.ACTION_VIEW);i.setDataAndType(uri,getContentResolver().getType(uri)==null?"*/*":getContentResolver().getType(uri));i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);startActivity(i);}catch(Exception e){new AlertDialog.Builder(this).setMessage("No se pudo abrir el comprobante. Revisa si el archivo sigue disponible.").setPositiveButton("OK",null).show();}
    }
    private static class DB extends SQLiteOpenHelper {
        DB(Context c){super(c,"mis_gastos_v1.db",null,2);}
        public void onCreate(SQLiteDatabase d){d.execSQL("CREATE TABLE movements (id INTEGER PRIMARY KEY AUTOINCREMENT,kind INTEGER NOT NULL,category TEXT NOT NULL,amount INTEGER NOT NULL,note TEXT NOT NULL,paid INTEGER NOT NULL DEFAULT 0,receipt TEXT NOT NULL DEFAULT '',created INTEGER NOT NULL,due INTEGER NOT NULL DEFAULT 0)");}
        public void onUpgrade(SQLiteDatabase d,int old,int next){if(old<2)d.execSQL("ALTER TABLE movements ADD COLUMN due INTEGER NOT NULL DEFAULT 0");}
        String exportCsv(){
            StringBuilder s=new StringBuilder("Fecha;Tipo;Categoría;Monto;Descripción;Pagado;URI comprobante\r\n");
            try(Cursor c=getReadableDatabase().rawQuery("SELECT kind,category,amount,note,paid,receipt,created FROM movements ORDER BY created DESC,id DESC",null)){
                while(c.moveToNext()){
                    String type=c.getInt(0)==1?"Ingreso":(c.getInt(0)==2?"Cuenta por pagar":"Gasto");
                    String dt=new SimpleDateFormat("dd/MM/yyyy HH:mm",Locale.US).format(new Date(c.getLong(6)));
                    String[] fields={dt,type,c.getString(1),String.valueOf(c.getLong(2)),c.getString(3),c.getInt(4)==1?"Sí":"No",c.getString(5)};
                    for(int x=0;x<fields.length;x++){if(x>0)s.append(';');s.append('"').append(fields[x].replace("\"","\"\"")).append('"');}s.append("\r\n");
                }
            }
            return s.toString();
        }
    }
}
