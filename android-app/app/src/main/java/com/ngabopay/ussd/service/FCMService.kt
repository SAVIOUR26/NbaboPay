package com.ngabopay.ussd.service

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.ngabopay.ussd.NgaboPayApp

class FCMService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "New FCM token: $token")
        NgaboPayApp.instance.preferencesManager.setFcmToken(token)
        // TODO: Update token on server
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        Log.d(TAG, "FCM message received: ${message.data}")

        // Handle payout notification
        val type = message.data["type"]
        if (type == "payout") {
            // Service will pick it up on next poll
            Log.d(TAG, "Payout notification received")
        }
    }

    companion object {
        private const val TAG = "FCMService"
    }
}
