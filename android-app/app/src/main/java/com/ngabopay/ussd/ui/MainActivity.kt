package com.ngabopay.ussd.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.ngabopay.ussd.BuildConfig
import com.ngabopay.ussd.NgaboPayApp
import com.ngabopay.ussd.api.ApiClient
import com.ngabopay.ussd.databinding.ActivityMainBinding
import com.ngabopay.ussd.model.DeviceRegistration
import com.ngabopay.ussd.service.PayoutPollingService
import com.ngabopay.ussd.service.USSDAccessibilityService
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val prefs by lazy { NgaboPayApp.instance.preferencesManager }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.all { it.value }
        if (allGranted) {
            checkAccessibilityService()
        } else {
            Toast.makeText(this, "Permissions required for USSD automation", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupUI()
        loadSettings()
        checkPermissions()
    }

    override fun onResume() {
        super.onResume()
        updateStatus()
    }

    private fun setupUI() {
        binding.apply {
            // Server URL
            etServerUrl.setText(prefs.getServerUrl() ?: BuildConfig.API_BASE_URL)

            // API Token
            etApiToken.setText(prefs.getApiToken() ?: "")

            // USSD Format
            etUssdFormat.setText(prefs.getUssdFormat())

            // Mobile Money PIN
            etMmPin.setText(prefs.getMobileMoneyPin() ?: "")

            // Save Settings Button
            btnSaveSettings.setOnClickListener {
                saveSettings()
            }

            // Connect Button
            btnConnect.setOnClickListener {
                if (prefs.isServiceEnabled()) {
                    disconnect()
                } else {
                    connect()
                }
            }

            // Enable Accessibility Button
            btnEnableAccessibility.setOnClickListener {
                openAccessibilitySettings()
            }

            // Test USSD Button
            btnTestUssd.setOnClickListener {
                testUSSD()
            }
        }
    }

    private fun loadSettings() {
        binding.apply {
            etServerUrl.setText(prefs.getServerUrl() ?: BuildConfig.API_BASE_URL)
            etApiToken.setText(prefs.getApiToken() ?: "")
            etUssdFormat.setText(prefs.getUssdFormat())
            etMmPin.setText(prefs.getMobileMoneyPin() ?: "")
        }
    }

    private fun saveSettings() {
        binding.apply {
            val serverUrl = etServerUrl.text.toString().trim()
            val apiToken = etApiToken.text.toString().trim()
            val ussdFormat = etUssdFormat.text.toString().trim()
            val mmPin = etMmPin.text.toString().trim()

            if (serverUrl.isNotEmpty()) prefs.setServerUrl(serverUrl)
            if (apiToken.isNotEmpty()) prefs.setApiToken(apiToken)
            if (ussdFormat.isNotEmpty()) prefs.setUssdFormat(ussdFormat)
            if (mmPin.isNotEmpty()) prefs.setMobileMoneyPin(mmPin)

            // Reset API client to use new settings
            ApiClient.resetClient()

            Toast.makeText(this@MainActivity, "Settings saved", Toast.LENGTH_SHORT).show()
        }
    }

    private fun checkPermissions() {
        val permissions = mutableListOf<String>()

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE)
            != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.CALL_PHONE)
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE)
            != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.READ_PHONE_STATE)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        if (permissions.isNotEmpty()) {
            permissionLauncher.launch(permissions.toTypedArray())
        } else {
            checkAccessibilityService()
        }
    }

    private fun checkAccessibilityService() {
        if (!USSDAccessibilityService.isRunning()) {
            AlertDialog.Builder(this)
                .setTitle("Enable Accessibility Service")
                .setMessage("To automate USSD transactions, you need to enable the NgaboPay Accessibility Service.")
                .setPositiveButton("Enable") { _, _ -> openAccessibilitySettings() }
                .setNegativeButton("Later", null)
                .show()
        }
    }

    private fun openAccessibilitySettings() {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        startActivity(intent)
    }

    private fun updateStatus() {
        binding.apply {
            // Update accessibility status
            val accessibilityEnabled = USSDAccessibilityService.isRunning()
            tvAccessibilityStatus.text = if (accessibilityEnabled) "Enabled" else "Disabled"
            tvAccessibilityStatus.setTextColor(
                ContextCompat.getColor(
                    this@MainActivity,
                    if (accessibilityEnabled) android.R.color.holo_green_light
                    else android.R.color.holo_red_light
                )
            )

            // Update connection status
            val serviceEnabled = prefs.isServiceEnabled()
            tvConnectionStatus.text = if (serviceEnabled) "Connected" else "Disconnected"
            tvConnectionStatus.setTextColor(
                ContextCompat.getColor(
                    this@MainActivity,
                    if (serviceEnabled) android.R.color.holo_green_light
                    else android.R.color.holo_red_light
                )
            )

            // Update button text
            btnConnect.text = if (serviceEnabled) "Disconnect" else "Connect"
        }
    }

    private fun connect() {
        val apiToken = prefs.getApiToken()
        if (apiToken.isNullOrBlank()) {
            Toast.makeText(this, "Please enter API Token first", Toast.LENGTH_SHORT).show()
            return
        }

        if (!USSDAccessibilityService.isRunning()) {
            Toast.makeText(this, "Please enable Accessibility Service first", Toast.LENGTH_LONG).show()
            return
        }

        binding.btnConnect.isEnabled = false

        lifecycleScope.launch {
            try {
                // Register device with server
                val registration = DeviceRegistration(
                    deviceId = prefs.getDeviceId(),
                    deviceName = "${Build.MANUFACTURER} ${Build.MODEL}",
                    appVersion = BuildConfig.VERSION_NAME
                )

                val response = ApiClient.getApi().registerDevice(registration)
                if (response.isSuccessful) {
                    val device = response.body()?.device
                    if (device != null) {
                        prefs.setRegisteredDeviceDbId(device.id)
                    }

                    prefs.setServiceEnabled(true)

                    // Start polling service
                    val serviceIntent = Intent(this@MainActivity, PayoutPollingService::class.java)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        startForegroundService(serviceIntent)
                    } else {
                        startService(serviceIntent)
                    }

                    Toast.makeText(this@MainActivity, "Connected to server", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this@MainActivity, "Failed to connect: ${response.code()}", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@MainActivity, "Connection error: ${e.message}", Toast.LENGTH_LONG).show()
            } finally {
                binding.btnConnect.isEnabled = true
                updateStatus()
            }
        }
    }

    private fun disconnect() {
        prefs.setServiceEnabled(false)
        stopService(Intent(this, PayoutPollingService::class.java))
        Toast.makeText(this, "Disconnected", Toast.LENGTH_SHORT).show()
        updateStatus()
    }

    private fun testUSSD() {
        if (!USSDAccessibilityService.isRunning()) {
            Toast.makeText(this, "Enable Accessibility Service first", Toast.LENGTH_LONG).show()
            return
        }

        // Test with balance check USSD
        AlertDialog.Builder(this)
            .setTitle("Test USSD")
            .setMessage("This will dial *185# to test USSD automation. Continue?")
            .setPositiveButton("Test") { _, _ ->
                USSDAccessibilityService.instance?.dialUSSD("*185#") { result ->
                    runOnUiThread {
                        val message = if (result.success) {
                            "USSD Success: ${result.message}"
                        } else {
                            "USSD Failed: ${result.message}"
                        }
                        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
                    }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
}
