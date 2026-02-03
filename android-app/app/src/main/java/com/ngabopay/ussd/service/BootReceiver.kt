package com.ngabopay.ussd.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.ngabopay.ussd.NgaboPayApp

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            Log.d(TAG, "Boot completed, checking if service should start")

            val prefs = NgaboPayApp.instance.preferencesManager
            if (prefs.isServiceEnabled() && prefs.getApiToken() != null) {
                Log.d(TAG, "Starting PayoutPollingService")
                val serviceIntent = Intent(context, PayoutPollingService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }
            }
        }
    }

    companion object {
        private const val TAG = "BootReceiver"
    }
}
