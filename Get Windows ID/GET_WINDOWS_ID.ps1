Write-Host "`n=== MachineGuid ==="
Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Cryptography" | Select-Object MachineGuid

Write-Host "`n=== ComputerName ==="
Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\ComputerName\ActiveComputerName" | Select-Object ComputerName

Write-Host "`n=== Hostname ==="
Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters" | Select-Object Hostname

Write-Host "`n=== Profile SID ==="
Get-ChildItem "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList" |
Select-Object PSChildName, @{n='ProfileImagePath';e={(Get-ItemProperty $_.PSPath).ProfileImagePath}}

Write-Host "`n=== DigitalProductId presence ==="
(Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion").PSObject.Properties |
Where-Object Name -eq 'DigitalProductId' | Select-Object Name