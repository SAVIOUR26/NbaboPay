package com.ngabopay.ussd.util

import android.content.Context
import android.content.SharedPreferences
import android.provider.Settings
import java.util.UUID

class PreferencesManager(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences(
        PREFS_NAME,
        Context.MODE_PRIVATE
    )

    private val androidId: String = Settings.Secure.getString(
        context.contentResolver,
        Settings.Secure.ANDROID_ID
    ) ?: UUID.randomUUID().toString()

    fun getDeviceId(): String {
        var deviceId = prefs.getString(KEY_DEVICE_ID, null)
        if (deviceId == null) {
            deviceId = "ngabo_${androidId}_${System.currentTimeMillis()}"
            prefs.edit().putString(KEY_DEVICE_ID, deviceId).apply()
        }
        return deviceId
    }

    fun getServerUrl(): String? = prefs.getString(KEY_SERVER_URL, null)

    fun setServerUrl(url: String) {
        prefs.edit().putString(KEY_SERVER_URL, url).apply()
    }

    fun getApiToken(): String? = prefs.getString(KEY_API_TOKEN, null)

    fun setApiToken(token: String) {
        prefs.edit().putString(KEY_API_TOKEN, token).apply()
    }

    fun getFcmToken(): String? = prefs.getString(KEY_FCM_TOKEN, null)

    fun setFcmToken(token: String) {
        prefs.edit().putString(KEY_FCM_TOKEN, token).apply()
    }

    fun getUssdFormat(): String {
        return prefs.getString(KEY_USSD_FORMAT, DEFAULT_USSD_FORMAT) ?: DEFAULT_USSD_FORMAT
    }

    fun setUssdFormat(format: String) {
        prefs.edit().putString(KEY_USSD_FORMAT, format).apply()
    }

    fun getMobileMoneyPin(): String? = prefs.getString(KEY_MM_PIN, null)

    fun setMobileMoneyPin(pin: String) {
        prefs.edit().putString(KEY_MM_PIN, pin).apply()
    }

    fun isServiceEnabled(): Boolean = prefs.getBoolean(KEY_SERVICE_ENABLED, false)

    fun setServiceEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_SERVICE_ENABLED, enabled).apply()
    }

    fun getRegisteredDeviceDbId(): String? = prefs.getString(KEY_DEVICE_DB_ID, null)

    fun setRegisteredDeviceDbId(id: String) {
        prefs.edit().putString(KEY_DEVICE_DB_ID, id).apply()
    }

    fun clearAll() {
        prefs.edit().clear().apply()
    }

    companion object {
        private const val PREFS_NAME = "ngabopay_prefs"
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_DEVICE_DB_ID = "device_db_id"
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_API_TOKEN = "api_token"
        private const val KEY_FCM_TOKEN = "fcm_token"
        private const val KEY_USSD_FORMAT = "ussd_format"
        private const val KEY_MM_PIN = "mm_pin"
        private const val KEY_SERVICE_ENABLED = "service_enabled"

        // Default USSD format for Airtel Uganda
        private const val DEFAULT_USSD_FORMAT = "*185*9*{phone}*{amount}*{pin}#"
    }
}
