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
