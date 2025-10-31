# Integration Tests for bKash Personal Payment Channel
# Run with: .\tests\integration.test.ps1
# Prerequisites: Worker must be running (npm run dev)

$baseUrl = "http://localhost:8787"
$testsPassed = 0
$testsFailed = 0

function Write-TestHeader {
    param([string]$message)
    Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║  $message" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan
}

function Write-TestResult {
    param(
        [string]$testName,
        [bool]$passed,
        [string]$expected,
        [string]$actual
    )
    
    if ($passed) {
        Write-Host "  ✓ $testName" -ForegroundColor Green
        Write-Host "    Expected: $expected" -ForegroundColor Gray
        Write-Host "    Got: $actual" -ForegroundColor Gray
        $script:testsPassed++
    } else {
        Write-Host "  ✗ $testName" -ForegroundColor Red
        Write-Host "    Expected: $expected" -ForegroundColor Gray
        Write-Host "    Got: $actual" -ForegroundColor Red
        $script:testsFailed++
    }
}

# Test 1: Health Check
Write-TestHeader "TEST 1: Health Check"
try {
    $health = Invoke-WebRequest -Uri "$baseUrl/health" -Method GET | ConvertFrom-Json
    $passed = $health.status -eq "healthy" -and $health.database -eq "connected"
    Write-TestResult "Health endpoint responds" $passed "status=healthy, database=connected" "status=$($health.status), database=$($health.database)"
} catch {
    Write-TestResult "Health endpoint responds" $false "200 OK" "Error: $_"
}

# Test 2: Complete Happy Path
Write-TestHeader "TEST 2: Complete Happy Path (E2E)"
try {
    # Step 1: Create tracking session
    $trackBody = @{
        item_code = "TEST_HAPPY_PATH"
        payment_amount_cents = 100000
        customer_info = @{
            name = "Happy Path Tester"
            phone = "01999888777"
            email = "happy@test.com"
        }
        ticket_choice = "Happy Path Ticket"
    } | ConvertTo-Json
    
    $trackResult = Invoke-WebRequest -Uri "$baseUrl/track" -Method POST -ContentType "application/json" -Body $trackBody | ConvertFrom-Json
    $trackingId = $trackResult.tracking_id
    
    $passed1 = $trackingId -match '^01[A-Z0-9]{24}$'
    Write-TestResult "Create tracking session" $passed1 "Valid ULID" "Got: $trackingId"
    
    # Step 2: Submit TrxID
    Start-Sleep -Milliseconds 500
    $submitBody = @{ trxid = "HAPPYTEST123" } | ConvertTo-Json
    $submitResult = Invoke-WebRequest -Uri "$baseUrl/bkash-personal/$trackingId/submit-trx" -Method POST -ContentType "application/json" -Body $submitBody | ConvertFrom-Json
    
    $passed2 = $submitResult.status -eq "submitted"
    Write-TestResult "Submit TrxID" $passed2 "status=submitted" "status=$($submitResult.status)"
    
    # Step 3: Send SMS webhook
    Start-Sleep -Milliseconds 500
    $currentDate = Get-Date -Format "dd/MM/yyyy HH:mm"
    $smsBody = @{
        raw_sms = "You have received Tk 1,000.00 from 01555666777. Fee Tk 0.00. Balance Tk 5,000.00. TrxID HAPPYTEST123 at $currentDate"
        receiver_phone = "01785863769"
    } | ConvertTo-Json
    
    $webhookResult = Invoke-WebRequest -Uri "$baseUrl/webhooks/sms" -Method POST -ContentType "application/json" -Body $smsBody | ConvertFrom-Json
    
    $passed3 = $webhookResult.verification.verified -eq 1
    Write-TestResult "SMS verification & fulfillment" $passed3 "verified=1" "verified=$($webhookResult.verification.verified)"
    
} catch {
    Write-TestResult "Complete Happy Path" $false "Success" "Error: $_"
}

# Test 3: Amount Mismatch Failure
Write-TestHeader "TEST 3: Amount Mismatch Failure"
try {
    $trackBody = @{
        item_code = "TEST_AMT_MISMATCH"
        payment_amount_cents = 50000
        customer_info = @{ name = "Amount Test"; phone = "01111111111"; email = "amt@test.com" }
        ticket_choice = "Amount Mismatch Test"
    } | ConvertTo-Json
    
    $trackResult = Invoke-WebRequest -Uri "$baseUrl/track" -Method POST -ContentType "application/json" -Body $trackBody | ConvertFrom-Json
    $trackingId = $trackResult.tracking_id
    
    Start-Sleep -Milliseconds 500
    Invoke-WebRequest -Uri "$baseUrl/bkash-personal/$trackingId/submit-trx" -Method POST -ContentType "application/json" -Body (@{ trxid = "AMTFAIL001" } | ConvertTo-Json) | Out-Null
    
    Start-Sleep -Milliseconds 500
    $currentDate = Get-Date -Format "dd/MM/yyyy HH:mm"
    $smsBody = @{
        raw_sms = "You have received Tk 600.00 from 01222222222. Fee Tk 0.00. Balance Tk 1,000.00. TrxID AMTFAIL001 at $currentDate"
        receiver_phone = "01785863769"
    } | ConvertTo-Json
    
    $webhookResult = Invoke-WebRequest -Uri "$baseUrl/webhooks/sms" -Method POST -ContentType "application/json" -Body $smsBody | ConvertFrom-Json
    
    $passed = $webhookResult.verification.verified -eq 0
    Write-TestResult "Amount mismatch rejected" $passed "verified=0" "verified=$($webhookResult.verification.verified)"
    
} catch {
    Write-TestResult "Amount mismatch test" $false "Success" "Error: $_"
}

# Test 4: Duplicate TrxID Prevention
Write-TestHeader "TEST 4: Duplicate TrxID Prevention"
try {
    # First session
    $trackBody1 = @{
        item_code = "TEST_DUP_1"
        payment_amount_cents = 20000
        customer_info = @{ name = "Dup Test 1"; phone = "01333333333"; email = "dup1@test.com" }
        ticket_choice = "Duplicate Test 1"
    } | ConvertTo-Json
    
    $track1 = Invoke-WebRequest -Uri "$baseUrl/track" -Method POST -ContentType "application/json" -Body $trackBody1 | ConvertFrom-Json
    
    Start-Sleep -Milliseconds 500
    Invoke-WebRequest -Uri "$baseUrl/bkash-personal/$($track1.tracking_id)/submit-trx" -Method POST -ContentType "application/json" -Body (@{ trxid = "DUPTEST999" } | ConvertTo-Json) | Out-Null
    
    Start-Sleep -Milliseconds 500
    $currentDate = Get-Date -Format "dd/MM/yyyy HH:mm"
    $smsBody = @{
        raw_sms = "You have received Tk 200.00 from 01444444444. Fee Tk 0.00. Balance Tk 1,500.00. TrxID DUPTEST999 at $currentDate"
        receiver_phone = "01785863769"
    } | ConvertTo-Json
    
    $webhook1 = Invoke-WebRequest -Uri "$baseUrl/webhooks/sms" -Method POST -ContentType "application/json" -Body $smsBody | ConvertFrom-Json
    
    $passed1 = $webhook1.verification.verified -eq 1
    Write-TestResult "First session verified" $passed1 "verified=1" "verified=$($webhook1.verification.verified)"
    
    # Second session with same TrxID - should fail
    Start-Sleep -Milliseconds 500
    $trackBody2 = @{
        item_code = "TEST_DUP_2"
        payment_amount_cents = 20000
        customer_info = @{ name = "Dup Test 2"; phone = "01555555555"; email = "dup2@test.com" }
        ticket_choice = "Duplicate Test 2"
    } | ConvertTo-Json
    
    $track2 = Invoke-WebRequest -Uri "$baseUrl/track" -Method POST -ContentType "application/json" -Body $trackBody2 | ConvertFrom-Json
    
    Start-Sleep -Milliseconds 500
    Invoke-WebRequest -Uri "$baseUrl/bkash-personal/$($track2.tracking_id)/submit-trx" -Method POST -ContentType "application/json" -Body (@{ trxid = "DUPTEST999" } | ConvertTo-Json) | Out-Null
    
    # Webhook returns same transaction but doesn't verify second session
    Start-Sleep -Milliseconds 500
    $webhook2 = Invoke-WebRequest -Uri "$baseUrl/webhooks/sms" -Method POST -ContentType "application/json" -Body $smsBody | ConvertFrom-Json
    
    $passed2 = $webhook2.is_new -eq $false -and $webhook2.verification.verified -eq 0
    Write-TestResult "Second session rejected (duplicate)" $passed2 "is_new=false, verified=0" "is_new=$($webhook2.is_new), verified=$($webhook2.verification.verified)"
    
} catch {
    Write-TestResult "Duplicate TrxID test" $false "Success" "Error: $_"
}

# Test 5: Webhook Idempotency
Write-TestHeader "TEST 5: Webhook Idempotency"
try {
    $currentDate = Get-Date -Format "dd/MM/yyyy HH:mm"
    $smsBody = @{
        raw_sms = "You have received Tk 300.00 from 01666777888. Fee Tk 0.00. Balance Tk 2,000.00. TrxID IDEMPOTENT123 at $currentDate"
        receiver_phone = "01785863769"
    } | ConvertTo-Json
    
    $result1 = Invoke-WebRequest -Uri "$baseUrl/webhooks/sms" -Method POST -ContentType "application/json" -Body $smsBody | ConvertFrom-Json
    
    Start-Sleep -Milliseconds 500
    $result2 = Invoke-WebRequest -Uri "$baseUrl/webhooks/sms" -Method POST -ContentType "application/json" -Body $smsBody | ConvertFrom-Json
    
    $passed = $result1.is_new -eq $true -and $result2.is_new -eq $false -and $result1.transaction.id -eq $result2.transaction.id
    Write-TestResult "Webhook idempotency" $passed "First=new, Second=duplicate, Same ID" "First=$($result1.is_new), Second=$($result2.is_new), Same=$($result1.transaction.id -eq $result2.transaction.id)"
    
} catch {
    Write-TestResult "Webhook idempotency test" $false "Success" "Error: $_"
}

# Test 6: SMS Parser Validation
Write-TestHeader "TEST 6: SMS Parser Validation"
try {
    $invalidSMS = @{
        raw_sms = "Invalid SMS format without required fields"
        receiver_phone = "01785863769"
    } | ConvertTo-Json
    
    try {
        $result = Invoke-WebRequest -Uri "$baseUrl/webhooks/sms" -Method POST -ContentType "application/json" -Body $invalidSMS -ErrorAction Stop | ConvertFrom-Json
        $passed = $false
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $passed = $statusCode -eq 400
    }
    
    Write-TestResult "Invalid SMS rejected" $passed "400 Bad Request" "Got: $statusCode"
    
} catch {
    Write-TestResult "SMS parser validation" $false "Success" "Error: $_"
}

# Test 7: Invalid Receiver
Write-TestHeader "TEST 7: Invalid Receiver Validation"
try {
    $currentDate = Get-Date -Format "dd/MM/yyyy HH:mm"
    $invalidReceiverSMS = @{
        raw_sms = "You have received Tk 100.00 from 01777888999. Fee Tk 0.00. Balance Tk 1,000.00. TrxID INVALIDRCV at $currentDate"
        receiver_phone = "01999999999"
    } | ConvertTo-Json
    
    try {
        $result = Invoke-WebRequest -Uri "$baseUrl/webhooks/sms" -Method POST -ContentType "application/json" -Body $invalidReceiverSMS -ErrorAction Stop | ConvertFrom-Json
        $passed = $false
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $passed = $statusCode -eq 400
    }
    
    Write-TestResult "Invalid receiver rejected" $passed "400 Bad Request" "Got: $statusCode"
    
} catch {
    Write-TestResult "Invalid receiver test" $false "Success" "Error: $_"
}

# Summary
Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor $(if($testsFailed -eq 0){'Green'}else{'Yellow'})
Write-Host "║  TEST SUMMARY                                              ║" -ForegroundColor $(if($testsFailed -eq 0){'Green'}else{'Yellow'})
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $(if($testsFailed -eq 0){'Green'}else{'Yellow'})
Write-Host "  Total Tests: $($testsPassed + $testsFailed)" -ForegroundColor White
Write-Host "  Passed: $testsPassed" -ForegroundColor Green
Write-Host "  Failed: $testsFailed" -ForegroundColor $(if($testsFailed -eq 0){'Green'}else{'Red'})
Write-Host ""

if ($testsFailed -eq 0) {
    Write-Host "  ✅ ALL TESTS PASSED!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "  ❌ SOME TESTS FAILED" -ForegroundColor Red
    exit 1
}
