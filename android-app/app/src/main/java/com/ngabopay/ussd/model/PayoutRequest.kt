package com.ngabopay.ussd.model

import com.google.gson.annotations.SerializedName

// === Payout models (from /api/device/pending-payouts) ===

data class PayoutInstruction(
    @SerializedName("payoutId") val payoutId: String,
    @SerializedName("orderId") val orderId: String,
    @SerializedName("orderReference") val orderReference: String,
    @SerializedName("amount") val amount: Int,
    @SerializedName("currency") val currency: String,
    @SerializedName("recipientPhone") val recipientPhone: String,
    @SerializedName("ussdCode") val ussdCode: String,
    @SerializedName("provider") val provider: String,
    @SerializedName("retryCount") val retryCount: Int
)

data class PendingPayoutsResponse(
    @SerializedName("payouts") val payouts: List<PayoutInstruction>,
    @SerializedName("count") val count: Int
)

data class PayoutCompleteRequest(
    @SerializedName("transactionId") val transactionId: String?,
    @SerializedName("confirmationMessage") val confirmationMessage: String?,
    @SerializedName("ussdResponse") val ussdResponse: String?
)

data class PayoutFailRequest(
    @SerializedName("errorMessage") val errorMessage: String,
    @SerializedName("errorCode") val errorCode: String?,
    @SerializedName("ussdResponse") val ussdResponse: String?
)

data class PayoutFailResponse(
    @SerializedName("message") val message: String,
    @SerializedName("willRetry") val willRetry: Boolean,
    @SerializedName("retryCount") val retryCount: Int
)

// === Device models ===

data class DeviceRegistration(
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("deviceName") val deviceName: String?,
    @SerializedName("appVersion") val appVersion: String?
)

data class DeviceRegistrationResponse(
    @SerializedName("message") val message: String,
    @SerializedName("device") val device: Device
)

data class Device(
    @SerializedName("id") val id: String,
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("deviceName") val deviceName: String?,
    @SerializedName("isConnected") val isConnected: Boolean
)

data class HeartbeatResponse(
    @SerializedName("status") val status: String,
    @SerializedName("timestamp") val timestamp: String
)

data class GenericResponse(
    @SerializedName("message") val message: String
)

data class DeviceConfigResponse(
    @SerializedName("configs") val configs: Map<String, String>
)

// === USSD result ===

data class USSDResult(
    val success: Boolean,
    val message: String?,
    val transactionId: String? = null,
    val screenLog: List<String> = emptyList()
)
