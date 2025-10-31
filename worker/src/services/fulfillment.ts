import { ulid } from 'ulid'
import { CustomerInfo } from '../types/database'

interface FulfillmentData {
  tracking_id: string
  transaction_id: string
  customer_info: CustomerInfo
  payment_amount_cents: number
  item_code: string
  ticket_choice: string
}

interface FulfillmentResult {
  success: boolean
  fulfillment_token?: string
  ticket_url?: string
  error?: string
}

/**
 * Generate fulfillment for verified payment
 * For MVP: Logs email content to console
 * For Production: Replace with actual email provider (SendGrid, Mailgun, etc.)
 */
export async function triggerFulfillment(data: FulfillmentData): Promise<FulfillmentResult> {
  try {
    // Generate unique fulfillment token
    const fulfillment_token = ulid()
    
    // Construct ticket generation URL
    // In production, this would be your actual ticket generation service
    const ticket_url = `https://tickets.example.com/generate/${fulfillment_token}`
    
    // Extract customer email
    const customer_email = data.customer_info.email
    const customer_name = data.customer_info.name || 'Valued Customer'
    
    // Format amount for display
    const amount_taka = (data.payment_amount_cents / 100).toFixed(2)
    
    // Email subject
    const subject = `🎫 Your Ticket for ${data.item_code} - Payment Confirmed`
    
    // Email body (plain text for MVP)
    const email_body = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 PAYMENT CONFIRMED - YOUR TICKET IS READY! 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Hi ${customer_name},

Great news! Your payment has been verified and your ticket is ready.

PAYMENT DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Item: ${data.ticket_choice}
• Amount Paid: ৳ ${amount_taka}
• Transaction ID: ${data.transaction_id}
• Tracking ID: ${data.tracking_id}

GET YOUR TICKET:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Click the link below to generate and download your ticket:

🎫 ${ticket_url}

This link is unique to you and will expire in 7 days.

IMPORTANT NOTES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Save this email for your records
• Present your ticket (digital or printed) at the venue
• Arrive early to avoid queues
• Check venue guidelines before the event

Need help? Reply to this email or contact support.

See you at the event! 🎊

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is an automated message. Please do not reply.
    `.trim()
    
    // For MVP: Log email content to console
    console.log('\n' + '='.repeat(60))
    console.log('📧 [FULFILLMENT] EMAIL WOULD BE SENT')
    console.log('='.repeat(60))
    console.log(`To: ${customer_email}`)
    console.log(`Subject: ${subject}`)
    console.log('─'.repeat(60))
    console.log(email_body)
    console.log('='.repeat(60) + '\n')
    
    // In production, replace the console.log above with actual email sending:
    /*
    await sendEmail({
      to: customer_email,
      subject: subject,
      text: email_body,
      html: generateHTMLTemplate(data, ticket_url)
    })
    */
    
    return {
      success: true,
      fulfillment_token,
      ticket_url
    }
    
  } catch (error) {
    console.error('[Fulfillment] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Generate HTML email template
 * For future use with real email provider
 */
function generateHTMLTemplate(data: FulfillmentData, ticket_url: string): string {
  const customer_name = data.customer_info.name || 'Valued Customer'
  const amount_taka = (data.payment_amount_cents / 100).toFixed(2)
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Ticket is Ready!</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">🎉 Payment Confirmed!</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">Your ticket is ready to download</p>
  </div>
  
  <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="margin-top: 0;">Hi ${customer_name},</p>
    
    <p>Great news! Your payment has been verified and your ticket is ready.</p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h2 style="margin-top: 0; color: #667eea; font-size: 18px;">Payment Details</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Item:</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${data.ticket_choice}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Amount Paid:</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">৳ ${amount_taka}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;"><strong>Transaction ID:</strong></td>
          <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 12px;">${data.transaction_id}</td>
        </tr>
      </table>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${ticket_url}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px;">
        🎫 Get Your Ticket
      </a>
      <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">Link expires in 7 days</p>
    </div>
    
    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px;"><strong>⚠️ Important:</strong> Save this email for your records and present your ticket at the venue.</p>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      Need help? Contact our support team.<br>
      See you at the event! 🎊
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>This is an automated message. Please do not reply.</p>
  </div>
</body>
</html>
  `.trim()
}
