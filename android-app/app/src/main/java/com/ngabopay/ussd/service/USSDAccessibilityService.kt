package com.ngabopay.ussd.service

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.ngabopay.ussd.NgaboPayApp
import com.ngabopay.ussd.model.USSDResult
import kotlinx.coroutines.*

class USSDAccessibilityService : AccessibilityService() {

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var currentCallback: ((USSDResult) -> Unit)? = null
    private var ussdMessages = mutableListOf<String>()
    private var isProcessing = false

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        Log.d(TAG, "USSD Accessibility Service connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event ?: return

        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED ||
            event.eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {

            val packageName = event.packageName?.toString() ?: return

            // Handle USSD dialogs from phone app
            if (packageName == "com.android.phone" ||
                packageName.contains("phone") ||
                packageName.contains("dialer")) {
                handleUSSDDialog(event)
            }
        }
    }

    private fun handleUSSDDialog(event: AccessibilityEvent) {
        val source = event.source ?: return

        try {
            // Find the message text in the USSD dialog
            val messageNode = findNodeByClassName(source, "android.widget.TextView")
            val message = messageNode?.text?.toString()

            if (!message.isNullOrBlank() && message.length > 5) {
                Log.d(TAG, "USSD Message: $message")
                ussdMessages.add(message)

                // Check for completion indicators
                if (isTransactionComplete(message)) {
                    val result = parseTransactionResult(message)
                    completeUSSD(result)
                    clickButton(source, "OK", "Cancel", "Done")
                } else if (isErrorMessage(message)) {
                    completeUSSD(USSDResult(false, message))
                    clickButton(source, "OK", "Cancel")
                } else {
                    // Auto-click OK/Send to continue the USSD session
                    clickButton(source, "Send", "OK", "Continue")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error handling USSD dialog", e)
        } finally {
            source.recycle()
        }
    }

    private fun findNodeByClassName(root: AccessibilityNodeInfo, className: String): AccessibilityNodeInfo? {
        if (root.className?.toString() == className && !root.text.isNullOrBlank()) {
            return root
        }

        for (i in 0 until root.childCount) {
            val child = root.getChild(i) ?: continue
            val result = findNodeByClassName(child, className)
            if (result != null) return result
            child.recycle()
        }

        return null
    }

    private fun clickButton(root: AccessibilityNodeInfo, vararg buttonTexts: String): Boolean {
        for (buttonText in buttonTexts) {
            val button = findButtonByText(root, buttonText)
            if (button != null) {
                button.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                button.recycle()
                return true
            }
        }
        return false
    }

    private fun findButtonByText(root: AccessibilityNodeInfo, text: String): AccessibilityNodeInfo? {
        if ((root.className?.toString() == "android.widget.Button" ||
             root.isClickable) &&
            root.text?.toString()?.contains(text, ignoreCase = true) == true) {
            return root
        }

        for (i in 0 until root.childCount) {
            val child = root.getChild(i) ?: continue
            val result = findButtonByText(child, text)
            if (result != null) return result
            child.recycle()
        }

        return null
    }

    private fun isTransactionComplete(message: String): Boolean {
        val completionIndicators = listOf(
            "successful",
            "completed",
            "confirmed",
            "sent to",
            "transferred",
            "transaction id",
            "txn id",
            "reference"
        )
        return completionIndicators.any { message.lowercase().contains(it) }
    }

    private fun isErrorMessage(message: String): Boolean {
        val errorIndicators = listOf(
            "failed",
            "error",
            "insufficient",
            "invalid",
            "declined",
            "rejected",
            "not allowed",
            "limit exceeded"
        )
        return errorIndicators.any { message.lowercase().contains(it) }
    }

    private fun parseTransactionResult(message: String): USSDResult {
        // Try to extract transaction ID from message
        val txnIdPattern = Regex("(?:txn|transaction|ref|reference)\\s*(?:id|no|number)?[:\\s]*([A-Z0-9]+)", RegexOption.IGNORE_CASE)
        val match = txnIdPattern.find(message)
        val txnId = match?.groupValues?.getOrNull(1)

        return USSDResult(
            success = true,
            message = message,
            transactionId = txnId
        )
    }

    private fun completeUSSD(result: USSDResult) {
        if (isProcessing) {
            isProcessing = false
            currentCallback?.invoke(result)
            currentCallback = null
            ussdMessages.clear()
        }
    }

    fun dialUSSD(ussdCode: String, callback: (USSDResult) -> Unit) {
        if (isProcessing) {
            callback(USSDResult(false, "Another USSD is in progress"))
            return
        }

        isProcessing = true
        currentCallback = callback
        ussdMessages.clear()

        scope.launch {
            try {
                // Format USSD code for dialing
                val encodedUssd = Uri.encode(ussdCode)
                val intent = Intent(Intent.ACTION_CALL).apply {
                    data = Uri.parse("tel:$encodedUssd")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }

                applicationContext.startActivity(intent)

                // Timeout after 60 seconds
                delay(60000)
                if (isProcessing) {
                    completeUSSD(USSDResult(false, "USSD timeout"))
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error dialing USSD", e)
                completeUSSD(USSDResult(false, "Failed to dial: ${e.message}"))
            }
        }
    }

    override fun onInterrupt() {
        Log.d(TAG, "USSD Accessibility Service interrupted")
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
        instance = null
        Log.d(TAG, "USSD Accessibility Service destroyed")
    }

    companion object {
        private const val TAG = "USSDService"
        var instance: USSDAccessibilityService? = null
            private set

        fun isRunning(): Boolean = instance != null
    }
}
