package com.example

import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.provider.MediaStore
import android.webkit.MimeTypeMap
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Description
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

data class SavedReport(
    val uri: Uri,
    val name: String,
    val dateModified: Long,
    val size: Long
)

@Composable
fun SavedReportsScreen(onNavigateBack: () -> Unit) {
    val context = LocalContext.current
    var reports by remember { mutableStateOf<List<SavedReport>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        try {
            withContext(Dispatchers.IO) {
                val reportList = mutableListOf<SavedReport>()
                val baseProjection = mutableListOf(
                    MediaStore.Files.FileColumns._ID,
                    MediaStore.Files.FileColumns.DISPLAY_NAME,
                    MediaStore.Files.FileColumns.DATE_MODIFIED,
                    MediaStore.Files.FileColumns.SIZE
                )
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                    baseProjection.add(MediaStore.Files.FileColumns.RELATIVE_PATH)
                }
                val projection = baseProjection.toTypedArray()
                val selection = "${MediaStore.Files.FileColumns.DISPLAY_NAME} LIKE ?"
                val selectionArgs = arrayOf("NuKropAI_Report_%")
                val sortOrder = "${MediaStore.Files.FileColumns.DATE_MODIFIED} DESC"

                context.contentResolver.query(
                    MediaStore.Files.getContentUri("external"),
                    projection,
                    selection,
                    selectionArgs,
                    sortOrder
                )?.use { cursor ->
                    val idCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns._ID)
                    val nameCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DISPLAY_NAME)
                    val dateCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DATE_MODIFIED)
                    val sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.SIZE)

                    while (cursor.moveToNext()) {
                        val id = cursor.getLong(idCol)
                        val name = cursor.getString(nameCol)
                        val date = cursor.getLong(dateCol) * 1000L // convert to ms
                        val size = cursor.getLong(sizeCol)
                        val uri = Uri.withAppendedPath(MediaStore.Files.getContentUri("external"), id.toString())
                        reportList.add(SavedReport(uri, name, date, size))
                    }
                }
                reports = reportList
            }
        } catch (_: Exception) {
        } finally {
            isLoading = false
        }
    }

    var selectedReportContent by remember { mutableStateOf<String?>(null) }
    var selectedReportName by remember { mutableStateOf<String>("") }

    if (selectedReportContent != null) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFF0D1208))
                .padding(bottom = 100.dp) // padding for nav bar
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = { selectedReportContent = null }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = NuKropText)
                }
                Spacer(Modifier.width(8.dp))
                Text(selectedReportName, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = NuKropText)
            }
            rememberScrollState().let { scrollState ->
                Column(Modifier.fillMaxSize().verticalScroll(scrollState)) {
                    val crop = parseCropJson(selectedReportContent!!)
                    val soil = parseSoilJson(selectedReportContent!!)
                    if (crop != null && (crop.status.isNotEmpty() || crop.name.isNotEmpty())) {
                        CropResultUI(crop, NuKropBadgeGreen, context) // Using a fallback accent color
                    } else if (soil != null && soil.soilType.isNotEmpty()) {
                        SoilResultUI(soil, NuKropBadgeGreen, context)
                    } else {
                        // Fallback text view if it's the old .txt report format
                        RawResultFallback(selectedReportContent!!)
                    }
                }
            }
        }
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0D1208))
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onNavigateBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = NuKropText)
            }
            Spacer(Modifier.width(8.dp))
            Text("Saved Reports", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = NuKropText)
        }

        if (isLoading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = NuKropAccent)
            }
        } else if (reports.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Filled.Description, null, tint = NuKropTextMuted, modifier = Modifier.size(64.dp))
                    Spacer(Modifier.height(16.dp))
                    Text("No saved reports found.", color = NuKropTextMuted, fontSize = 16.sp)
                    Spacer(Modifier.height(8.dp))
                    Text("Scan a crop or soil to save a report.", color = NuKropTextDim, fontSize = 14.sp)
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(reports) { report ->
                    ReportCard(report) {
                        try {
                            context.contentResolver.openInputStream(report.uri)?.use { stream ->
                                val text = stream.bufferedReader().use { it.readText() }
                                selectedReportContent = text
                                selectedReportName = report.name
                            }
                        } catch (e: Exception) {
                            // ignore or toast
                        }
                    }
                }
                item { Spacer(Modifier.height(80.dp)) }
            }
        }
    }
}

@Composable
fun ReportCard(report: SavedReport, onClick: () -> Unit) {
    val dateFormat = SimpleDateFormat("MMM dd, yyyy \u2022 hh:mm a", Locale.getDefault())
    val dateString = dateFormat.format(Date(report.dateModified))
    val sizeString = if (report.size > 1024) "${report.size / 1024} KB" else "${report.size} B"

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(NuKropCard)
            .border(1.dp, Color(0x30FFFFFF), RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(16.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(NuKropAccent.copy(alpha = 0.15f))
                    .padding(12.dp)
            ) {
                Icon(Icons.Filled.Description, null, tint = NuKropAccent, modifier = Modifier.size(28.dp))
            }
            Spacer(Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = report.name,
                    color = NuKropText,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                )
                Spacer(Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(dateString, color = NuKropTextMuted, fontSize = 12.sp, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                    Text(" \u2022 ", color = NuKropTextDim, fontSize = 12.sp)
                    Text(sizeString, color = NuKropTextDim, fontSize = 12.sp)
                }
            }
        }
    }
}
