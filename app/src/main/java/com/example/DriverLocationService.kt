package com.example

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * DriverLocationService
 *
 * Dedicated Android Foreground Service for agrarian transport drivers.
 * Transmits real-time GPS coordinates directly to the Supabase PostGIS
 * driver_locations database table at 5-10 second intervals even when the device
 * screen is locked or the application is in the background.
 */
class DriverLocationService : Service() {

    private val serviceJob = SupervisorJob()
    private val serviceScope = CoroutineScope(Dispatchers.IO + serviceJob)

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private var locationCallback: LocationCallback? = null
    private var wakeLock: PowerManager.WakeLock? = null

    private var currentDriverId: String = "DRV-LIVE"
    private var currentDriverName: String = "Verified Driver"
    private var currentVehiclePlate: String = "AP-39-TK-1008"
    private var currentVehicleType: String = "Tata Ace (1.5T)"

    companion object {
        const val CHANNEL_ID = "nukrop_driver_location_channel"
        const val NOTIFICATION_ID = 8841

        const val ACTION_START_TRACKING = "com.nukrop.action.START_DRIVER_TRACKING"
        const val ACTION_STOP_TRACKING = "com.nukrop.action.STOP_DRIVER_TRACKING"

        const val EXTRA_DRIVER_ID = "extra_driver_id"
        const val EXTRA_DRIVER_NAME = "extra_driver_name"
        const val EXTRA_VEHICLE_PLATE = "extra_vehicle_plate"
        const val EXTRA_VEHICLE_TYPE = "extra_vehicle_type"

        @Volatile
        var isRunning: Boolean = false
            private set

        @Volatile
        var lastRecordedLocation: Location? = null
            private set
    }

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_START_TRACKING

        if (action == ACTION_STOP_TRACKING) {
            stopTracking()
            return START_NOT_STICKY
        }

        if (action == ACTION_START_TRACKING) {
            intent?.getStringExtra(EXTRA_DRIVER_ID)?.let { if (it.isNotBlank()) currentDriverId = it }
            intent?.getStringExtra(EXTRA_DRIVER_NAME)?.let { if (it.isNotBlank()) currentDriverName = it }
            intent?.getStringExtra(EXTRA_VEHICLE_PLATE)?.let { if (it.isNotBlank()) currentVehiclePlate = it }
            intent?.getStringExtra(EXTRA_VEHICLE_TYPE)?.let { if (it.isNotBlank()) currentVehicleType = it }

            startForegroundTracking()
        }

        return START_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "Driver Dispatch GPS Telemetry"
            val descriptionText = "Continuous GPS tracking for active on-duty agrarian transport drivers"
            val importance = NotificationManager.IMPORTANCE_LOW
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
                setShowBadge(false)
            }
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(contentText: String): Notification {
        val launchIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("NuKropAI GramHaul • Driver On Duty")
            .setContentText(contentText)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    @SuppressLint("MissingPermission")
    private fun startForegroundTracking() {
        if (isRunning) return

        val notification = buildNotification("Broadcasting live GPS to Farmer Marketplace ($currentVehiclePlate)")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        isRunning = true

        acquireWakeLock()

        if (!hasLocationPermission()) {
            stopTracking()
            return
        }

        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5000L).apply {
            setMinUpdateIntervalMillis(3000L)
            setMinUpdateDistanceMeters(5.0f)
            setWaitForAccurateLocation(false)
        }.build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                val loc = locationResult.lastLocation ?: return
                lastRecordedLocation = loc

                serviceScope.launch {
                    val heading = loc.bearing.toDouble()
                    val speedKmh = (loc.speed * 3.6).toDouble()

                    // Send coordinates to Supabase PostGIS driver_locations table
                    SupabaseApi.upsertDriverLocation(
                        driverId = currentDriverId,
                        lat = loc.latitude,
                        lng = loc.longitude,
                        heading = heading,
                        speedKmh = speedKmh
                    )
                }
            }
        }

        fusedLocationClient.requestLocationUpdates(
            locationRequest,
            locationCallback!!,
            Looper.getMainLooper()
        )
    }

    private fun hasLocationPermission(): Boolean {
        val finePerm = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
        val coarsePerm = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
        return finePerm == PackageManager.PERMISSION_GRANTED || coarsePerm == PackageManager.PERMISSION_GRANTED
    }

    @SuppressLint("WakelockTimeout")
    private fun acquireWakeLock() {
        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager
            wakeLock = powerManager?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "NuKropAI:DriverGpsWakeLock")?.apply {
                acquire(10 * 60 * 1000L) // 10 minute safety timeout
            }
        } catch (_: Exception) {}
    }

    private fun releaseWakeLock() {
        try {
            wakeLock?.let {
                if (it.isHeld) it.release()
            }
            wakeLock = null
        } catch (_: Exception) {}
    }

    private fun stopTracking() {
        locationCallback?.let {
            fusedLocationClient.removeLocationUpdates(it)
            locationCallback = null
        }
        releaseWakeLock()
        isRunning = false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        stopSelf()
    }

    override fun onDestroy() {
        stopTracking()
        serviceScope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
