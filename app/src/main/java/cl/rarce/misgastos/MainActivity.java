package cl.rarce.misgastos;

import android.app.*;
import android.os.*;
import android.content.*;
import android.database.Cursor;
import android.database.sqlite.*;
import android.graphics.Color;
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
    private void draw() {
        ScrollView scroll = new ScrollView(this); scroll.setFillViewport(true); scroll.setBackgroundColor(Color.rgb(246,249,250));
        root = vertical(); root.setPadding(dp(16),dp(20),dp(16),dp(24)); scroll.addView(root); setContentView(scroll);
        LinearLayout top = new LinearLayout(this); top.setGravity(Gravity.CENTER_VERTICAL); root.addView(top);
        TextView title = text("Mis Gastos Chile", 26,true); title.setTextColor(slate); top.addView(title,new LinearLayout.LayoutParams(0,-2,1));
        Button cfg=button("Moneda"); top.addView(cfg); cfg.setOnClickListener(v -> chooseCurrency());
        TextView summaryTitle=text("MI RESUMEN FINANCIERO",13,true); summaryTitle.setTextColor(accent); root.addView(summaryTitle); addSpace(root,8);
        balanceView=text("",26,true); root.addView(balanceView); totalView=text("",15,false);root.addView(totalView); addSpace(root,20);
        TextView quickTitle=text("¿Qué quieres registrar?",19,true);root.addView(quickTitle);
        addSpace(root,9);
        quickContainer=vertical();root.addView(quickContainer);
        LinearLayout qr1=new LinearLayout(this);quickContainer.addView(qr1);
        quick(qr1,"💡 Cuenta del hogar",2,"Luz");
        quick(qr1,"⛽ Combustible",0,"Bencina");
        LinearLayout qr2=new LinearLayout(this);quickContainer.addView(qr2);
        quick(qr2,"🛒 Otros gastos",0,"Supermercado");
        quick(qr2,"💰 Ingresos",1,"Sueldo");
        addSpace(root,16);
        TextView newTitle=text("Agregar cuenta, gasto o ingreso",19,true);root.addView(newTitle);
        typeInput=new Spinner(this);typeInput.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,types));root.addView(typeInput);
        categoryInput=new Spinner(this);root.addView(categoryInput);
        typeInput.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){
            public void onNothingSelected(android.widget.AdapterView<?> parent){}
            public void onItemSelected(android.widget.AdapterView<?> parent,View view,int position,long id){
                String[] cats=position==1?incomeCategories:expenseCategories;
                categoryInput.setAdapter(new ArrayAdapter<>(MainActivity.this,android.R.layout.simple_spinner_dropdown_item,cats));
                paidInput.setVisibility(position==2?View.VISIBLE:View.GONE);
                if(dueInput!=null)dueInput.setVisibility(position==2?View.VISIBLE:View.GONE);
            }
        });
        amountInput=input("Monto (solo números)", android.text.InputType.TYPE_CLASS_NUMBER);root.addView(amountInput);
        noteInput=input("Empresa, periodo o descripción (opcional)",android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);root.addView(noteInput);
        dueInput=input("Fecha de vencimiento: tocar para elegir",android.text.InputType.TYPE_CLASS_TEXT);dueInput.setFocusable(false);dueInput.setVisibility(View.GONE);root.addView(dueInput);
        dueInput.setOnClickListener(v->pickDueDate());
        paidInput=new CheckBox(this);paidInput.setText("Esta cuenta ya está pagada");paidInput.setVisibility(View.GONE);root.addView(paidInput);
        Button attach=button("Adjuntar comprobante (PDF o imagen)");root.addView(attach);attach.setOnClickListener(v -> openReceiptPicker());
        receiptView=text("Sin comprobante adjunto",12,false);root.addView(receiptView);
        Button save=button("Guardar movimiento");root.addView(save);save.setOnClickListener(v -> saveEntry());
        addSpace(root,15);
        LinearLayout actions = new LinearLayout(this);root.addView(actions);
        Button export=button("Exportar CSV");actions.addView(export,new LinearLayout.LayoutParams(0,-2,1)); export.setOnClickListener(v -> exportCsv());
        Button refresh=button("Actualizar");actions.addView(refresh,new LinearLayout.LayoutParams(0,-2,1)); refresh.setOnClickListener(v -> updateList());
        addSpace(root,16);root.addView(text("Mis cuentas y movimientos",19,true));addSpace(root,8);
        items=vertical();root.addView(items);updateList();
    }
    private android.graphics.drawable.GradientDrawable rounded(int color){
        android.graphics.drawable.GradientDrawable d=new android.graphics.drawable.GradientDrawable();
        d.setColor(color);d.setCornerRadius(dp(14));return d;
    }
    private void quick(LinearLayout row,String title,int kind,String category){
        TextView t=text(title,14,true);t.setGravity(Gravity.CENTER);t.setPadding(dp(10),dp(20),dp(10),dp(20));t.setBackground(rounded(Color.WHITE));
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,-2,1);lp.setMargins(dp(2),dp(2),dp(6),dp(6));row.addView(t,lp);
        t.setOnClickListener(v->{
            typeInput.setSelection(kind);
            String[] cats=kind==1?incomeCategories:expenseCategories;
            categoryInput.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,cats));
            int idx=Arrays.asList(cats).indexOf(category);
            if(idx>=0)categoryInput.setSelection(idx);
            amountInput.requestFocus();
            ((android.view.inputmethod.InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).showSoftInput(amountInput,android.view.inputmethod.InputMethodManager.SHOW_IMPLICIT);
        });
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
            currency=vals[which];getPreferences(MODE_PRIVATE).edit().putString("currency",currency).apply();d.dismiss();updateList();
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
            receiptUri=uri.toString();receiptView.setText("Comprobante seleccionado ✓");
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
        amountInput.setText("");noteInput.setText("");paidInput.setChecked(false);dueValue=0;dueInput.setText("");receiptUri="";receiptView.setText("Sin comprobante adjunto");updateList();
        Toast.makeText(this,"Movimiento guardado",Toast.LENGTH_SHORT).show();
    }
    private void exportCsv(){ Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("text/csv");intent.putExtra(Intent.EXTRA_TITLE,"mis_gastos_"+new SimpleDateFormat("yyyyMMdd",Locale.US).format(new Date())+".csv");startActivityForResult(intent,CREATE_CSV); }
    private void updateList(){
        long income=0,spent=0,pending=0,overdue=0;int lateCount=0;items.removeAllViews();
        try(Cursor c=db.getReadableDatabase().rawQuery("SELECT id,kind,category,amount,note,paid,receipt,created,due FROM movements ORDER BY CASE WHEN kind=2 AND paid=0 THEN 0 ELSE 1 END, CASE WHEN due>0 THEN due ELSE created END ASC,id DESC",null)){
            int n=0;
            while(c.moveToNext()){
                long id=c.getLong(0), amount=c.getLong(3), created=c.getLong(7);int kind=c.getInt(1),paid=c.getInt(5);
                String category=c.getString(2),note=c.getString(4),receipt=c.getString(6);long due=c.getLong(8);boolean late=kind==2&&paid==0&&due>0&&due<todayStart();if(late){lateCount++;overdue+=amount;}
                if(kind==1)income+=amount;else if(kind==0||paid==1)spent+=amount;else pending+=amount;
                if(n++>=150)continue;
                LinearLayout card=vertical();card.setBackground(rounded(Color.WHITE));card.setPadding(dp(14),dp(12),dp(14),dp(12));
                LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.bottomMargin=dp(7);items.addView(card,lp);
                String status=kind==1?"Ingreso":(kind==2?(paid==1?"Cuenta pagada":late?"⚠ VENCIDA":"Cuenta pendiente"):"Gasto");
                TextView headline=text(category+" · "+status+" · "+money(amount),15,true);headline.setTextColor(kind==1?accent:(late?Color.rgb(196,47,53):kind==2&&paid==0?Color.rgb(181,117,21):slate));card.addView(headline);
                String stamp=new SimpleDateFormat("dd/MM/yyyy HH:mm",new Locale("es","CL")).format(new Date(created));card.addView(text(stamp+(note.isEmpty()?"":" · "+note)+(kind==2&&due>0?"\nVencimiento: "+new SimpleDateFormat("dd/MM/yyyy",new Locale("es","CL")).format(new Date(due)):""),13,false));
                LinearLayout controls=new LinearLayout(this);card.addView(controls);
                if(receipt!=null&&!receipt.isEmpty()){
                    Button view=button("Ver comprobante");controls.addView(view);view.setOnClickListener(v -> openReceipt(receipt));
                }
                if(kind==2){Button toggle=button(paid==1?"Marcar pendiente":"Marcar pagada");controls.addView(toggle);toggle.setOnClickListener(v -> {db.getWritableDatabase().execSQL("UPDATE movements SET paid=? WHERE id=?",new Object[]{paid==1?0:1,id});updateList();});}
                Button delete=button("Eliminar");controls.addView(delete);delete.setOnClickListener(v -> new AlertDialog.Builder(this).setTitle("¿Eliminar movimiento?").setMessage("Esta acción no se puede deshacer.").setNegativeButton("Cancelar",null).setPositiveButton("Eliminar",(d,w)->{db.getWritableDatabase().execSQL("DELETE FROM movements WHERE id=?",new Object[]{id});updateList();}).show());
            }
            if(n==0)items.addView(text("Todavía no registras movimientos.",14,false));
            if(n>150)items.addView(text("Mostrando los 150 movimientos más recientes. La exportación incluye todos.",12,false));
        }
        balanceView.setText("Saldo: "+money(income-spent));
        totalView.setText("Ingresos "+money(income)+"  |  Gastos pagados "+money(spent)+"\nPendiente por pagar: "+money(pending)+(lateCount>0?"\n⚠ "+lateCount+" cuentas vencidas: "+money(overdue):""));
    }
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
