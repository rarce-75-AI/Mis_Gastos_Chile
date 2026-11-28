package cl.rarce.finanzashogar;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.android.billingclient.api.*;
import java.util.*;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.spec.X509EncodedKeySpec;
import android.util.Base64;
import org.json.JSONObject;
@CapacitorPlugin(name="FinanceBilling")
public class FinanceBilling extends Plugin {
 private static final String SKU="mis_finanzas_pro";
 private BillingClient client;
 private PluginCall pending;
 private ProductDetails product;
 private boolean owned=false;
 private static final String PUBLIC_KEY="MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0r/kNMCrAst5ZmhtS6DTLAn0VOY/PTj4koi7TcSyBUukO2+j31LSscwQmpN4Hnst2/fcElenBSKprVeDvIXpEJ5Byq6aUQ/4ieLKoSsypkxaLL8i5bYeWuAeC2mnHWLOc10+3EvtyWrwpBjQ8dvH11Xaam/ixEuVnuBHH+A0UqZkCw+OG3B8dwzYLRx9PMWY8FeINfee4KSXdEuiDCOUUvsgn/UzCE3fXGRriOrs0Ix+JN+xbNs5nxhGyS2OWiFElJSdERLfz+F1rZb4MALlyOwXXdOnvN2yRuqdtPf/e+XkN5pQMqKYy54QjLpTZ3nu9Mn4s2stBT/91nEm/xmjzQIDAQAB";
 private static final String ENDPOINT="https://southamerica-west1-kimora-apps.cloudfunctions.net/financeVerifyPurchase";
 private final java.util.concurrent.ExecutorService verifier=java.util.concurrent.Executors.newSingleThreadExecutor();
 private android.content.SharedPreferences prefs(){return getContext().getSharedPreferences("finance_billing",0);}
 private boolean valid(String payload,String signature,String token) {
  try {
   Signature check=Signature.getInstance("SHA256withRSA");
   check.initVerify(KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(Base64.decode(PUBLIC_KEY,Base64.DEFAULT))));
   check.update(payload.getBytes(StandardCharsets.UTF_8));
   if(!check.verify(Base64.decode(signature,Base64.URL_SAFE|Base64.NO_WRAP|Base64.NO_PADDING)))return false;
   JSONObject p=new JSONObject(new String(Base64.decode(payload,Base64.URL_SAFE|Base64.NO_WRAP|Base64.NO_PADDING),StandardCharsets.UTF_8));
   long now=System.currentTimeMillis()/1000;
   if(p.getInt("v")!=1||!SKU.equals(p.getString("sku"))||!getContext().getPackageName().equals(p.getString("pkg"))||p.getLong("exp")<=now||p.getLong("iat")>now+300||p.getLong("exp")-p.getLong("iat")>604800)return false;
   if(token!=null){StringBuilder hash=new StringBuilder();for(byte x:MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)))hash.append(String.format(Locale.ROOT,"%02x",x&255));if(!hash.toString().equals(p.getString("tokenHash")))return false;}
   return true;
  }catch(Exception e){return false;}
 }
 private boolean cached(){return valid(prefs().getString("payload",""),prefs().getString("signature",""),null);}
 private void clearLicense(){owned=false;prefs().edit().remove("owned").remove("payload").remove("signature").apply();}
 @PluginMethod public void cachedStatus(PluginCall call){JSObject out=new JSObject();out.put("owned",cached());call.resolve(out);}
 private void verifyPurchase(Purchase purchase,PluginCall call){
  verifier.execute(()->{
   HttpURLConnection connection=null;
   try{
    connection=(HttpURLConnection)new URL(ENDPOINT).openConnection();
    connection.setConnectTimeout(15000);connection.setReadTimeout(30000);connection.setRequestMethod("POST");connection.setDoOutput(true);
    connection.setRequestProperty("Content-Type","application/json");
    byte[] body=new JSONObject().put("purchaseToken",purchase.getPurchaseToken()).toString().getBytes(StandardCharsets.UTF_8);
    try(OutputStream stream=connection.getOutputStream()){stream.write(body);}
    if(connection.getResponseCode()!=200)throw new IOException("Validación temporalmente no disponible");
    ByteArrayOutputStream bytes=new ByteArrayOutputStream();
    try(InputStream stream=connection.getInputStream()){byte[] buffer=new byte[4096];int n;while((n=stream.read(buffer))!=-1){bytes.write(buffer,0,n);if(bytes.size()>32768)throw new IOException("Respuesta inválida");}}
    JSONObject result=new JSONObject(bytes.toString("UTF-8"));
    if(!result.getBoolean("owned"))clearLicense();
    else{
     String payload=result.getString("payload"),signature=result.getString("signature");
     if(!valid(payload,signature,purchase.getPurchaseToken()))throw new SecurityException("Licencia inválida");
     prefs().edit().remove("owned").putString("payload",payload).putString("signature",signature).apply();owned=true;
    }
    getActivity().runOnUiThread(()->queryProduct(call,false));
   }catch(Exception e){owned=cached();getActivity().runOnUiThread(()->{if(call!=null)call.reject("No se pudo verificar la compra. Intenta restaurarla.");});}
   finally{if(connection!=null)connection.disconnect();}
  });
 }
 private boolean reviewAccess(){return getContext().getSharedPreferences("finance_review",0).getBoolean("enabled",false);}
 @PluginMethod public void review(PluginCall call){
  String code=call.getString("code","");
  if(!"KMR-Review-8f3c71d9a6e24b05".equals(code)){call.reject("Código incorrecto");return;}
  getContext().getSharedPreferences("finance_review",0).edit().putBoolean("enabled",true).apply();
  JSObject out=new JSObject();out.put("review",true);call.resolve(out);
 }
 @PluginMethod public void reviewStatus(PluginCall call){JSObject out=new JSObject();out.put("review",reviewAccess());call.resolve(out);}
 @Override public void load(){
  client=BillingClient.newBuilder(getContext()).enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build()).setListener((result,purchases)->{
   PluginCall call=pending;pending=null;
   if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK){if(call!=null)call.reject(result.getDebugMessage());return;}
   refresh(call);
  }).build();
 }
 private void ready(PluginCall call,Runnable work){
  if(client.isReady()){work.run();return;}
  client.startConnection(new BillingClientStateListener(){
   public void onBillingSetupFinished(BillingResult r){if(r.getResponseCode()==0)work.run();else if(call!=null)call.reject(r.getDebugMessage());}
   public void onBillingServiceDisconnected(){}
  });
 }
 private void refresh(PluginCall call){
  client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),(r,ps)->{
   if(r.getResponseCode()!=0){if(call!=null)call.reject(r.getDebugMessage());return;}
   for(Purchase p:ps){if(p.getProducts().contains(SKU)&&p.getPurchaseState()==Purchase.PurchaseState.PURCHASED){verifyPurchase(p,call);return;}}
   clearLicense();
   queryProduct(call,false);
  });
 }
 private void queryProduct(PluginCall call,boolean buy){
  QueryProductDetailsParams.Product p=QueryProductDetailsParams.Product.newBuilder().setProductId(SKU).setProductType(BillingClient.ProductType.INAPP).build();
  client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(Collections.singletonList(p)).build(),(r,details)->{
   product=details.getProductDetailsList().isEmpty()?null:details.getProductDetailsList().get(0);
   if(buy){
    if(product==null){call.reject("Producto no disponible en Google Play");return;}
    BillingFlowParams.ProductDetailsParams.Builder offer=BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product);
    ProductDetails.OneTimePurchaseOfferDetails detailsOffer=product.getOneTimePurchaseOfferDetails();
    if(detailsOffer==null){call.reject("Oferta no disponible");return;}
    String token=detailsOffer.getOfferToken();if(token!=null&&!token.isEmpty())offer.setOfferToken(token);
    getActivity().runOnUiThread(()->{if(pending!=null){call.reject("Compra en curso");return;}pending=call;BillingResult result=client.launchBillingFlow(getActivity(),BillingFlowParams.newBuilder().setProductDetailsParamsList(Collections.singletonList(offer.build())).build());if(result.getResponseCode()!=0){pending=null;call.reject(result.getDebugMessage());}});
   }else if(call!=null){JSObject out=new JSObject();out.put("owned",owned);out.put("price",product!=null&&product.getOneTimePurchaseOfferDetails()!=null?product.getOneTimePurchaseOfferDetails().getFormattedPrice():"");call.resolve(out);}
  });
 }
 @PluginMethod public void status(PluginCall call){ready(call,()->refresh(call));}
 @PluginMethod public void buy(PluginCall call){ready(call,()->queryProduct(call,true));}
}
