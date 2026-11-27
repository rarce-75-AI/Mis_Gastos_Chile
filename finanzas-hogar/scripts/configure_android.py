"""Comprueba plataforma regenerada y fija una versión de actualización no ambigua."""
import os
import re
from pathlib import Path

run = os.environ.get("GITHUB_RUN_NUMBER", "")
if not run.isdigit() or int(run) <= 0:
    raise SystemExit("GITHUB_RUN_NUMBER debe ser un entero positivo")
variables = Path("android/variables.gradle").read_text()
for key in ("compileSdkVersion", "targetSdkVersion"):
    if not re.search(r"\b" + key + r"\s*=\s*36\b", variables):
        raise SystemExit(f"La plataforma generada no configura {key}=36")
path = Path("android/app/build.gradle")
source = path.read_text()
source, count = re.subn(r"(?m)^(\s*versionCode)\s*(?:=\s*)?\d+\s*$",
                        lambda m: f"{m[1]} = {run}", source)
if count != 1:
    raise SystemExit("No se encontró una única declaración versionCode")
source, count = re.subn(r'(?m)^(\s*versionName)\s*(?:=\s*)?"[^"]+"\s*$',
                        lambda m: f'{m[1]} = "1.2.{run}"', source)
if count != 1:
    raise SystemExit("No se encontró una única declaración versionName")
path.write_text(source)
print(f"Android API 36, versionCode={run}, versionName=1.2.{run}")

# Native Play Billing bridge, generated with the Capacitor Android project.
import shutil
java_dir = Path("android/app/src/main/java/cl/rarce/finanzashogar")
shutil.copyfile("native/FinanceBilling.java", java_dir / "FinanceBilling.java")
activity = java_dir / "MainActivity.java"
activity.write_text("""package cl.rarce.finanzashogar;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
 private com.google.android.play.core.appupdate.AppUpdateManager updates;
 private boolean offered=false;
 private final com.google.android.play.core.install.InstallStateUpdatedListener listener=state->{if(state.installStatus()==com.google.android.play.core.install.model.InstallStatus.DOWNLOADED)runOnUiThread(this::restartOffer);};
 private void restartOffer(){if(isFinishing()||isDestroyed())return;new android.app.AlertDialog.Builder(this).setTitle("Actualización descargada").setMessage("Guarda tus cambios antes de reiniciar.").setPositiveButton("Actualizar",(d,w)->updates.completeUpdate()).setNegativeButton("Más tarde",null).show();}
 @Override protected void onResume(){super.onResume();if(updates==null)return;updates.getAppUpdateInfo().addOnSuccessListener(info->{
 if(isFinishing()||isDestroyed())return;
 if(info.installStatus()==com.google.android.play.core.install.model.InstallStatus.DOWNLOADED){restartOffer();return;}
 int availability=info.updateAvailability();
 if(availability==3){launchUpdate(info,1);return;}
 if(availability!=2||offered)return;
 int mode=info.updatePriority()>=4&&info.isUpdateTypeAllowed(1)?1:0;
 if(!info.isUpdateTypeAllowed(mode))return;
 offered=true;
 android.app.AlertDialog.Builder dialog=new android.app.AlertDialog.Builder(this).setTitle(mode==1?"Actualización necesaria":"Actualización disponible").setMessage("Hay una nueva versión de Mis Finanzas. Guarda tus cambios antes de actualizar.").setPositiveButton("Actualizar",(d,w)->launchUpdate(info,mode));
 if(mode==0)dialog.setNegativeButton("Más tarde",null);else dialog.setCancelable(false);dialog.show();
 });}
 private void launchUpdate(com.google.android.play.core.appupdate.AppUpdateInfo info,int mode){try{updates.startUpdateFlowForResult(info,this,com.google.android.play.core.appupdate.AppUpdateOptions.newBuilder(mode).build(),804);}catch(Exception e){android.util.Log.w("FIN_UPDATE","Update unavailable",e);}}
 @Override protected void onDestroy(){if(updates!=null)updates.unregisterListener(listener);super.onDestroy();}

 @Override public void onCreate(Bundle state){registerPlugin(FinanceBilling.class);super.onCreate(state);updates=com.google.android.play.core.appupdate.AppUpdateManagerFactory.create(this);updates.registerListener(listener);}
}
""")
with path.open("a") as f:
    f.write("\ndependencies { implementation 'com.android.billingclient:billing:8.0.0'; implementation 'com.google.android.play:app-update:2.1.0' }\n")

manifest = Path("android/app/src/main/AndroidManifest.xml")
manifest.write_text(re.sub(r'android:allowBackup="[^"]+"', 'android:allowBackup="false"', manifest.read_text()))
