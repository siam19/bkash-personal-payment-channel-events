/**
 * SMS Parser Tests
 * Manual test file to verify SMS parsing logic
 */

import { parseBkashSMS, normalizeTrxID } from './smsParser'

// Sample SMS messages from architecture document
const TEST_MESSAGES = [
  {
    name: 'Standard SMS 1',
    sms: 'You have received Tk 500.00 from 01533817247. Fee Tk 0.00. Balance Tk 1,117.78. TrxID CJU0PZQ3U6 at 30/10/2025 21:02',
    expected: {
      amount_cents: 50000,
      trxid: 'CJU0PZQ3U6',
      sender_phone: '01533817247',
      received_at: '2025-10-30T21:02:00.000Z'
    }
  },
  {
    name: 'SMS with comma in amount',
    sms: 'You have received Tk 2,000.00 from 01785662731. Fee Tk 0.00. Balance Tk 3,117.78. TrxID CJU5Q1I0TB at 30/10/2025 21:47',
    expected: {
      amount_cents: 200000,
      trxid: 'CJU5Q1I0TB',
      sender_phone: '01785662731',
      received_at: '2025-10-30T21:47:00.000Z'
    }
  },
  {
    name: 'Lowercase TrxID',
    sms: 'You have received Tk 100.50 from 01712345678. Fee Tk 0.00. Balance Tk 500.00. TrxID abc123xyz at 01/11/2025 10:30',
    expected: {
      amount_cents: 10050,
      trxid: 'ABC123XYZ', // Should be normalized to uppercase
      sender_phone: '01712345678',
      received_at: '2025-11-01T10:30:00.000Z'
    }
  }
]

// Test invalid messages
const INVALID_MESSAGES = [
  {
    name: 'Missing amount',
    sms: 'You have received from 01533817247. TrxID ABC123 at 30/10/2025 21:02',
    expectedError: 'amount'
  },
  {
    name: 'Missing TrxID',
    sms: 'You have received Tk 500.00 from 01533817247. Fee Tk 0.00. at 30/10/2025 21:02',
    expectedError: 'trxid'
  },
  {
    name: 'Missing sender phone',
    sms: 'You have received Tk 500.00. TrxID ABC123 at 30/10/2025 21:02',
    expectedError: 'sender_phone'
  },
  {
    name: 'Missing timestamp',
    sms: 'You have received Tk 500.00 from 01533817247. TrxID ABC123',
    expectedError: 'timestamp'
  },
  {
    name: 'Empty SMS',
    sms: '',
    expectedError: 'raw_sms'
  }
]

console.log('=== SMS Parser Tests ===\n')

// Test valid messages
console.log('Testing VALID messages:\n')
TEST_MESSAGES.forEach((test, index) => {
  console.log(`Test ${index + 1}: ${test.name}`)
  const result = parseBkashSMS(test.sms)
  
  if (result.success && result.data) {
    const passed = 
      result.data.amount_cents === test.expected.amount_cents &&
      result.data.trxid === test.expected.trxid &&
      result.data.sender_phone === test.expected.sender_phone &&
      result.data.received_at === test.expected.received_at
    
    console.log(`  Status: ${passed ? '✓ PASSED' : '✗ FAILED'}`)
    console.log(`  Amount: ${result.data.amount_cents} (expected: ${test.expected.amount_cents})`)
    console.log(`  TrxID: ${result.data.trxid} (expected: ${test.expected.trxid})`)
    console.log(`  Sender: ${result.data.sender_phone} (expected: ${test.expected.sender_phone})`)
    console.log(`  Timestamp: ${result.data.received_at} (expected: ${test.expected.received_at})`)
  } else {
    console.log(`  Status: ✗ FAILED - Parse error`)
    console.log(`  Error: ${result.error?.message}`)
  }
  console.log()
})

// Test invalid messages
console.log('\nTesting INVALID messages:\n')
INVALID_MESSAGES.forEach((test, index) => {
  console.log(`Test ${index + 1}: ${test.name}`)
  const result = parseBkashSMS(test.sms)
  
  const passed = !result.success && result.error?.field === test.expectedError
  
  console.log(`  Status: ${passed ? '✓ PASSED' : '✗ FAILED'}`)
  console.log(`  Expected error field: ${test.expectedError}`)
  console.log(`  Actual error field: ${result.error?.field}`)
  console.log(`  Error message: ${result.error?.message}`)
  console.log()
})

// Test TrxID normalization
console.log('\nTesting TrxID normalization:\n')
const trxidTests = [
  { input: 'abc123', expected: 'ABC123' },
  { input: '  ABC123  ', expected: 'ABC123' },
  { input: 'CJU0PZQ3U6', expected: 'CJU0PZQ3U6' }
]

trxidTests.forEach((test, index) => {
  const normalized = normalizeTrxID(test.input)
  const passed = normalized === test.expected
  console.log(`Test ${index + 1}: "${test.input}" -> "${normalized}" (expected: "${test.expected}") ${passed ? '✓' : '✗'}`)
})

console.log('\n=== Tests Complete ===')
