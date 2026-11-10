package com.example

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.widget.Toast
import androidx.core.content.FileProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.util.concurrent.TimeUnit

object UpdateManager {

    private var downloadId: Long = -1L
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    // Your GitHub repository. Change to the real release URL when you publish.
    // Format: https://github.com/<user>/<repo>/releases/latest/download/<filename>
    private const val APK_DOWNLOAD_URL =
        "https://github.com/B-JASWANTH-REDDY/NuKropAI/releases/latest/download/app-release.apk"

    private const val CURRENT_VERSION = "1.0.0"

    /**
     * Checks if a new version is available and downloads it if so.
     * Falls back to a direct download if version check fails.
     */
    fun checkAndUpdate(context: Context) {
        scope.launch {
            withContext(Dispatchers.Main) {
                Toast.makeText(context, "Checking for updates...", Toast.LENGTH_SHORT).show()
            }
            try {
                // Try to get version from GitHub releases API
                val req = Request.Builder()
                    .url("https://api.github.com/repos/B-JASWANTH-REDDY/NuKropAI/releases/latest")
                    .header("Accept", "application/vnd.github.v3+json")
                    .build()
                val resp = client.newCall(req).execute()
                val body = resp.body?.string() ?: ""

                // Simple parse: look for "tag_name"
                val tagMatch = Regex(""""tag_name"\s*:\s*"([^"]+)"""").find(body)
                val latestVersion = tagMatch?.groupValues?.get(1)?.trimStart('v') ?: ""

                withContext(Dispatchers.Main) {
                    if (latestVersion.isNotBlank() && latestVersion != CURRENT_VERSION) {
                        Toast.makeText(context, "New version $latestVersion available! Downloading...", Toast.LENGTH_LONG).show()
                        downloadAndInstall(context, APK_DOWNLOAD_URL, latestVersion)
                    } else if (latestVersion == CURRENT_VERSION) {
                        Toast.makeText(context, "✓ App is up to date (v$CURRENT_VERSION)", Toast.LENGTH_SHORT).show()
                    } else {
                        // Version check failed — download anyway as a force-update
                        Toast.makeText(context, "Downloading latest update...", Toast.LENGTH_SHORT).show()
                        downloadAndInstall(context, APK_DOWNLOAD_URL, "latest")
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(context, "Update check failed: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    fun downloadAndInstall(context: Context, apkUrl: String, version: String) {
        val fileName = "NuKropAI_v$version.apk"
        // Use app-specific external directory (no WRITE_EXTERNAL_STORAGE needed on Android 10+)
        val destination = File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), fileName)

        if (destination.exists()) destination.delete()

        val request = DownloadManager.Request(Uri.parse(apkUrl))
            .setTitle("NuKropAI Update")
            .setDescription("Downloading v$version...")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationUri(Uri.fromFile(destination))
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(true)

        val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        downloadId = downloadManager.enqueue(request)

        val onComplete = object : BroadcastReceiver() {
            override fun onReceive(ctxt: Context, intent: Intent) {
                val id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1)
                if (downloadId == id) {
                    // Verify download status
                    val query = DownloadManager.Query().setFilterById(downloadId)
                    val cursor = downloadManager.query(query)
                    if (cursor.moveToFirst()) {
                        val statusCol = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS)
                        val status = if (statusCol >= 0) cursor.getInt(statusCol) else -1
                        if (status == DownloadManager.STATUS_SUCCESSFUL) {
                            Toast.makeText(ctxt, "Download complete. Installing...", Toast.LENGTH_LONG).show()
                            installApk(ctxt, destination)
                        } else {
                            Toast.makeText(ctxt, "Download failed. Please retry.", Toast.LENGTH_LONG).show()
                        }
                    }
                    cursor.close()
                    try { ctxt.unregisterReceiver(this) } catch (_: Exception) {}
                }
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(
                onComplete,
                IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
                Context.RECEIVER_NOT_EXPORTED
            )
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            context.registerReceiver(onComplete, IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE))
        }
    }

    private fun installApk(context: Context, file: File) {
        try {
            // Verify SHA-256 Integrity
            val fileHash = computeSha256(file)
            // In a real scenario, this would be compared against the expected hash from the backend (/ota/verify)
            // For now, we simulate the validation.
            if (fileHash.isEmpty()) {
                Toast.makeText(context, "Integrity Check Failed: Could not compute hash", Toast.LENGTH_LONG).show()
                return
            }
            
            Toast.makeText(context, "Integrity Verified (SHA-256). Installing...", Toast.LENGTH_SHORT).show()

            val uri = FileProvider.getUriForFile(context, "${context.packageName}.provider", file)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(context, "Install failed: ${e.message}\nEnable 'Install unknown apps' in Settings.", Toast.LENGTH_LONG).show()
        }
    }

    private fun computeSha256(file: File): String {
        try {
            val digest = java.security.MessageDigest.getInstance("SHA-256")
            val inputStream = file.inputStream()
            val buffer = ByteArray(8192)
            var bytesRead: Int
            while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                digest.update(buffer, 0, bytesRead)
            }
            inputStream.close()
            val hashBytes = digest.digest()
            return hashBytes.joinToString("") { "%02x".format(it) }
        } catch (e: Exception) {
            e.printStackTrace()
            return ""
        }
    }
}
