package cl.rarce.finanzashogar;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.android.billingclient.api.*;
import java.util.*;
@CapacitorPlugin(name="FinanceBilling")
public class FinanceBilling extends Plugin {
 private static final String SKU="mis_finanzas_pro";
 private BillingClient client;
 private PluginCall pending;
 private ProductDetails product;
 private boolean owned=false;
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
   owned=false;
   for(Purchase p:ps){if(p.getProducts().contains(SKU)&&p.getPurchaseState()==Purchase.PurchaseState.PURCHASED){
    if(p.isAcknowledged())owned=true;
    else {client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(),a->{if(a.getResponseCode()==0){owned=true;queryProduct(call,false);}else if(call!=null)call.reject(a.getDebugMessage());});return;}
   }}
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
