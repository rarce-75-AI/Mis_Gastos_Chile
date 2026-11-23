from pathlib import Path
import cairosvg
root=Path('android/app/src/main/res')
src=Path('assets/icon.svg').read_bytes()
for dpi,size in [('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)]:
    folder=root/('mipmap-'+dpi);folder.mkdir(parents=True,exist_ok=True)
    for name in ('ic_launcher.png','ic_launcher_round.png'):
        cairosvg.svg2png(bytestring=src,write_to=str(folder/name),output_width=size,output_height=size)
drawable=root/'drawable';drawable.mkdir(parents=True,exist_ok=True)
cairosvg.svg2png(bytestring=src,write_to=str(drawable/'ic_launcher_foreground.png'),output_width=432,output_height=432)
values=root/'values';values.mkdir(parents=True,exist_ok=True)
(values/'icon_background.xml').write_text('<resources><color name="finanzas_icon_background">#0B1729</color></resources>')
adaptive=root/'mipmap-anydpi-v26';adaptive.mkdir(parents=True,exist_ok=True)
for name in ['ic_launcher.xml','ic_launcher_round.xml']:
    (adaptive/name).write_text('<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/finanzas_icon_background"/><foreground android:drawable="@drawable/ic_launcher_foreground"/></adaptive-icon>')
print('Ícono Finanzas Hogar creado en las densidades Android')
