/**
 * SMS Parser Service
 * 
 * Parses bKash payment receipt SMS messages and extracts:
 * - Amount (converted to cents)
 * - Transaction ID (TrxID)
 * - Sender phone number
 * - Timestamp (converted to ISO 8601)
 * 
 * Example SMS format:
 * "You have received Tk 500.00 from 01533817247. Fee Tk 0.00. Balance Tk 1,117.78. TrxID CJU0PZQ3U6 at 30/10/2025 21:02"
 */

export interface ParsedSMS {
  amount_cents: number
  trxid: string
  sender_phone: string
  received_at: string // ISO 8601 timestamp
}

export interface ParseError {
  field: string
  message: string
  raw_value?: string
}

export interface ParseResult {
  success: boolean
  data?: ParsedSMS
  error?: ParseError
}

// Regex patterns for extracting data from bKash SMS
const SMS_PATTERNS = {
  // Matches "Tk 500.00" or "Tk 2,000.00" (with optional commas)
  amount: /Tk\s+([\d,]+\.\d{2})/,
  
  // Matches 11-digit phone number after "from"
  sender: /from\s+(\d{11})/,
  
  // Matches alphanumeric TrxID
  trxid: /TrxID\s+([A-Z0-9]+)/i,
  
  // Matches timestamp format: "30/10/2025 21:02"
  timestamp: /at\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/
}

/**
 * Parse amount from SMS and convert to cents
 * Example: "500.00" -> 50000, "2,000.00" -> 200000
 */
function parseAmount(sms: string): { value: number | null; error?: string } {
  const match = sms.match(SMS_PATTERNS.amount)
  
  if (!match) {
    return { value: null, error: 'Amount not found in SMS' }
  }
  
  const amountStr = match[1]
  // Remove commas and parse as float
  const amountFloat = parseFloat(amountStr.replace(/,/g, ''))
  
  if (isNaN(amountFloat)) {
    return { value: null, error: `Invalid amount format: ${amountStr}` }
  }
  
  if (amountFloat <= 0) {
    return { value: null, error: 'Amount must be greater than 0' }
  }
  
  // Convert to cents (multiply by 100 and round to avoid floating point issues)
  const amountCents = Math.round(amountFloat * 100)
  
  return { value: amountCents }
}

/**
 * Parse sender phone number from SMS
 */
function parseSenderPhone(sms: string): { value: string | null; error?: string } {
  const match = sms.match(SMS_PATTERNS.sender)
  
  if (!match) {
    return { value: null, error: 'Sender phone number not found in SMS' }
  }
  
  const phone = match[1]
  
  // Validate it's exactly 11 digits
  if (phone.length !== 11) {
    return { value: null, error: `Invalid phone number length: ${phone}` }
  }
  
  return { value: phone }
}

/**
 * Parse and normalize TrxID from SMS
 * Normalizes by trimming whitespace and converting to uppercase
 */
function parseTrxID(sms: string): { value: string | null; error?: string } {
  const match = sms.match(SMS_PATTERNS.trxid)
  
  if (!match) {
    return { value: null, error: 'TrxID not found in SMS' }
  }
  
  const trxid = match[1].trim().toUpperCase()
  
  if (trxid.length === 0) {
    return { value: null, error: 'TrxID is empty' }
  }
  
  return { value: trxid }
}

/**
 * Parse timestamp from SMS and convert to ISO 8601
 * Input format: "30/10/2025 21:02" (DD/MM/YYYY HH:mm)
 * Output format: "2025-10-30T21:02:00Z"
 */
function parseTimestamp(sms: string): { value: string | null; error?: string } {
  const match = sms.match(SMS_PATTERNS.timestamp)
  
  if (!match) {
    return { value: null, error: 'Timestamp not found in SMS' }
  }
  
  const timestampStr = match[1]
  
  // Parse DD/MM/YYYY HH:mm format
  const parts = timestampStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/)
  
  if (!parts) {
    return { value: null, error: `Invalid timestamp format: ${timestampStr}` }
  }
  
  const [, day, month, year, hour, minute] = parts
  
  // Construct ISO 8601 date
  // Note: Month is 0-indexed in JS Date, so subtract 1
  const date = new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    0 // seconds
  )
  
  // Validate the date is valid
  if (isNaN(date.getTime())) {
    return { value: null, error: `Invalid date: ${timestampStr}` }
  }
  
  // Convert to ISO 8601 string
  return { value: date.toISOString() }
}

/**
 * Main SMS parsing function
 * Parses a raw bKash SMS and extracts all payment information
 */
export function parseBkashSMS(rawSMS: string): ParseResult {
  // Normalize input: trim whitespace
  const sms = rawSMS.trim()
  
  if (!sms) {
    return {
      success: false,
      error: {
        field: 'raw_sms',
        message: 'SMS text is empty'
      }
    }
  }
  
  // Parse amount
  const amountResult = parseAmount(sms)
  if (amountResult.value === null) {
    return {
      success: false,
      error: {
        field: 'amount',
        message: amountResult.error!,
        raw_value: sms
      }
    }
  }
  
  // Parse sender phone
  const senderResult = parseSenderPhone(sms)
  if (senderResult.value === null) {
    return {
      success: false,
      error: {
        field: 'sender_phone',
        message: senderResult.error!,
        raw_value: sms
      }
    }
  }
  
  // Parse TrxID
  const trxidResult = parseTrxID(sms)
  if (trxidResult.value === null) {
    return {
      success: false,
      error: {
        field: 'trxid',
        message: trxidResult.error!,
        raw_value: sms
      }
    }
  }
  
  // Parse timestamp
  const timestampResult = parseTimestamp(sms)
  if (timestampResult.value === null) {
    return {
      success: false,
      error: {
        field: 'timestamp',
        message: timestampResult.error!,
        raw_value: sms
      }
    }
  }
  
  // All fields parsed successfully
  return {
    success: true,
    data: {
      amount_cents: amountResult.value,
      trxid: trxidResult.value,
      sender_phone: senderResult.value,
      received_at: timestampResult.value
    }
  }
}

/**
 * Normalize a TrxID (for comparison purposes)
 * Trims whitespace and converts to uppercase
 */
export function normalizeTrxID(trxid: string): string {
  return trxid.trim().toUpperCase()
}
