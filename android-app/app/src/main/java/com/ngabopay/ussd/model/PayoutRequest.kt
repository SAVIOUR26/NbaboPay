package com.ngabopay.ussd.model

import com.google.gson.annotations.SerializedName

data class PayoutRequest(
    @SerializedName("id") val id: String,
    @SerializedName("orderId") val orderId: String?,
    @SerializedName("amount") val amount: Double,
    @SerializedName("currency") val currency: String,
    @SerializedName("customerPhone") val customerPhone: String,
    @SerializedName("provider") val provider: String,
    @SerializedName("ussdFormat") val ussdFormat: String?,
    @SerializedName("status") val status: String,
    @SerializedName("createdAt") val createdAt: String
)

data class PayoutResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("message") val message: String?,
    @SerializedName("transactionId") val transactionId: String?
)

data class DeviceRegistration(
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("deviceName") val deviceName: String?,
    @SerializedName("fcmToken") val fcmToken: String?
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

data class PendingPayoutsResponse(
    @SerializedName("payouts") val payouts: List<PayoutRequest>
)

data class ConfigResponse(
    @SerializedName("configs") val configs: List<ConfigItem>
)

data class ConfigItem(
    @SerializedName("configKey") val key: String,
    @SerializedName("configValue") val value: String,
    @SerializedName("isEncrypted") val isEncrypted: Boolean
)

data class USSDResult(
    val success: Boolean,
    val message: String?,
    val transactionId: String? = null
)
