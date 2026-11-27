const {onRequest}=require("firebase-functions/v2/https");
const {defineSecret}=require("firebase-functions/params");
const {GoogleAuth}=require("google-auth-library");
const crypto=require("node:crypto");
const key=defineSecret("FINANCE_LICENSE_SIGNING_KEY");
const auth=new GoogleAuth({scopes:["https://www.googleapis.com/auth/androidpublisher"]});
const pkg="cl.rarce.finanzashogar",sku="mis_finanzas_pro";
exports.financeVerifyPurchase=onRequest({region:"southamerica-west1",secrets:[key],maxInstances:5,timeoutSeconds:30},async(req,res)=>{
 res.set("Cache-Control","no-store");
 if(req.method!=="POST")return res.status(405).json({error:"method"});
 const token=req.body?.purchaseToken;
 if(typeof token!=="string"||token.length<10||token.length>4096)return res.status(400).json({error:"token"});
 try{
 const client=await auth.getClient();
 const url="https://androidpublisher.googleapis.com/androidpublisher/v3/applications/"+pkg+"/purchases/products/"+sku+"/tokens/"+encodeURIComponent(token);
 const {data}=await client.request({url});
 if(data.purchaseState!==0)return res.json({owned:false,state:data.purchaseState});
 if(data.acknowledgementState!==1)await client.request({url:url+":acknowledge",method:"POST",data:{}});
 const now=Math.floor(Date.now()/1000);
 const payload=Buffer.from(JSON.stringify({v:1,pkg,sku,tokenHash:crypto.createHash("sha256").update(token).digest("hex"),iat:now,exp:now+7*86400})).toString("base64url");
 const signature=crypto.sign("sha256",Buffer.from(payload),key.value()).toString("base64url");
 return res.json({owned:true,payload,signature});
 }catch(e){const status=e.response?.status;if(status===404||status===410)return res.json({owned:false});return res.status(503).json({error:"verification_unavailable"});}
});
