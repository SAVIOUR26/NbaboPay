package com.ngabopay.ussd.service

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.ngabopay.ussd.NgaboPayApp
import com.ngabopay.ussd.R
import com.ngabopay.ussd.api.ApiClient
import com.ngabopay.ussd.model.PayoutRequest
import com.ngabopay.ussd.model.PayoutResponse
import com.ngabopay.ussd.ui.MainActivity
import kotlinx.coroutines.*

class PayoutPollingService : Service() {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var pollingJob: Job? = null
    private var isProcessingPayout = false

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "PayoutPollingService created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "PayoutPollingService started")

        startForeground(NgaboPayApp.NOTIFICATION_ID, createNotification())
        startPolling()

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotification(): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, NgaboPayApp.NOTIFICATION_CHANNEL_ID)
            .setContentTitle(getString(R.string.notification_title))
            .setContentText(getString(R.string.notification_text))
            .setSmallIcon(R.drawable.ic_notification)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }

    private fun startPolling() {
        pollingJob?.cancel()
        pollingJob = scope.launch {
            while (isActive) {
                try {
                    checkForPendingPayouts()
                    sendHeartbeat()
                } catch (e: Exception) {
                    Log.e(TAG, "Polling error", e)
                }
                delay(POLLING_INTERVAL)
            }
        }
    }

    private suspend fun checkForPendingPayouts() {
        if (isProcessingPayout) return
        if (!USSDAccessibilityService.isRunning()) {
            Log.w(TAG, "USSD Accessibility Service not running")
            return
        }

        try {
            val response = ApiClient.getApi().getPendingPayouts()
            if (response.isSuccessful) {
                val payouts = response.body()?.payouts ?: emptyList()
                if (payouts.isNotEmpty()) {
                    processPayout(payouts.first())
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to check pending payouts", e)
        }
    }

    private suspend fun processPayout(payout: PayoutRequest) {
        isProcessingPayout = true
        Log.d(TAG, "Processing payout: ${payout.id}")

        try {
            val prefs = NgaboPayApp.instance.preferencesManager
            val ussdFormat = payout.ussdFormat ?: prefs.getUssdFormat()
            val pin = prefs.getMobileMoneyPin()

            if (pin.isNullOrBlank()) {
                reportPayoutFailure(payout.id, "Mobile Money PIN not configured")
                return
            }

            // Build USSD code from format
            val ussdCode = ussdFormat
                .replace("{phone}", payout.customerPhone)
                .replace("{amount}", payout.amount.toInt().toString())
                .replace("{pin}", pin)
                .replace("{reference}", payout.orderId ?: payout.id)

            Log.d(TAG, "Dialing USSD: $ussdCode")

            // Execute USSD on main thread
            withContext(Dispatchers.Main) {
                USSDAccessibilityService.instance?.dialUSSD(ussdCode) { result ->
                    scope.launch {
                        if (result.success) {
                            reportPayoutSuccess(payout.id, result.message, result.transactionId)
                        } else {
                            reportPayoutFailure(payout.id, result.message ?: "USSD failed")
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error processing payout", e)
            reportPayoutFailure(payout.id, e.message ?: "Unknown error")
        }
    }

    private suspend fun reportPayoutSuccess(payoutId: String, message: String?, txnId: String?) {
        try {
            ApiClient.getApi().completePayout(
                payoutId,
                PayoutResponse(success = true, message = message, transactionId = txnId)
            )
            Log.d(TAG, "Payout completed: $payoutId")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to report success", e)
        } finally {
            isProcessingPayout = false
        }
    }

    private suspend fun reportPayoutFailure(payoutId: String, reason: String) {
        try {
            ApiClient.getApi().failPayout(
                payoutId,
                PayoutResponse(success = false, message = reason, transactionId = null)
            )
            Log.d(TAG, "Payout failed: $payoutId - $reason")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to report failure", e)
        } finally {
            isProcessingPayout = false
        }
    }

    private suspend fun sendHeartbeat() {
        try {
            val deviceDbId = NgaboPayApp.instance.preferencesManager.getRegisteredDeviceDbId()
            if (deviceDbId != null) {
                ApiClient.getApi().sendHeartbeat(deviceDbId)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send heartbeat", e)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        pollingJob?.cancel()
        scope.cancel()
        Log.d(TAG, "PayoutPollingService destroyed")
    }

    companion object {
        private const val TAG = "PayoutPolling"
        private const val POLLING_INTERVAL = 10_000L // 10 seconds
    }
}
