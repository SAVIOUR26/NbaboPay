package com.ngabopay.ussd.service

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.ngabopay.ussd.model.USSDResult
import kotlinx.coroutines.*

class USSDAccessibilityService : AccessibilityService() {

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var currentCallback: ((USSDResult) -> Unit)? = null
    private val screenLog = mutableListOf<String>()
    private var isProcessing = false

    // Multi-step USSD support
    private val pendingSteps = mutableListOf<String>()
    private var currentStepIndex = 0

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
            // Extract all text from the dialog
            val messageText = extractDialogText(source)

            if (!messageText.isNullOrBlank() && messageText.length > 3) {
                Log.d(TAG, "USSD Screen: $messageText")
                screenLog.add(messageText)

                // Check if this is a final success state
                if (isTransactionComplete(messageText)) {
                    val result = parseTransactionResult(messageText)
                    clickButton(source, "OK", "Cancel", "Done")
                    completeUSSD(result)
                    return
                }

                // Check if this is an error
                if (isErrorMessage(messageText)) {
                    clickButton(source, "OK", "Cancel")
                    completeUSSD(USSDResult(false, messageText, screenLog = screenLog.toList()))
                    return
                }

                // Multi-step: if we have pending steps, input the next one
                if (pendingSteps.isNotEmpty() && currentStepIndex < pendingSteps.size) {
                    val nextInput = pendingSteps[currentStepIndex]
                    currentStepIndex++

                    Log.d(TAG, "Multi-step input $currentStepIndex/${pendingSteps.size}: $nextInput")

                    // Find the input field and enter text
                    val inputNode = findEditText(source)
                    if (inputNode != null) {
                        val args = Bundle()
                        args.putCharSequence(
                            AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                            nextInput
                        )
                        inputNode.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
                        inputNode.recycle()

                        // Click Send after a brief delay
                        scope.launch {
                            delay(500)
                            val root = rootInActiveWindow ?: return@launch
                            clickButton(root, "Send", "OK", "Continue")
                            root.recycle()
                        }
                    } else {
                        // No input field visible - click Send/OK to proceed
                        clickButton(source, "Send", "OK", "Continue")
                    }
                } else {
                    // No pending steps - auto-click to continue
                    clickButton(source, "Send", "OK", "Continue")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error handling USSD dialog", e)
        } finally {
            source.recycle()
        }
    }

    /**
     * Extract all text content from the USSD dialog
     */
    private fun extractDialogText(root: AccessibilityNodeInfo): String? {
        val texts = mutableListOf<String>()
        collectTextNodes(root, texts)
        val combined = texts.joinToString("\n").trim()
        return if (combined.isNotEmpty()) combined else null
    }

    private fun collectTextNodes(node: AccessibilityNodeInfo, texts: MutableList<String>) {
        val text = node.text?.toString()
        if (!text.isNullOrBlank() && node.className?.toString() == "android.widget.TextView") {
            texts.add(text)
        }

        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            collectTextNodes(child, texts)
            child.recycle()
        }
    }

    /**
     * Find an EditText input field in the dialog
     */
    private fun findEditText(root: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        if (root.className?.toString() == "android.widget.EditText") {
            return root
        }

        for (i in 0 until root.childCount) {
            val child = root.getChild(i) ?: continue
            val result = findEditText(child)
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
            "reference",
            "receipt"
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
            "limit exceeded",
            "wrong pin",
            "incorrect pin",
            "blocked",
            "service unavailable"
        )
        return errorIndicators.any { message.lowercase().contains(it) }
    }

    private fun parseTransactionResult(message: String): USSDResult {
        val txnIdPattern = Regex(
            "(?:txn|transaction|ref|reference|receipt)\\s*(?:id|no|number)?[:\\s]*([A-Z0-9]+)",
            RegexOption.IGNORE_CASE
        )
        val match = txnIdPattern.find(message)
        val txnId = match?.groupValues?.getOrNull(1)

        return USSDResult(
            success = true,
            message = message,
            transactionId = txnId,
            screenLog = screenLog.toList()
        )
    }

    private fun completeUSSD(result: USSDResult) {
        if (isProcessing) {
            isProcessing = false
            pendingSteps.clear()
            currentStepIndex = 0
            currentCallback?.invoke(result)
            currentCallback = null
        }
    }

    /**
     * Dial a USSD code with optional multi-step inputs.
     *
     * Single code mode: dialUSSD("*185*9*0781234567*50000*1234#")
     * Multi-step mode:  dialUSSD("*185#", listOf("9", "0781234567", "50000", "1234", "1"))
     */
    fun dialUSSD(ussdCode: String, steps: List<String> = emptyList(), callback: (USSDResult) -> Unit) {
        if (isProcessing) {
            callback(USSDResult(false, "Another USSD is in progress"))
            return
        }

        isProcessing = true
        currentCallback = callback
        screenLog.clear()
        pendingSteps.clear()
        pendingSteps.addAll(steps)
        currentStepIndex = 0

        Log.d(TAG, "Dialing USSD: $ussdCode, steps: ${steps.size}")

        scope.launch {
            try {
                val encodedUssd = Uri.encode(ussdCode)
                val intent = Intent(Intent.ACTION_CALL).apply {
                    data = Uri.parse("tel:$encodedUssd")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }

                applicationContext.startActivity(intent)

                // Timeout: 90s for multi-step, 60s for single
                val timeout = if (steps.isNotEmpty()) 90_000L else 60_000L
                delay(timeout)
                if (isProcessing) {
                    completeUSSD(USSDResult(
                        false,
                        "USSD timeout after ${timeout / 1000}s",
                        screenLog = screenLog.toList()
                    ))
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
