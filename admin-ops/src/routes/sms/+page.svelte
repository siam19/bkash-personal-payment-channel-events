<script lang="ts">
	import { enhance } from '$app/forms';
	import { PUBLIC_WORKER_URL } from '$env/static/public';
	
	let rawSms = $state('');
	let receiverPhone = $state('01785863769');
	let isSubmitting = $state(false);
	let result = $state<any>(null);
	let error = $state<string | null>(null);
	
	// Available receiver phones (you can fetch this from the worker API later)
	const receiverOptions = [
		{ value: '01785863769', label: 'Primary Phone (01785863769)' }
	];
	
	// Sample SMS for quick testing
	const sampleSMS = "You have received Tk 500.00 from 01533817247. Fee Tk 0.00. Balance Tk 1,117.78. TrxID CJU0PZQ3U6 at 30/10/2025 21:02";
	
	function loadSample() {
		rawSms = sampleSMS;
	}
	
	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		isSubmitting = true;
		error = null;
		result = null;
		
		try {
			const response = await fetch(`${PUBLIC_WORKER_URL}/webhooks/sms`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					raw_sms: rawSms,
					receiver_phone: receiverPhone
				})
			});
			
			const data = await response.json();
			
			if (!response.ok) {
				error = data.error || `Server error: ${response.status}`;
			} else {
				result = data;
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to submit SMS';
		} finally {
			isSubmitting = false;
		}
	}
	
	function clearForm() {
		rawSms = '';
		receiverPhone = '01785863769';
		result = null;
		error = null;
	}
</script>

<svelte:head>
	<title>SMS Paste - Admin Ops</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 py-8 px-4">
	<div class="max-w-4xl mx-auto">
		<!-- Header -->
		<div class="bg-white rounded-lg shadow-md p-6 mb-6">
			<h1 class="text-3xl font-bold text-gray-800 mb-2">📱 Manual SMS Entry</h1>
			<p class="text-gray-600">Paste bKash payment receipt SMS to process payments manually</p>
		</div>

		<!-- Main Form -->
		<div class="bg-white rounded-lg shadow-md p-6 mb-6">
			<form onsubmit={handleSubmit}>
				<!-- Receiver Phone Selection -->
				<div class="mb-6">
					<label for="receiver" class="block text-sm font-semibold text-gray-700 mb-2">
						Receiver Phone Number
					</label>
					<select
						id="receiver"
						bind:value={receiverPhone}
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
						required
					>
						{#each receiverOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
					<p class="mt-1 text-sm text-gray-500">Select which bKash account received the payment</p>
				</div>

				<!-- SMS Text Area -->
				<div class="mb-6">
					<label for="sms" class="block text-sm font-semibold text-gray-700 mb-2">
						SMS Content
					</label>
					<textarea
						id="sms"
						bind:value={rawSms}
						placeholder="Paste the complete bKash SMS here..."
						rows="6"
						class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
						required
					></textarea>
					<p class="mt-1 text-sm text-gray-500">
						Copy the entire SMS from your phone and paste it here
					</p>
				</div>

				<!-- Action Buttons -->
				<div class="flex gap-3">
					<button
						type="submit"
						disabled={isSubmitting || !rawSms.trim()}
						class="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
					>
						{isSubmitting ? '⏳ Processing...' : '📤 Submit SMS'}
					</button>
					
					<button
						type="button"
						onclick={loadSample}
						class="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
					>
						📋 Load Sample
					</button>
					
					<button
						type="button"
						onclick={clearForm}
						class="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
					>
						🗑️ Clear
					</button>
				</div>
			</form>
		</div>

		<!-- Success Result -->
		{#if result}
			<div class="bg-green-50 border-l-4 border-green-500 rounded-lg p-6 mb-6">
				<div class="flex items-start">
					<div class="flex-shrink-0">
						<span class="text-3xl">✅</span>
					</div>
					<div class="ml-4 flex-1">
						<h3 class="text-lg font-semibold text-green-800 mb-3">
							SMS Processed Successfully
						</h3>
						
						<!-- Transaction Details -->
						<div class="bg-white rounded-lg p-4 mb-4">
							<h4 class="font-semibold text-gray-700 mb-2">Transaction Details</h4>
							<dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
								<dt class="text-gray-600">Status:</dt>
								<dd class="font-mono">{result.is_new ? '🆕 New Transaction' : '♻️ Duplicate (Already Exists)'}</dd>
								
								<dt class="text-gray-600">TrxID:</dt>
								<dd class="font-mono font-bold text-purple-600">{result.transaction.trxid}</dd>
								
								<dt class="text-gray-600">Amount:</dt>
								<dd class="font-semibold">৳ {(result.transaction.amount_cents / 100).toFixed(2)}</dd>
								
								<dt class="text-gray-600">Sender:</dt>
								<dd class="font-mono">{result.transaction.sender_phone}</dd>
								
								<dt class="text-gray-600">Receiver:</dt>
								<dd class="font-mono">{result.transaction.receiver_phone}</dd>
								
								<dt class="text-gray-600">Transaction ID:</dt>
								<dd class="font-mono text-xs">{result.transaction.id}</dd>
							</dl>
						</div>

						<!-- Verification Results -->
						{#if result.verification}
							<div class="bg-white rounded-lg p-4">
								<h4 class="font-semibold text-gray-700 mb-2">Verification Results</h4>
								<div class="grid grid-cols-2 gap-4 text-sm">
									<div class="flex items-center gap-2">
										<span class="text-2xl">🔍</span>
										<div>
											<div class="text-gray-600">Attempted</div>
											<div class="font-bold text-lg">{result.verification.attempted}</div>
										</div>
									</div>
									<div class="flex items-center gap-2">
										<span class="text-2xl">{result.verification.verified > 0 ? '✅' : '⏳'}</span>
										<div>
											<div class="text-gray-600">Verified</div>
											<div class="font-bold text-lg {result.verification.verified > 0 ? 'text-green-600' : 'text-yellow-600'}">
												{result.verification.verified}
											</div>
										</div>
									</div>
								</div>
								
								{#if result.verification.verified === 0 && result.verification.attempted > 0}
									<p class="mt-3 text-sm text-yellow-700 bg-yellow-50 p-3 rounded">
										⚠️ Transaction stored but no matching tracking sessions verified. The payment may be verified later when a matching session is created or during the next cron sweep.
									</p>
								{:else if result.verification.verified > 0}
									<p class="mt-3 text-sm text-green-700 bg-green-50 p-3 rounded">
										🎉 Payment verified! Fulfillment process has been triggered.
									</p>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- Error Display -->
		{#if error}
			<div class="bg-red-50 border-l-4 border-red-500 rounded-lg p-6 mb-6">
				<div class="flex items-start">
					<div class="flex-shrink-0">
						<span class="text-3xl">❌</span>
					</div>
					<div class="ml-4">
						<h3 class="text-lg font-semibold text-red-800 mb-2">Error Processing SMS</h3>
						<p class="text-red-700">{error}</p>
						<p class="mt-2 text-sm text-red-600">
							Please check the SMS format and try again. Make sure the SMS contains all required fields: amount, TrxID, sender phone, and timestamp.
						</p>
					</div>
				</div>
			</div>
		{/if}

		<!-- Info Box -->
		<div class="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-6">
			<h3 class="font-semibold text-blue-800 mb-2">ℹ️ Expected SMS Format</h3>
			<p class="text-blue-700 text-sm mb-3">
				bKash payment receipt SMS should contain the following information:
			</p>
			<ul class="text-sm text-blue-700 space-y-1 ml-4">
				<li>• <strong>Amount:</strong> Tk XXX.XX</li>
				<li>• <strong>Sender Phone:</strong> 11-digit number</li>
				<li>• <strong>TrxID:</strong> Transaction ID</li>
				<li>• <strong>Timestamp:</strong> DD/MM/YYYY HH:MM format</li>
			</ul>
			<div class="mt-3 p-3 bg-white rounded border border-blue-200">
				<p class="text-xs text-gray-600 mb-1">Example:</p>
				<code class="text-xs text-gray-800 block">
					You have received Tk 500.00 from 01533817247. Fee Tk 0.00. Balance Tk 1,117.78. TrxID CJU0PZQ3U6 at 30/10/2025 21:02
				</code>
			</div>
		</div>

		<!-- Worker URL Info (Development Only) -->
		<div class="mt-6 text-center text-sm text-gray-500">
			Connected to: <code class="bg-gray-100 px-2 py-1 rounded">{PUBLIC_WORKER_URL}</code>
		</div>
	</div>
</div>

<style>
	/* Any additional custom styles if needed */
	:global(body) {
		margin: 0;
		padding: 0;
	}
</style>
