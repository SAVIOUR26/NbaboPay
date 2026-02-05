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
import com.ngabopay.ussd.model.PayoutCompleteRequest
import com.ngabopay.ussd.model.PayoutFailRequest
import com.ngabopay.ussd.model.PayoutInstruction
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
                    sendHeartbeat()
                    checkForPendingPayouts()
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
            } else {
                Log.w(TAG, "Failed to fetch payouts: ${response.code()}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to check pending payouts", e)
        }
    }

    private suspend fun processPayout(payout: PayoutInstruction) {
        isProcessingPayout = true
        Log.d(TAG, "Processing payout: ${payout.payoutId} | ${payout.orderReference}")
        Log.d(TAG, "Amount: ${payout.amount} ${payout.currency} -> ${payout.recipientPhone}")

        try {
            // Mark payout as started on server
            try {
                ApiClient.getApi().startPayout(payout.payoutId)
            } catch (e: Exception) {
                Log.w(TAG, "Failed to mark payout as started", e)
            }

            val ussdCode = payout.ussdCode

            if (ussdCode.isBlank()) {
                reportPayoutFailure(payout.payoutId, "No USSD code provided", null)
                return
            }

            Log.d(TAG, "Dialing USSD: $ussdCode")

            // Execute USSD on main thread
            withContext(Dispatchers.Main) {
                USSDAccessibilityService.instance?.dialUSSD(ussdCode) { result ->
                    scope.launch {
                        if (result.success) {
                            reportPayoutSuccess(
                                payout.payoutId,
                                result.transactionId,
                                result.message,
                                result.screenLog.joinToString("\n---\n")
                            )
                        } else {
                            reportPayoutFailure(
                                payout.payoutId,
                                result.message ?: "USSD failed",
                                result.screenLog.joinToString("\n---\n")
                            )
                        }
                    }
                } ?: run {
                    scope.launch {
                        reportPayoutFailure(payout.payoutId, "USSD Service not available", null)
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error processing payout", e)
            reportPayoutFailure(payout.payoutId, e.message ?: "Unknown error", null)
        }
    }

    private suspend fun reportPayoutSuccess(
        payoutId: String,
        transactionId: String?,
        confirmationMessage: String?,
        ussdResponse: String?
    ) {
        try {
            ApiClient.getApi().completePayout(
                payoutId,
                PayoutCompleteRequest(
                    transactionId = transactionId,
                    confirmationMessage = confirmationMessage,
                    ussdResponse = ussdResponse
                )
            )
            Log.d(TAG, "Payout completed: $payoutId | txn: $transactionId")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to report payout success", e)
        } finally {
            isProcessingPayout = false
        }
    }

    private suspend fun reportPayoutFailure(
        payoutId: String,
        reason: String,
        ussdResponse: String?
    ) {
        try {
            val response = ApiClient.getApi().failPayout(
                payoutId,
                PayoutFailRequest(
                    errorMessage = reason,
                    errorCode = null,
                    ussdResponse = ussdResponse
                )
            )
            val willRetry = response.body()?.willRetry ?: false
            Log.d(TAG, "Payout failed: $payoutId - $reason (willRetry: $willRetry)")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to report payout failure", e)
        } finally {
            isProcessingPayout = false
        }
    }

    private suspend fun sendHeartbeat() {
        try {
            ApiClient.getApi().sendHeartbeat()
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
