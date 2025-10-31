'bkash' is a very popular mobile payment solution in my area. It allows users to send and receive money, pay bills, and make purchases using their mobile phones. 
But one particular issue that bothers me is the immense waiting time and screening process for they're merchant account approval.

The difference between a personal account and a merchant account is that a personal account is used for individual transactions,
while a merchant account can receive payments from any website (kinda like PayPal business account). 

So I came up with a convoluted way to take payment (mostly for my underground music event tickets) in a reliable way. 


## The Customer Experience

The payment system is part of a larger ticketing website. Here's how it works from the customer's perspective:

1. **Browse and Select**
   - Customer enters the website and browses available tickets and tiers
   - They read the event rules and agree to the terms
   - They select the ticket they want to purchase

2. **Provide Contact Information**
   - Customer enters their contact details: name, phone number, and email
   - This info is collected before any payment happens so we can send them their ticket later

3. **Payment Page**
   - After submitting their info and ticket selection, they're redirected to a unique payment page
   - The page shows 1-3 bKash personal numbers where they need to send the money
   - It displays the exact amount to pay
   - There's a clear notice that the payment link expires in 1 hour
   - The page has an input field for the Transaction ID

4. **Make Payment**
   - Customer opens their bKash app and sends the exact amount to one of the displayed numbers
   - After sending, bKash shows them a Transaction ID (TrxID) 
   - They copy this TrxID and paste it back into the payment page
   - They hit 'Submit'

5. **Confirmation**
   - After submitting the TrxID, they see a thank-you message telling them to check their email
   - No need to wait on the page—verification happens in the background
   - Once verified, they receive an email with a link to generate and save their ticket QR code


## Behind the Scenes: Payment Verification

Since bKash doesn't have an API for payment verification (not even for merchant accounts), we rely on SMS receipts that bKash sends whenever you receive money. 

These SMS messages look like this:
```
You have received Tk 500.00 from 01533817247. Fee Tk 0.00. Balance Tk 1,117.78. TrxID CJU0PZQ3U6 at 30/10/2025 21:02
```

We have two ways to handle this:

1. **Automated (preferred)**: An Android phone with automation (like Tasker or MacroDroid) reads incoming bKash SMS and sends the raw text to our system automatically. The system then parses it to extract the transaction details.

2. **Manual backup**: If automation fails, we can manually copy-paste the SMS into a simple admin interface that sends it to our system for processing.

Either way, the system parses the SMS to extract:
- Transaction ID (TrxID)
- Amount received
- Sender's number
- Timestamp

The system then matches this against pending payments. If the TrxID matches what the customer entered, the amount is correct, and it was sent to one of our numbers within the 1-hour window, the payment is verified and the customer gets their confirmation email.


## Why This Works

- Customers get a familiar web checkout experience even though we're using personal bKash accounts
- The 1-hour expiry keeps things moving and prevents stale payment links
- Requiring the exact TrxID eliminates ambiguity when multiple people pay similar amounts
- Email confirmation with QR link means customers can access their tickets anytime
- The system is reliable enough for small-scale events while we wait for proper merchant approval 

