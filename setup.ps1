# setup.ps1 — 首次安装：把本仓库挂成 DSH 技能 + 生成 config.json
# 用法：  pwsh -File setup.ps1            （只挂链 + 建配置）
#         pwsh -File setup.ps1 -LinkOnly  （只挂链）
#
# 设计：仓库留在自己的工作目录（便于 git 维护），技能目录里放一个 Junction 指过来，
#       这样两边是同一份文件，不会分叉。

[CmdletBinding()]
param(
  [string]$SkillsRoot = (Join-Path $env:USERPROFILE '.agents\skills'),
  [string]$LinkName   = 'deepseek-imagen',
  [switch]$LinkOnly,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$repo = $PSScriptRoot
Write-Host "仓库目录   : $repo"
Write-Host "技能根目录 : $SkillsRoot"

# 0. 前置检查
if (-not (Test-Path (Join-Path $repo 'SKILL.md'))) {
  throw "没找到 SKILL.md —— 请把 setup.ps1 放在仓库根目录运行。"
}
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw "没找到 node。本工具需要 Node >= 18。" }
Write-Host "Node       : $(& node --version)"

# 1. 建技能根目录
if (-not (Test-Path $SkillsRoot)) {
  New-Item -ItemType Directory -Force -Path $SkillsRoot | Out-Null
  Write-Host "已创建技能根目录"
}

# 2. 挂 Junction（已存在则跳过，除非 -Force）
$link = Join-Path $SkillsRoot $LinkName
if (Test-Path $link) {
  $item = Get-Item $link -Force
  if ($item.LinkType -eq 'Junction') {
    Write-Host "Junction 已存在: $link -> $($item.Target)"
    if ($Force) {
      Write-Host "  -Force：删除后重建"
      (Get-Item $link -Force).Delete()
    } else {
      $link = $null   # 无需重建
    }
  } else {
    throw "目标已存在且不是 Junction：$link 。请先自行处理（不要直接删，可能是别人的技能）。"
  }
}
if ($link) {
  New-Item -ItemType Junction -Path $link -Target $repo | Out-Null
  Write-Host "已创建 Junction: $link -> $repo"
}

if ($LinkOnly) { Write-Host "`n-LinkOnly：跳过配置文件生成。"; exit 0 }

# 3. 生成 config.json（已存在则不动）
$cfgPath = Join-Path $repo 'config.json'
if (Test-Path $cfgPath) {
  Write-Host "config.json 已存在，未改动：$cfgPath"
} else {
  Copy-Item (Join-Path $repo 'config.example.json') $cfgPath
  Write-Host "已从模板生成 config.json：$cfgPath"
  Write-Host "  → 请打开它，把 ""api_key"" 填成你的 apib.ai 密钥（sk- 开头）" -ForegroundColor Yellow
}

# 4. 确认 config.json 被 gitignore 挡住（防止密钥进仓）
if (Test-Path (Join-Path $repo '.git')) {
  Push-Location $repo
  try {
    $ignored = git check-ignore -q 'config.json' 2>$null; $code = $LASTEXITCODE
    if ($code -eq 0) { Write-Host "已确认 config.json 被 .gitignore 忽略 ✓" -ForegroundColor Green }
    else { Write-Host "警告：config.json 未被 .gitignore 忽略！提交前务必检查。" -ForegroundColor Red }
  } finally { Pop-Location }
}

Write-Host "`n下一步：" -ForegroundColor Cyan
Write-Host "  1) 填好 config.json 里的 api_key"
Write-Host "  2) 自检： node `"$repo\scripts\gen.mjs`" --check"
Write-Host "  3) 预演： node `"$repo\scripts\gen.mjs`" --prompt `"a red apple on a white table`" --dry-run"
Write-Host "  4) 出图： node `"$repo\scripts\gen.mjs`" --prompt-file prompt.txt --ratio 1:1"
Write-Host ""
Write-Host "注意：新建的技能需要**重开一个会话**才会出现在 AI 的技能列表里。" -ForegroundColor Yellow
