import os
import subprocess

desktop = os.path.join(os.environ["USERPROFILE"], "Desktop")
lnk_path = os.path.join(desktop, "ZCodeDev Social Publisher.lnk")
vbs_path = os.path.abspath("Launch_Silent.vbs")
work_dir = os.path.abspath(".")
icon_path = os.path.join(os.environ["WINDIR"], "System32", "shell32.dll")

vbs_content = f'''Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = "{lnk_path}"
Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = "wscript.exe"
oLink.Arguments = """{vbs_path}"""
oLink.WorkingDirectory = "{work_dir}"
oLink.Description = "Launch ZCodeDev Social Publisher Web Studio"
oLink.IconLocation = "{icon_path},220"
oLink.Save
'''

temp_vbs = "make_shortcut.vbs"
with open(temp_vbs, "w", encoding="utf-8") as f:
    f.write(vbs_content)

subprocess.run(["cscript", "//nologo", temp_vbs], check=True)
if os.path.exists(temp_vbs):
    os.remove(temp_vbs)

print("Desktop shortcut exists:", os.path.exists(lnk_path))
