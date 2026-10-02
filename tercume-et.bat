@echo off
rem Word (.docx) ve ya PDF faylini bu faylin uzerine atin - Azerbaycan dilina tercume olunur.
rem Netice orijinalin yaninda yaranir: ad.az.docx / ad.az.pdf
chcp 65001 >nul
if "%~1"=="" (
  echo Word ve ya PDF faylini sicanla bu faylin uzerine atin.
  pause
  exit /b 1
)
node "%~dp0tools\translate-doc.js" %*
echo.
pause
