# Run on a physical Android phone (USB). Uses assets/config/api_config.json for API URL.
Set-Location $PSScriptRoot\..
Write-Host "API config: assets/config/api_config.json"
Write-Host "Ensure API_BASE_URL is your PC LAN IP (ipconfig), not 10.0.2.2"
flutter clean
flutter pub get
flutter run
