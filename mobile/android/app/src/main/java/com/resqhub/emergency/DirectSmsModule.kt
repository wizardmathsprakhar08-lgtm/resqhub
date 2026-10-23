package com.resqhub.emergency

import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.telephony.SmsManager
import android.telephony.SubscriptionInfo
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * ResQHub DirectSmsModule
 *
 * Provides native direct cellular SMS transmission using Android's SmsManager.
 * Supports:
 * - Runtime permission check and SIM capability detection
 * - Dual-SIM awareness via SubscriptionManager / default SMS subscription ID
 * - Single-part and multipart SMS (divideMessage) for long emergency messages
 * - Carrier submission tracking via Sent PendingIntent
 * - Carrier delivery report tracking via Delivery PendingIntent
 * - Automatic receiver cleanup and unregister timeouts to prevent memory leaks
 */
class DirectSmsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val mainHandler = Handler(Looper.getMainLooper())
    private val activeReceivers = ConcurrentHashMap<String, BroadcastReceiver>()

    override fun getName(): String = "DirectSms"

    /**
     * Checks if the device has telephony hardware, an active SIM card,
     * and whether SEND_SMS permission is currently granted.
     */
    @ReactMethod
    fun checkSmsCapability(promise: Promise) {
        try {
            val context = reactApplicationContext
            val packageManager = context.packageManager
            val telephonyManager =
                context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager

            val hasTelephony =
                packageManager.hasSystemFeature(PackageManager.FEATURE_TELEPHONY)

            val simStateInt = telephonyManager?.simState ?: TelephonyManager.SIM_STATE_UNKNOWN
            val simStateStr = when (simStateInt) {
                TelephonyManager.SIM_STATE_READY -> "READY"
                TelephonyManager.SIM_STATE_ABSENT -> "ABSENT"
                TelephonyManager.SIM_STATE_PIN_REQUIRED,
                TelephonyManager.SIM_STATE_PUK_REQUIRED,
                TelephonyManager.SIM_STATE_NETWORK_LOCKED -> "LOCKED"
                else -> "UNKNOWN"
            }

            val hasSendSmsPermission = ContextCompat.checkSelfPermission(
                context,
                android.Manifest.permission.SEND_SMS
            ) == PackageManager.PERMISSION_GRANTED

            val hasPhoneStatePermission = ContextCompat.checkSelfPermission(
                context,
                android.Manifest.permission.READ_PHONE_STATE
            ) == PackageManager.PERMISSION_GRANTED

            var isDualSim = false
            var activeSimCount = if (simStateInt == TelephonyManager.SIM_STATE_READY) 1 else 0
            var defaultSubId = -1
            val carrierNames = Arguments.createArray()

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                defaultSubId = SmsManager.getDefaultSmsSubscriptionId()

                if (hasPhoneStatePermission) {
                    try {
                        val subManager =
                            context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as? SubscriptionManager
                        val subList: List<SubscriptionInfo>? = subManager?.activeSubscriptionInfoList
                        if (subList != null && subList.isNotEmpty()) {
                            activeSimCount = subList.size
                            isDualSim = subList.size > 1
                            for (sub in subList) {
                                val carrier = sub.carrierName?.toString() ?: "SIM ${sub.simSlotIndex + 1}"
                                carrierNames.pushString(carrier)
                            }
                        }
                    } catch (e: SecurityException) {
                        // READ_PHONE_STATE permission revoked or restricted
                    }
                }
            }

            val isReady = hasTelephony &&
                    simStateInt == TelephonyManager.SIM_STATE_READY &&
                    hasSendSmsPermission

            val result = Arguments.createMap().apply {
                putBoolean("hasTelephony", hasTelephony)
                putString("simState", simStateStr)
                putBoolean("permissionGranted", hasSendSmsPermission)
                putBoolean("isReady", isReady)
                putBoolean("isDualSim", isDualSim)
                putInt("activeSimCount", activeSimCount)
                putInt("defaultSmsSubscriptionId", defaultSubId)
                putArray("carrierNames", carrierNames)
                if (simStateInt == TelephonyManager.SIM_STATE_ABSENT) {
                    putString("error", "No active SIM card detected in device.")
                } else if (!hasSendSmsPermission) {
                    putString("error", "SEND_SMS permission has not been granted.")
                }
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("CHECK_CAPABILITY_ERROR", e.message, e)
        }
    }

    /**
     * Submits an emergency SMS to a recipient using Android's SmsManager.
     */
    @ReactMethod
    fun sendDirectSms(
        phoneNumber: String,
        messageText: String,
        alertId: String,
        recipientId: String,
        promise: Promise
    ) {
        val context = reactApplicationContext

        // 1. Permission check
        val hasPermission = ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.SEND_SMS
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasPermission) {
            promise.reject(
                "PERMISSION_DENIED",
                "Cannot send emergency SMS: SEND_SMS permission is not granted."
            )
            return
        }

        // 2. Validate phone number
        val cleanedPhone = phoneNumber.replace(Regex("[\\s\\-\\(\\)]"), "").trim()
        if (cleanedPhone.length < 5) {
            promise.reject("INVALID_PHONE", "Destination phone number is invalid: '$phoneNumber'")
            return
        }

        // 3. Validate message body
        if (messageText.isBlank()) {
            promise.reject("EMPTY_MESSAGE", "Emergency message body cannot be empty.")
            return
        }

        // 4. Resolve SmsManager (handling dual-SIM subscription where available)
        val smsManager = getTargetSmsManager()
        val parts = smsManager.divideMessage(messageText)
        val partsCount = parts.size

        // 5. Setup unique PendingIntents for Sent and Delivered callbacks
        val uniqueTag = "${alertId}_${recipientId}_${UUID.randomUUID().toString().substring(0, 8)}"
        val sentAction = "com.resqhub.SMS_SENT_$uniqueTag"
        val deliveredAction = "com.resqhub.SMS_DELIVERED_$uniqueTag"

        val piFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_ONE_SHOT
        }

        val sentIntent = Intent(sentAction).setPackage(context.packageName)
        val deliveredIntent = Intent(deliveredAction).setPackage(context.packageName)

        val sentPI = PendingIntent.getBroadcast(context, 0, sentIntent, piFlags)
        val deliveredPI = PendingIntent.getBroadcast(context, 0, deliveredIntent, piFlags)

        // 6. Register Sent BroadcastReceiver
        val sentReceiver = object : BroadcastReceiver() {
            override fun onReceive(c: Context?, intent: Intent?) {
                safeUnregisterReceiver(sentAction)

                val code = resultCode
                if (code == Activity.RESULT_OK) {
                    val eventMap = Arguments.createMap().apply {
                        putString("alertId", alertId)
                        putString("recipientId", recipientId)
                        putString("phoneNumber", phoneNumber)
                        putString("status", "sent")
                        putInt("partsCount", partsCount)
                    }
                    sendEvent("onSmsSent", eventMap)
                } else {
                    val errorDesc = mapSmsErrorCode(code)
                    val eventMap = Arguments.createMap().apply {
                        putString("alertId", alertId)
                        putString("recipientId", recipientId)
                        putString("phoneNumber", phoneNumber)
                        putString("status", "failed")
                        putInt("errorCode", code)
                        putString("errorMessage", errorDesc)
                    }
                    sendEvent("onSmsFailed", eventMap)
                }
            }
        }
        safeRegisterReceiver(sentAction, sentReceiver, sentAction)

        // 7. Register Delivery BroadcastReceiver (with carrier timeout auto-cleanup)
        val deliveredReceiver = object : BroadcastReceiver() {
            override fun onReceive(c: Context?, intent: Intent?) {
                safeUnregisterReceiver(deliveredAction)

                val code = resultCode
                if (code == Activity.RESULT_OK) {
                    val eventMap = Arguments.createMap().apply {
                        putString("alertId", alertId)
                        putString("recipientId", recipientId)
                        putString("phoneNumber", phoneNumber)
                        putString("status", "delivered")
                    }
                    sendEvent("onSmsDelivered", eventMap)
                }
            }
        }
        safeRegisterReceiver(deliveredAction, deliveredReceiver, deliveredAction)

        // 60-second safety timeout to cleanup delivery receiver if carrier does not send delivery report
        mainHandler.postDelayed({
            safeUnregisterReceiver(deliveredAction)
            safeUnregisterReceiver(sentAction)
        }, 60000)

        // 8. Submit SMS to cellular baseband via SmsManager
        try {
            if (partsCount > 1) {
                val sentIntents = ArrayList<PendingIntent?>(partsCount)
                val deliveredIntents = ArrayList<PendingIntent?>(partsCount)
                for (i in 0 until partsCount) {
                    if (i == partsCount - 1) {
                        sentIntents.add(sentPI)
                        deliveredIntents.add(deliveredPI)
                    } else {
                        sentIntents.add(null)
                        deliveredIntents.add(null)
                    }
                }
                smsManager.sendMultipartTextMessage(cleanedPhone, null, parts, sentIntents, deliveredIntents)
            } else {
                smsManager.sendTextMessage(cleanedPhone, null, messageText, sentPI, deliveredPI)
            }

            // Resolve promise that the SMS was accepted by Android OS for submission
            val res = Arguments.createMap().apply {
                putBoolean("submitted", true)
                putString("status", "submitting")
                putInt("partsCount", partsCount)
                putString("alertId", alertId)
                putString("recipientId", recipientId)
                putString("phoneNumber", phoneNumber)
            }
            promise.resolve(res)
        } catch (e: SecurityException) {
            safeUnregisterReceiver(sentAction)
            safeUnregisterReceiver(deliveredAction)
            promise.reject("SECURITY_EXCEPTION", "Permission denied by OS: ${e.message}", e)
        } catch (e: Exception) {
            safeUnregisterReceiver(sentAction)
            safeUnregisterReceiver(deliveredAction)
            promise.reject("SUBMIT_FAILED", "SmsManager submission failed: ${e.message}", e)
        }
    }

    private fun getTargetSmsManager(): SmsManager {
        val context = reactApplicationContext

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
            val subId = SmsManager.getDefaultSmsSubscriptionId()
            if (subId > 0 && subId != SubscriptionManager.INVALID_SUBSCRIPTION_ID) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    val sm = context.getSystemService(SmsManager::class.java)
                    return sm.createForSubscriptionId(subId)
                }
                @Suppress("DEPRECATION")
                return SmsManager.getSmsManagerForSubscriptionId(subId)
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return context.getSystemService(SmsManager::class.java)
        }

        @Suppress("DEPRECATION")
        return SmsManager.getDefault()
    }

    private fun safeRegisterReceiver(key: String, receiver: BroadcastReceiver, action: String) {
        try {
            val context = reactApplicationContext
            val filter = IntentFilter(action)
            activeReceivers[key] = receiver

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
            } else {
                context.registerReceiver(receiver, filter)
            }
        } catch (e: Exception) {
            // Receiver registration failed
        }
    }

    private fun safeUnregisterReceiver(key: String) {
        val receiver = activeReceivers.remove(key) ?: return
        try {
            reactApplicationContext.unregisterReceiver(receiver)
        } catch (e: Exception) {
            // Receiver already unregistered
        }
    }

    private fun mapSmsErrorCode(code: Int): String {
        return when (code) {
            SmsManager.RESULT_ERROR_GENERIC_FAILURE ->
                "Carrier Generic Failure: cellular radio rejected message or SIM lacks active SMS plan/recharge"
            SmsManager.RESULT_ERROR_RADIO_OFF ->
                "Cellular radio powered off (Airplane mode is enabled)"
            SmsManager.RESULT_ERROR_NULL_PDU ->
                "No PDU provided by SMS provider"
            SmsManager.RESULT_ERROR_NO_SERVICE ->
                "No cellular service: device is out of operator coverage"
            SmsManager.RESULT_ERROR_LIMIT_EXCEEDED ->
                "Android SMS rate limit exceeded by device"
            else ->
                "SMS delivery submission failed (Android error code: $code)"
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        if (reactApplicationContext.hasActiveReactInstance()) {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for React Native NativeEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for React Native NativeEventEmitter
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        mainHandler.removeCallbacksAndMessages(null)
        for ((_, receiver) in activeReceivers) {
            try {
                reactApplicationContext.unregisterReceiver(receiver)
            } catch (e: Exception) {
                // Ignore
            }
        }
        activeReceivers.clear()
    }
}
