param(
  [Parameter(Mandatory = $true)]
  [string]$BaseUrl,

  [string]$UserToken = "",
  [string]$AdminToken = "",
  [int]$TimeoutSec = 20
)

$ErrorActionPreference = "Stop"

function Test-Endpoint {
  param(
    [string]$Name,
    [string]$Method,
    [string]$Url,
    [hashtable]$Headers = @{},
    [int[]]$ExpectedStatus = @(200)
  )

  $status = -1
  $ok = $false
  $details = ""

  try {
    $response = Invoke-WebRequest -Method $Method -Uri $Url -Headers $Headers -TimeoutSec $TimeoutSec
    $status = [int]$response.StatusCode
    $ok = $ExpectedStatus -contains $status
    $details = "status=$status"
  } catch {
    $webResponse = $_.Exception.Response
    if ($null -ne $webResponse) {
      $status = [int]$webResponse.StatusCode
      $ok = $ExpectedStatus -contains $status
      $details = "status=$status"
    } else {
      $details = $_.Exception.Message
    }
  }

  [PSCustomObject]@{
    Name   = $Name
    Method = $Method
    Url    = $Url
    Ok     = $ok
    Detail = $details
  }
}

$base = $BaseUrl.TrimEnd("/")
$results = @()

Write-Host "Running WevenFinance health check for: $base" -ForegroundColor Cyan

# Public endpoints
$results += Test-Endpoint -Name "API docs" -Method "GET" -Url "$base/api/docs" -ExpectedStatus @(200)
$results += Test-Endpoint -Name "Swagger UI" -Method "GET" -Url "$base/swagger" -ExpectedStatus @(200)
$results += Test-Endpoint -Name "Webhook health" -Method "GET" -Url "$base/api/mercadopago/webhook" -ExpectedStatus @(200)
$results += Test-Endpoint -Name "System plans (public read)" -Method "GET" -Url "$base/api/system/plans" -ExpectedStatus @(200)

# Authenticated user endpoints
if ($UserToken) {
  $userHeaders = @{ Authorization = "Bearer $UserToken" }
  $results += Test-Endpoint -Name "Profile me (user token)" -Method "GET" -Url "$base/api/profile/me" -Headers $userHeaders -ExpectedStatus @(200)
  $results += Test-Endpoint -Name "Checkout link premium (user token)" -Method "GET" -Url "$base/api/billing/checkout-link?plan=premium" -Headers $userHeaders -ExpectedStatus @(200, 409, 422)
} else {
  $results += [PSCustomObject]@{
    Name   = "Profile me (user token)"
    Method = "GET"
    Url    = "$base/api/profile/me"
    Ok     = $false
    Detail = "skipped (missing -UserToken)"
  }
  $results += [PSCustomObject]@{
    Name   = "Checkout link premium (user token)"
    Method = "GET"
    Url    = "$base/api/billing/checkout-link?plan=premium"
    Ok     = $false
    Detail = "skipped (missing -UserToken)"
  }
}

# Admin endpoints
if ($AdminToken) {
  $adminHeaders = @{ Authorization = "Bearer $AdminToken" }
  $results += Test-Endpoint -Name "Admin users list (admin token)" -Method "GET" -Url "$base/api/admin/users" -Headers $adminHeaders -ExpectedStatus @(200)
} else {
  $results += [PSCustomObject]@{
    Name   = "Admin users list (admin token)"
    Method = "GET"
    Url    = "$base/api/admin/users"
    Ok     = $false
    Detail = "skipped (missing -AdminToken)"
  }
}

$results | Format-Table -AutoSize

$failed = $results | Where-Object { -not $_.Ok -and -not $_.Detail.StartsWith("skipped") }
if ($failed.Count -gt 0) {
  Write-Host ""
  Write-Host "Health check failed on $($failed.Count) endpoint(s)." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "Health check finished successfully." -ForegroundColor Green
exit 0

