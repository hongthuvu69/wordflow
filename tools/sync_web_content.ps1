# Copy content/*.json sang docs/content/ cho web app (iPhone) và tạo docs/content/index.json
# liệt kê các file. Chạy tự động trong build.bat; có thể chạy riêng sau khi sửa nội dung.
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root "content"
$dst = Join-Path $root "docs\content"
New-Item -ItemType Directory -Force $dst | Out-Null
Get-ChildItem $dst -Filter *.json | Remove-Item
$files = Get-ChildItem $src -Filter *.json | Sort-Object Name
foreach ($f in $files) { Copy-Item $f.FullName (Join-Path $dst $f.Name) }
$names = @($files | ForEach-Object { '"' + $_.Name + '"' }) -join ", "
[IO.File]::WriteAllText((Join-Path $dst "index.json"), "{ ""files"": [ $names ] }`n", (New-Object Text.UTF8Encoding $false))
"Web content: $($files.Count) file(s) -> docs/content"
