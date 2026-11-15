Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Check if port 8000 is active
ret = WshShell.Run("curl.exe -s http://127.0.0.1:8000/api/system/status", 0, True)
If ret <> 0 Then
    ' Start server hidden (0 means hidden window)
    WshShell.CurrentDirectory = scriptDir
    WshShell.Run ".venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000", 0, False
    WScript.Sleep 2500
End If

' Open default browser
WshShell.Run "http://127.0.0.1:8000"
