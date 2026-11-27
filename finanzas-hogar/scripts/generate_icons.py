from pathlib import Path
import cairosvg
import xml.etree.ElementTree as ET

root=Path('android/app/src/main/res')
svg=Path('assets/icon.svg').read_text(encoding='utf-8')
# Icono clásico con el diseño íntegro
for dpi,size in [('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)]:
    folder=root/('mipmap-'+dpi)
    folder.mkdir(parents=True,exist_ok=True)
    for name in ('mis_finanzas_launcher.png','mis_finanzas_launcher_round.png'):
        cairosvg.svg2png(bytestring=svg.encode(),write_to=str(folder/name),output_width=size,output_height=size)

# Iconos adaptativos: fondo separado y motivo dentro de la zona segura Android
foreground=svg.replace('<rect width="512" height="512" rx="100" fill="url(#bg)"/>','')
foreground=foreground.replace('<path d="M82 238', '<g transform="translate(63 63) scale(.755)"><path d="M82 238')
foreground=foreground.replace('</svg>','</g></svg>')
drawable=root/'drawable'
drawable.mkdir(parents=True,exist_ok=True)
cairosvg.svg2png(bytestring=foreground.encode(),write_to=str(drawable/'mis_finanzas_foreground.png'),output_width=432,output_height=432)
values=root/'values'
values.mkdir(parents=True,exist_ok=True)
(values/'icon_background.xml').write_text('<resources><color name="finanzas_icon_background">#132634</color></resources>',encoding='utf-8')
adaptive=root/'mipmap-anydpi-v26'
adaptive.mkdir(parents=True,exist_ok=True)
for name in ('mis_finanzas_launcher.xml','mis_finanzas_launcher_round.xml'):
    (adaptive/name).write_text(
      '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">'
      '<background android:drawable="@color/finanzas_icon_background"/>'
      '<foreground android:drawable="@drawable/mis_finanzas_foreground"/>'
      '</adaptive-icon>',encoding='utf-8')

# Forzar referencias explícitas al icono nuevo en el manifiesto
manifest=Path('android/app/src/main/AndroidManifest.xml')
tree=ET.parse(manifest)
ns='{http://schemas.android.com/apk/res/android}'
app=tree.getroot().find('application')
assert app is not None
app.set(ns+'icon','@mipmap/mis_finanzas_launcher')
app.set(ns+'roundIcon','@mipmap/mis_finanzas_launcher_round')
app.set(ns+'label','Mis Finanzas')
ET.register_namespace('android','http://schemas.android.com/apk/res/android')
tree.write(manifest,encoding='utf-8',xml_declaration=True)
print('Icono Mis Finanzas NUEVO generado con nombres únicos y referenciado en AndroidManifest.xml')
