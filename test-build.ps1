# 本地测试构建脚本
Write-Host "Testing frontend build locally..." -ForegroundColor Green

# 进入前端目录
Set-Location frontend

# 清理
if (Test-Path "node_modules") {
    Write-Host "Cleaning node_modules..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force node_modules
}

if (Test-Path "build") {
    Write-Host "Cleaning build..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force build
}

# 安装依赖
Write-Host "Installing dependencies..." -ForegroundColor Green
npm install --legacy-peer-deps

if ($LASTEXITCODE -ne 0) {
    Write-Host "npm install failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}

# 设置环境变量并构建
Write-Host "Building frontend..." -ForegroundColor Green
$env:REACT_APP_API_URL = "/api"
$env:CI = "true"
$env:GENERATE_SOURCEMAP = "false"

npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "npm build failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Write-Host "Build successful!" -ForegroundColor Green
Set-Location ..
