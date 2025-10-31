/**
 * Payment Page HTML Template
 * 
 * This file contains the HTML template for the payment page
 * Can be modified independently for styling and UX improvements
 */

interface PaymentPageData {
  tracking_id: string
  receivers: string[]
  amount_taka: string
  expires_at: string
  expires_in_minutes: number
}

export function renderPaymentPage(data: PaymentPageData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>bKash Payment - ${data.tracking_id}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 500px;
      width: 100%;
      padding: 32px;
    }
    
    .header {
      text-align: center;
      margin-bottom: 32px;
    }
    
    .header h1 {
      color: #1a202c;
      font-size: 24px;
      margin-bottom: 8px;
    }
    
    .header .tracking-id {
      color: #718096;
      font-size: 14px;
      font-family: 'Courier New', monospace;
    }
    
    .alert {
      background: #fed7d7;
      border: 1px solid #fc8181;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      color: #742a2a;
    }
    
    .alert strong {
      display: block;
      margin-bottom: 4px;
    }
    
    .info-box {
      background: #f7fafc;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 24px;
    }
    
    .info-box h2 {
      color: #2d3748;
      font-size: 16px;
      margin-bottom: 16px;
    }
    
    .receivers {
      list-style: none;
    }
    
    .receivers li {
      background: white;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 8px;
      font-weight: 600;
      color: #2d3748;
      font-size: 18px;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .copy-btn {
      background: #667eea;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 8px 12px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .copy-btn:hover {
      background: #5a67d8;
      transform: scale(1.05);
    }
    
    .copy-btn:active {
      transform: scale(0.95);
    }
    
    .copy-btn.copied {
      background: #48bb78;
    }
    
    .amount {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin-bottom: 24px;
    }
    
    .amount label {
      display: block;
      font-size: 14px;
      opacity: 0.9;
      margin-bottom: 8px;
    }
    
    .amount .value {
      font-size: 36px;
      font-weight: bold;
    }
    
    .form-group {
      margin-bottom: 20px;
    }
    
    .form-group label {
      display: block;
      color: #2d3748;
      font-weight: 600;
      margin-bottom: 8px;
      font-size: 14px;
    }
    
    .form-group input {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      font-size: 16px;
      transition: border-color 0.2s;
    }
    
    .form-group input:focus {
      outline: none;
      border-color: #667eea;
    }
    
    .form-group .hint {
      color: #718096;
      font-size: 12px;
      margin-top: 4px;
    }
    
    .submit-btn {
      width: 100%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      padding: 16px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s;
    }
    
    .submit-btn:hover {
      transform: translateY(-2px);
    }
    
    .submit-btn:active {
      transform: translateY(0);
    }
    
    .submit-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .instructions {
      background: #edf2f7;
      border-radius: 8px;
      padding: 16px;
      margin-top: 24px;
    }
    
    .instructions h3 {
      color: #2d3748;
      font-size: 14px;
      margin-bottom: 12px;
    }
    
    .instructions ol {
      padding-left: 20px;
      color: #4a5568;
      font-size: 14px;
      line-height: 1.6;
    }
    
    .instructions li {
      margin-bottom: 8px;
    }
    
    @media (max-width: 640px) {
      .container {
        padding: 24px;
      }
      
      .amount .value {
        font-size: 28px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Complete Your Payment</h1>
      <p class="tracking-id">Session: ${data.tracking_id}</p>
    </div>
    
    <div class="alert">
      <strong>⏰ Link Expires Soon!</strong>
      This payment link will expire in approximately ${data.expires_in_minutes} minutes.
    </div>
    
    <div class="info-box">
      <h2>📱 Send Money to Any of These Numbers:</h2>
      <ul class="receivers">
        ${data.receivers.map((phone, index) => `
          <li>
            <span>${phone}</span>
            <button type="button" class="copy-btn" onclick="copyToClipboard('${phone}', ${index})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span id="copy-text-${index}">Copy</span>
            </button>
          </li>
        `).join('')}
      </ul>
    </div>
    
    <div class="amount">
      <label>Exact Amount to Send</label>
      <div class="value">৳ ${data.amount_taka}</div>
    </div>
    
    <form id="trxForm" method="POST" action="/bkash-personal/${data.tracking_id}/submit-trx">
      <div class="form-group">
        <label for="trxid">Transaction ID (TrxID)</label>
        <input 
          type="text" 
          id="trxid" 
          name="trxid" 
          required 
          placeholder="e.g., CJU0PZQ3U6"
          pattern="[A-Z0-9]+"
          style="text-transform: uppercase;"
        >
        <p class="hint">Enter the TrxID shown in your bKash app after sending money</p>
      </div>
      
      <button type="submit" class="submit-btn" id="submitBtn">
        Submit Transaction ID
      </button>
    </form>
    
    <div class="instructions">
      <h3>📋 Instructions:</h3>
      <ol>
        <li>Open your bKash mobile app</li>
        <li>Send <strong>exactly ৳ ${data.amount_taka}</strong> to one of the numbers above</li>
        <li>After sending, bKash will show you a Transaction ID (TrxID)</li>
        <li>Copy the TrxID and paste it in the form above</li>
        <li>Click "Submit" - we'll verify your payment and email your ticket</li>
      </ol>
    </div>
  </div>
  
  <script>
    // Copy to clipboard function
    function copyToClipboard(text, index) {
      navigator.clipboard.writeText(text).then(() => {
        const btn = event.target.closest('.copy-btn');
        const textSpan = document.getElementById('copy-text-' + index);
        
        // Change button appearance
        btn.classList.add('copied');
        textSpan.textContent = 'Copied!';
        
        // Reset after 2 seconds
        setTimeout(() => {
          btn.classList.remove('copied');
          textSpan.textContent = 'Copy';
        }, 2000);
      }).catch(err => {
        alert('Failed to copy: ' + err);
      });
    }
    
    const form = document.getElementById('trxForm');
    const submitBtn = document.getElementById('submitBtn');
    const trxidInput = document.getElementById('trxid');
    
    // Auto-uppercase TrxID input
    trxidInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase();
    });
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const trxid = trxidInput.value.trim();
      
      if (!trxid) {
        alert('Please enter your Transaction ID');
        return;
      }
      
      // Disable button to prevent double submission
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
      
      try {
        const response = await fetch(form.action, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ trxid })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          // Success - show thank you message
          document.body.innerHTML = \`
            <div class="container" style="text-align: center; padding: 48px 32px;">
              <div style="font-size: 64px; margin-bottom: 16px;">✅</div>
              <h1 style="color: #2d3748; margin-bottom: 16px;">Thank You!</h1>
              <p style="color: #4a5568; font-size: 18px; line-height: 1.6; margin-bottom: 24px;">
                \${data.message || 'Your transaction ID has been submitted. Please check your email for your ticket.'}
              </p>
              <p style="color: #718096; font-size: 14px;">
                You can close this window now.
              </p>
            </div>
          \`;
        } else {
          // Error from server
          alert(data.error || 'An error occurred. Please try again.');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Transaction ID';
        }
      } catch (error) {
        alert('Network error. Please check your connection and try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Transaction ID';
      }
    });
    
    // Calculate and update countdown timer (optional enhancement for later)
    const expiresAt = new Date('${data.expires_at}');
    // You can add countdown logic here if desired
  </script>
</body>
</html>`
}

export function renderErrorPage(message: string, statusCode: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error - bKash Payment</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 500px;
      width: 100%;
      padding: 48px 32px;
      text-align: center;
    }
    
    .error-icon {
      font-size: 64px;
      margin-bottom: 24px;
    }
    
    h1 {
      color: #2d3748;
      font-size: 24px;
      margin-bottom: 16px;
    }
    
    p {
      color: #4a5568;
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 32px;
    }
    
    .code {
      color: #718096;
      font-size: 14px;
      font-family: 'Courier New', monospace;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-icon">${statusCode === 404 ? '🔍' : '⚠️'}</div>
    <h1>${statusCode === 404 ? 'Payment Link Not Found' : 'Payment Link Error'}</h1>
    <p>${message}</p>
    <p class="code">Error ${statusCode}</p>
  </div>
</body>
</html>`
}
