package com.example

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Looper
import android.provider.MediaStore
import android.view.View
import android.view.ViewGroup
import android.webkit.*
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import java.io.File
import java.io.IOException

// Sealed class Tab kept so any references in test files or utilities compile without issue
sealed class Tab(val route: String, val icon: String, val labelKey: String) {
    object Home   : Tab("home",    "🏠", "nav_home")
    object Community : Tab("community", "👥", "nav_community")
    object Scan   : Tab("scan",    "🔬", "nav_scan")
    object Market : Tab("market",  "📊", "nav_market")
    object Profile: Tab("profile", "👤", "nav_profile")
    object Autopilot: Tab("autopilot", "🚜", "nav_autopilot")
    object Finance: Tab("finance", "💰", "nav_finance")
    object SavedReports: Tab("saved_reports", "📂", "nav_reports")
    object EquipmentRental: Tab("equipment_rental", "🚜", "nav_rental")
    object FarmKhata: Tab("farm_khata", "🧾", "nav_khata")
    object BioShieldRadar: Tab("bioshield_radar", "🛡️", "nav_bioshield")
    object MandiPilot: Tab("mandipilot", "📈", "nav_mandipilot")
    object GramHaul: Tab("gramhaul", "🚚", "nav_gramhaul")
    object AgriStackPassport: Tab("agristack_passport", "🪪", "nav_agristack")
    object YantraShare: Tab("yantrashare", "🚜", "nav_yantra")
    object BioRx: Tab("biorx", "🌿", "nav_biorx")
    data class Calculators(val type: CalculatorType) : Tab("calculators", "🧮", "nav_calculators")
    data class PeerChat(val name: String, val info: String, val phone: String) : Tab("peer_chat", "💬", "nav_chat")
}

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var cameraPhotoUri: Uri? = null
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null
    private lateinit var rootContainer: android.widget.FrameLayout
    private val CHANNEL_ID = "nukrop_farmer_alerts"

    inner class WebAppInterface {
        @JavascriptInterface
        fun requestDeviceLocation() {
            runOnUiThread {
                fetchAndSendLocationToWebView()
            }
        }

        @JavascriptInterface
        fun requestLocationPermission() {
            runOnUiThread {
                permissionLauncher.launch(
                    arrayOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    )
                )
            }
        }

        @JavascriptInterface
        fun requestNotificationPermission() {
            runOnUiThread {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    permissionLauncher.launch(arrayOf(Manifest.permission.POST_NOTIFICATIONS))
                }
            }
        }

        @JavascriptInterface
        fun requestCameraPermission() {
            runOnUiThread {
                permissionLauncher.launch(arrayOf(Manifest.permission.CAMERA))
            }
        }

        @JavascriptInterface
        fun requestNativePermissions() {
            runOnUiThread {
                val permissions = mutableListOf(
                    Manifest.permission.CAMERA,
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    permissions.add(Manifest.permission.POST_NOTIFICATIONS)
                }
                permissionLauncher.launch(permissions.toTypedArray())
            }
        }

        @JavascriptInterface
        fun openDialer(phoneNumber: String) {
            runOnUiThread {
                try {
                    val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phoneNumber"))
                    startActivity(intent)
                } catch (e: Exception) {
                    android.util.Log.e("NuKropBridge", "Dialer error: ${e.message}")
                }
            }
        }

        @JavascriptInterface
        fun openExternalUrl(url: String) {
            runOnUiThread {
                try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    startActivity(intent)
                } catch (e: Exception) {
                    android.util.Log.e("NuKropBridge", "External URL error: ${e.message}")
                }
            }
        }

        @JavascriptInterface
        fun postSystemNotification(title: String, message: String) {
            runOnUiThread {
                showSystemNotification(title, message)
            }
        }

        @JavascriptInterface
        fun launchGoogleSignIn(authUrl: String) {
            runOnUiThread {
                try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(authUrl))
                    startActivity(intent)
                } catch (e: Exception) {
                    android.util.Log.e("NuKropAuth", "Failed to launch Google auth: ${e.message}")
                }
            }
        }

        @JavascriptInterface
        fun pickDeviceGoogleAccount() {
            runOnUiThread {
                try {
                    val intent = android.accounts.AccountManager.newChooseAccountIntent(
                        null,
                        null,
                        arrayOf("com.google"),
                        false,
                        null,
                        null,
                        null,
                        null
                    )
                    startActivityForResult(intent, 1009)
                } catch (e: Exception) {
                    android.util.Log.e("NuKropAuth", "Account picker error: ${e.message}")
                    try {
                        val accounts = android.accounts.AccountManager.get(this@MainActivity).getAccountsByType("com.google")
                        if (accounts.isNotEmpty()) {
                            val email = accounts[0].name
                            val name = email.substringBefore("@").replace(".", " ").split(" ").joinToString(" ") { it.replaceFirstChar { c -> c.uppercase() } }
                            webView.evaluateJavascript("if(window.onNativeGoogleAccountSelected) window.onNativeGoogleAccountSelected('$email', '$name')", null)
                        } else {
                            webView.evaluateJavascript("if(window.onNativeGoogleAccountNotFound) window.onNativeGoogleAccountNotFound()", null)
                        }
                    } catch (ex: Exception) {
                        webView.evaluateJavascript("if(window.onNativeGoogleAccountNotFound) window.onNativeGoogleAccountNotFound()", null)
                    }
                }
            }
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 1009 && resultCode == Activity.RESULT_OK && data != null) {
            val accountName = data.getStringExtra(android.accounts.AccountManager.KEY_ACCOUNT_NAME)
            if (!accountName.isNullOrEmpty()) {
                val name = accountName.substringBefore("@").replace(".", " ").split(" ").joinToString(" ") { it.replaceFirstChar { c -> c.uppercase() } }
                webView.evaluateJavascript("if(window.onNativeGoogleAccountSelected) window.onNativeGoogleAccountSelected('$accountName', '$name')", null)
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "NuKropAI Farmer Alerts"
            val descriptionText = "Real-time crop disease alerts, mandi prices, and weather warnings"
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
                enableLights(true)
                enableVibration(true)
                setShowBadge(true)
            }
            val notificationManager: NotificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    fun showSystemNotification(title: String, message: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                return
            }
        }

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            System.currentTimeMillis().toInt(),
            intent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        )

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification_leaf)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)

        try {
            with(NotificationManagerCompat.from(this)) {
                notify(System.currentTimeMillis().toInt(), builder.build())
            }
        } catch (e: SecurityException) {
            // Ignored if permission revoked
        }
    }

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (filePathCallback != null) {
            var results: Array<Uri>? = null
            if (result.resultCode == Activity.RESULT_OK) {
                val data = result.data
                if (data != null && (data.data != null || data.clipData != null)) {
                    if (data.clipData != null) {
                        val count = data.clipData!!.itemCount
                        results = Array(count) { i -> data.clipData!!.getItemAt(i).uri }
                    } else if (data.data != null) {
                        results = arrayOf(data.data!!)
                    }
                } else if (cameraPhotoUri != null) {
                    // Direct camera photo captured
                    results = arrayOf(cameraPhotoUri!!)
                }
            }
            filePathCallback?.onReceiveValue(results)
            filePathCallback = null
            cameraPhotoUri = null
        }
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        if (permissions[Manifest.permission.CAMERA] == true) {
            webView.evaluateJavascript("if (typeof onNativeCameraPermissionGranted === 'function') onNativeCameraPermissionGranted();", null)
        }
        if (permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true || permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true) {
            fetchAndSendLocationToWebView()
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && permissions[Manifest.permission.POST_NOTIFICATIONS] == true) {
            webView.evaluateJavascript("if (typeof onNativeNotificationPermissionGranted === 'function') onNativeNotificationPermissionGranted();", null)
        }
    }

    fun fetchAndSendLocationToWebView() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            val locationManager = getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return

            // 1. Immediately send best cached location
            val lastGps = try { locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER) } catch (e: Exception) { null }
            val lastNet = try { locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER) } catch (e: Exception) { null }
            val bestLocation = lastGps ?: lastNet

            if (bestLocation != null) {
                val lat = bestLocation.latitude
                val lon = bestLocation.longitude
                runOnUiThread {
                    webView.evaluateJavascript("if (typeof onNativeLocationReceived === 'function') onNativeLocationReceived($lat, $lon);", null)
                }
            }

            // 2. Also request fresh hardware GPS fix
            try {
                val provider = if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) LocationManager.GPS_PROVIDER else LocationManager.NETWORK_PROVIDER
                locationManager.requestSingleUpdate(provider, object : LocationListener {
                    override fun onLocationChanged(loc: Location) {
                        runOnUiThread {
                            webView.evaluateJavascript("if (typeof onNativeLocationReceived === 'function') onNativeLocationReceived(${loc.latitude}, ${loc.longitude});", null)
                        }
                    }
                    @Deprecated("Deprecated in Java")
                    override fun onStatusChanged(p: String?, s: Int, b: Bundle?) {}
                    override fun onProviderEnabled(p: String) {}
                    override fun onProviderDisabled(p: String) {}
                }, Looper.getMainLooper())
            } catch (e: Exception) {
                // Ignore fallback
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Create System Notification Channel
        createNotificationChannel()

        // Enable true Edge-to-Edge display (immersive transparent status & navigation bars)
        androidx.core.view.WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = android.graphics.Color.TRANSPARENT
        window.navigationBarColor = android.graphics.Color.TRANSPARENT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes.layoutInDisplayCutoutMode =
                android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }

        // Create full-screen hardware-accelerated WebView
        webView = WebView(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setLayerType(View.LAYER_TYPE_HARDWARE, null)
            scrollBarStyle = View.SCROLLBARS_INSIDE_OVERLAY
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            setBackgroundColor(android.graphics.Color.TRANSPARENT)

            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                allowFileAccess = true
                allowContentAccess = true
                // Security: disable cross-origin file access for production
                @Suppress("DEPRECATION")
                allowFileAccessFromFileURLs = false
                @Suppress("DEPRECATION")
                allowUniversalAccessFromFileURLs = false
                mediaPlaybackRequiresUserGesture = false
                // Required for loading local assets that may reference HTTPS resources
                mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
                cacheMode = WebSettings.LOAD_DEFAULT
                useWideViewPort = true
                loadWithOverviewMode = true
                setSupportZoom(false)
                builtInZoomControls = false
                displayZoomControls = false
                setGeolocationEnabled(true)
                setSupportMultipleWindows(true)
                javaScriptCanOpenWindowsAutomatically = true
            }

            // Only enable WebView debugging in debug builds
            if (android.os.Build.TYPE == "eng" || BuildConfig.DEBUG) {
                WebView.setWebContentsDebuggingEnabled(true)
            }

            // Expose native bridge to Javascript
            addJavascriptInterface(WebAppInterface(), "AndroidBridge")

            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                    android.util.Log.d("NuKropWebView", "[JS] ${consoleMessage?.message()} (line ${consoleMessage?.lineNumber()})")
                    return super.onConsoleMessage(consoleMessage)
                }
                override fun onJsAlert(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
                    result?.confirm()
                    return true
                }
                override fun onJsConfirm(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
                    result?.confirm()
                    return true
                }
                override fun onJsPrompt(view: WebView?, url: String?, message: String?, defaultValue: String?, result: JsPromptResult?): Boolean {
                    result?.confirm()
                    return true
                }

                // Auto-grant Camera & Microphone for live crop scanner stream
                override fun onPermissionRequest(request: PermissionRequest) {
                    runOnUiThread {
                        request.grant(request.resources)
                    }
                }

                // Auto-grant Geolocation for Live Mandi Rates & Weather Radar
                override fun onGeolocationPermissionsShowPrompt(
                    origin: String,
                    callback: GeolocationPermissions.Callback
                ) {
                    callback.invoke(origin, true, false)
                }

                // Handle window.open to launch device browser for government schemes & external portals
                override fun onCreateWindow(
                    view: WebView?,
                    isDialog: Boolean,
                    isUserGesture: Boolean,
                    resultMsg: android.os.Message?
                ): Boolean {
                    val transport = resultMsg?.obj as? WebView.WebViewTransport ?: return false
                    val tempWebView = WebView(this@MainActivity)
                    tempWebView.webViewClient = object : WebViewClient() {
                        override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                            val targetUrl = request?.url?.toString() ?: return false
                            try {
                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(targetUrl))
                                startActivity(intent)
                            } catch (e: Exception) {}
                            return true
                        }
                    }
                    transport.webView = tempWebView
                    resultMsg.sendToTarget()
                    return true
                }

                // HTML5 Video Fullscreen Support
                override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                    if (customView != null) {
                        onHideCustomView()
                        return
                    }
                    customView = view
                    customViewCallback = callback
                    webView.visibility = View.GONE
                    rootContainer.addView(
                        view,
                        ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                    )
                }

                override fun onHideCustomView() {
                    if (customView == null) return
                    rootContainer.removeView(customView)
                    customView = null
                    webView.visibility = View.VISIBLE
                    customViewCallback?.onCustomViewHidden()
                    customViewCallback = null
                }

                // Native Camera Snap & File Chooser for Scanner and Community Media
                override fun onShowFileChooser(
                    webView: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?
                ): Boolean {
                    this@MainActivity.filePathCallback?.onReceiveValue(null)
                    this@MainActivity.filePathCallback = filePathCallback

                    // Prepare native Camera Intent
                    val takePictureIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
                    var photoFile: File? = null
                    try {
                        val storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES)
                        photoFile = File.createTempFile("crop_scan_${System.currentTimeMillis()}", ".jpg", storageDir)
                        cameraPhotoUri = FileProvider.getUriForFile(
                            this@MainActivity,
                            "${applicationContext.packageName}.provider",
                            photoFile
                        )
                        takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraPhotoUri)
                    } catch (ex: IOException) {
                        cameraPhotoUri = null
                    }

                    // Prepare Gallery Intent with Image & Video mime support
                    val acceptTypes = fileChooserParams?.acceptTypes
                    val isVideoRequested = acceptTypes?.any { it.contains("video", ignoreCase = true) } == true
                    val isImageRequested = acceptTypes?.any { it.contains("image", ignoreCase = true) } == true

                    val pickIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        if (isVideoRequested && !isImageRequested) {
                            type = "video/*"
                        } else if (isImageRequested && !isVideoRequested) {
                            type = "image/*"
                        } else {
                            type = "*/*"
                            putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/*", "video/*"))
                        }
                    }

                    // Build System Chooser with Camera + Gallery options
                    val chooserIntent = Intent(Intent.ACTION_CHOOSER).apply {
                        putExtra(Intent.EXTRA_INTENT, pickIntent)
                        putExtra(Intent.EXTRA_TITLE, "Select Field Media or Capture")
                        if (photoFile != null) {
                            putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(takePictureIntent))
                        }
                    }

                    try {
                        fileChooserLauncher.launch(chooserIntent)
                    } catch (e: Exception) {
                        this@MainActivity.filePathCallback = null
                        return false
                    }
                    return true
                }
            }

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    if (request == null || !request.isForMainFrame) {
                        return false
                    }
                    val url = request.url?.toString() ?: return false
                    // Keep internal app assets and data schemas inside local WebView
                    if (url.startsWith("file://") || url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("about:") || url.startsWith("javascript:")) {
                        return false
                    }
                    // For external web links: launch device browser/app!
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        startActivity(intent)
                        return true
                    } catch (e: Exception) {
                        return true
                    }
                }

                override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                    super.onReceivedError(view, request, error)
                    android.util.Log.e("NuKropWebView", "WebView load error: ${error?.description} on ${request?.url}")
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                }
            }

            loadUrl("file:///android_asset/index.html")
        }

        rootContainer = android.widget.FrameLayout(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
        rootContainer.addView(webView)
        setContentView(rootContainer)

        ViewCompat.setOnApplyWindowInsetsListener(rootContainer) { _, insets ->
            val statusBarHeight = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top
            val navBarHeight = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom
            val density = resources.displayMetrics.density
            val topDp = (statusBarHeight / density).toInt().coerceAtLeast(44)
            val bottomDp = (navBarHeight / density).toInt().coerceAtLeast(16)
            webView.evaluateJavascript(
                "document.documentElement.style.setProperty('--sat', '${topDp}px'); document.documentElement.style.setProperty('--sab', '${bottomDp}px');",
                null
            )
            insets
        }

        // Handle Android physical/gesture back button
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (customView != null) {
                    rootContainer.removeView(customView)
                    customView = null
                    webView.visibility = View.VISIBLE
                    customViewCallback?.onCustomViewHidden()
                    customViewCallback = null
                    return
                }

                // If live camera is running or modal open, close it cleanly
                webView.evaluateJavascript(
                    """
                    (function() {
                      if (typeof stopLiveCameraStream === 'function') {
                        stopLiveCameraStream();
                      }
                      const modals = document.querySelectorAll('[id$="-modal"], .custom-modal-overlay');
                      for (let m of modals) {
                        if (m && m.style.display === 'flex') {
                          m.style.display = 'none';
                          return true;
                        }
                      }
                      if (typeof currentScreenKey !== 'undefined' && currentScreenKey !== 'home') {
                        if (typeof openScreen === 'function') {
                          openScreen('home');
                          return true;
                        }
                      }
                      return false;
                    })();
                    """.trimIndent()
                ) { result ->
                    if (result != "true") {
                        if (webView.canGoBack()) {
                            webView.goBack()
                        } else {
                            isEnabled = false
                            onBackPressedDispatcher.onBackPressed()
                        }
                    }
                }
            }
        })

        // Check for deep link on cold launch
        handleAuthDeepLink(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleAuthDeepLink(intent)
    }

    private fun handleAuthDeepLink(intent: Intent?) {
        val uri = intent?.data ?: return
        if (uri.scheme == "nukrop" && uri.host == "auth-callback") {
            val fullUrl = uri.toString()
            webView.evaluateJavascript("if (typeof handleAuthCallback === 'function') handleAuthCallback('$fullUrl');", null)
        }
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        fetchAndSendLocationToWebView()
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
        webView.evaluateJavascript("if (typeof stopLiveCameraStream === 'function') stopLiveCameraStream();", null)
    }

    override fun onDestroy() {
        webView.stopLoading()
        webView.clearHistory()
        webView.removeAllViews()
        webView.destroy()
        super.onDestroy()
    }
}
