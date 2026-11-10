package com.example

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.model.OutbreakAlert
import com.example.ui.theme.*
import kotlinx.coroutines.launch
import java.util.Locale

enum class OutbreakFilter { ALL, EPICENTER, EARLY_WARNING, CRITICAL }

@Composable
fun RegionalIntelligenceScreen(modifier: Modifier = Modifier) {
    val scope = rememberCoroutineScope()

    var alerts by remember { mutableStateOf<List<OutbreakAlert>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var filter by remember { mutableStateOf(OutbreakFilter.ALL) }

    fun refreshAlerts() {
        loading = true
        scope.launch {
            try {
                val res = DiseaseAggregationService.fetchAllActiveAlerts()
                alerts = res.getOrElse { emptyList() }
                error = null
            } catch (e: Exception) {
                error = e.message
            } finally {
                loading = false
            }
        }
    }

    LaunchedEffect(Unit) {
        refreshAlerts()
    }

    val filteredAlerts = remember(alerts, filter) {
        when (filter) {
            OutbreakFilter.ALL -> alerts
            OutbreakFilter.EPICENTER -> alerts.filter { it.alertType.equals("EPICENTER", ignoreCase = true) }
            OutbreakFilter.EARLY_WARNING -> alerts.filter { it.alertType.equals("EARLY_WARNING", ignoreCase = true) }
            OutbreakFilter.CRITICAL -> alerts.filter {
                it.severity.equals("CRITICAL", ignoreCase = true) || it.severity.equals("HIGH", ignoreCase = true)
            }
        }
    }

    val epicenterCount = alerts.count { it.alertType.equals("EPICENTER", ignoreCase = true) }
    val earlyWarningCount = alerts.count { it.alertType.equals("EARLY_WARNING", ignoreCase = true) }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF0D1208))
            .statusBarsPadding()
            .padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Header
        item {
            Column {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Regional & National Intelligence",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.ExtraBold,
                            color = NuKropText
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Live Disease Outbreak Grid & Federated Intelligence",
                            style = MaterialTheme.typography.bodyMedium,
                            color = NuKropTextMuted
                        )
                    }
                    IconButton(
                        onClick = { refreshAlerts() },
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(NuKropCard)
                    ) {
                        Icon(
                            Icons.Filled.Refresh,
                            contentDescription = "Refresh",
                            tint = NuKropAccent,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
        }

        // Summary KPI Banner
        item {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                SummaryKpiCard(
                    modifier = Modifier.weight(1f),
                    title = "Epicenters",
                    value = "$epicenterCount",
                    badgeColor = Color(0xFFEF5350),
                    icon = Icons.Filled.Warning
                )
                SummaryKpiCard(
                    modifier = Modifier.weight(1f),
                    title = "Early Warnings",
                    value = "$earlyWarningCount",
                    badgeColor = Color(0xFFFF7043),
                    icon = Icons.Filled.Radar
                )
                SummaryKpiCard(
                    modifier = Modifier.weight(1f),
                    title = "Grid Density",
                    value = "100 scans",
                    badgeColor = NuKropAccent,
                    icon = Icons.Filled.Bolt
                )
            }
        }

        // Filter Chips
        item {
            Row(
                Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutbreakFilterChip("All Outbreaks (${alerts.size})", filter == OutbreakFilter.ALL) { filter = OutbreakFilter.ALL }
                OutbreakFilterChip("Epicenters ($epicenterCount)", filter == OutbreakFilter.EPICENTER) { filter = OutbreakFilter.EPICENTER }
                OutbreakFilterChip("Early Warnings ($earlyWarningCount)", filter == OutbreakFilter.EARLY_WARNING) { filter = OutbreakFilter.EARLY_WARNING }
                OutbreakFilterChip("High / Critical Risk", filter == OutbreakFilter.CRITICAL) { filter = OutbreakFilter.CRITICAL }
            }
        }

        // Loading State
        if (loading && alerts.isEmpty()) {
            item {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(NuKropCard)
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        CircularProgressIndicator(color = NuKropAccent, modifier = Modifier.size(32.dp))
                        Text("Connecting to National Outbreak Early Warning Grid...", fontSize = 13.sp, color = NuKropTextMuted)
                    }
                }
            }
        }

        // Empty State
        if (!loading && filteredAlerts.isEmpty()) {
            item {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(NuKropBadgeGreen.copy(alpha = 0.08f))
                        .border(1.dp, NuKropBadgeGreen.copy(alpha = 0.35f), RoundedCornerShape(16.dp))
                        .padding(20.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        Box(
                            Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(NuKropBadgeGreen.copy(alpha = 0.20f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("🛡️", fontSize = 20.sp)
                        }
                        Column(Modifier.weight(1f)) {
                            Text(
                                "National Grid Status: Normal",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = NuKropBadgeGreen
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                "No active disease clusters currently exceed the 100-scan density threshold across India.",
                                fontSize = 12.sp,
                                color = NuKropTextMuted,
                                lineHeight = 17.sp
                            )
                        }
                    }
                }
            }
        }

        // Outbreak Alerts List
        items(filteredAlerts) { alert ->
            NationalOutbreakAlertCard(alert = alert)
        }

        // Section: Other Intelligence Modules
        item {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Cooperative Intelligence & Forecasting",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = NuKropText
            )
        }

        // Yield Forecasting Card
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = NuKropCard),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, Color(0x25FFFFFF)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier
                            .size(40.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(PrimaryNeon.copy(alpha = 0.15f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Insights, contentDescription = "Forecasting", tint = PrimaryNeon, modifier = Modifier.size(22.dp))
                    }
                    Spacer(modifier = Modifier.width(16.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(text = "National Yield Forecasting", fontWeight = FontWeight.Bold, color = NuKropText, fontSize = 14.sp)
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(text = "Aggregated model: +12% projected harvest for Kharif Wheat", style = MaterialTheme.typography.bodySmall, color = NuKropTextMuted)
                    }
                }
            }
        }

        // Federated Learning Card
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = NuKropCard),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, Color(0x25FFFFFF)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier
                            .size(40.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(Color(0xFF80CBC4).copy(alpha = 0.15f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Public, contentDescription = "Federated Learning", tint = Color(0xFF80CBC4), modifier = Modifier.size(22.dp))
                    }
                    Spacer(modifier = Modifier.width(16.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(text = "Federated Vision Model Sync", fontWeight = FontWeight.Bold, color = NuKropText, fontSize = 14.sp)
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(text = "Privacy-preserving edge gradients synced from 2.4M on-device scans.", style = MaterialTheme.typography.bodySmall, color = NuKropTextMuted)
                    }
                }
            }
        }
    }
}

@Composable
fun SummaryKpiCard(
    modifier: Modifier = Modifier,
    title: String,
    value: String,
    badgeColor: Color,
    icon: androidx.compose.ui.graphics.vector.ImageVector
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(NuKropCard)
            .border(1.dp, badgeColor.copy(alpha = 0.35f), RoundedCornerShape(14.dp))
            .padding(12.dp)
    ) {
        Column {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(title, fontSize = 10.sp, color = NuKropTextMuted, fontWeight = FontWeight.SemiBold)
                Icon(icon, null, tint = badgeColor, modifier = Modifier.size(14.dp))
            }
            Spacer(Modifier.height(6.dp))
            Text(value, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = NuKropText)
        }
    }
}

@Composable
fun OutbreakFilterChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Box(
        Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(if (selected) NuKropAccent else NuKropCard)
            .border(1.dp, if (selected) NuKropAccent else Color(0x30FFFFFF), RoundedCornerShape(20.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 6.dp)
    ) {
        Text(
            text = label,
            fontSize = 12.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
            color = if (selected) NuKropDark else NuKropText
        )
    }
}

@Composable
fun NationalOutbreakAlertCard(alert: OutbreakAlert) {
    val isEpicenter = alert.alertType.equals("EPICENTER", ignoreCase = true)
    val severityUpper = alert.severity.uppercase(Locale.ROOT)
    val cardColor = when (severityUpper) {
        "CRITICAL" -> Color(0xFFEF5350)
        "HIGH" -> Color(0xFFFF7043)
        "MODERATE" -> Color(0xFFFFCA28)
        else -> NuKropBadgeGreen
    }

    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(cardColor.copy(alpha = 0.10f))
            .border(1.5.dp, cardColor.copy(alpha = 0.45f), RoundedCornerShape(16.dp))
            .padding(16.dp)
    ) {
        Column {
            // Badges Row
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(if (isEpicenter) Color(0xFFD32F2F) else Color(0xFFF57C00))
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text(
                            text = if (isEpicenter) "🔴 EPICENTER" else "🟠 EARLY WARNING",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                }
                Box(
                    Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(cardColor.copy(alpha = 0.25f))
                        .padding(horizontal = 8.dp, vertical = 3.dp)
                ) {
                    Text(
                        text = "RISK: ${alert.severity}",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = cardColor
                    )
                }
            }

            Spacer(Modifier.height(10.dp))

            // Disease Name & Route
            Text(
                text = alert.diseaseName,
                fontSize = 17.sp,
                fontWeight = FontWeight.ExtraBold,
                color = NuKropText
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = if (isEpicenter) "Epicenter Region: ${alert.sourceState}" else "Origin: ${alert.sourceState} ➔ Alert Vector: ${alert.targetState}",
                fontSize = 12.sp,
                color = NuKropTextMuted,
                fontWeight = FontWeight.SemiBold
            )

            Spacer(Modifier.height(8.dp))

            // Density Threshold Trigger Details
            Box(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color(0x33000000))
                    .padding(8.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Icons.Filled.Bolt, null, tint = cardColor, modifier = Modifier.size(14.dp))
                    Text(
                        text = "Scan Density: ${alert.scanCount} scans logged (> ${alert.thresholdDensity} trigger threshold / 7 days)",
                        fontSize = 11.sp,
                        color = NuKropText,
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            Spacer(Modifier.height(8.dp))

            Text(
                text = alert.message,
                fontSize = 12.sp,
                color = NuKropText,
                lineHeight = 17.sp
            )

            if (alert.recommendedAction.isNotBlank()) {
                Spacer(Modifier.height(8.dp))
                Box(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0x20000000))
                        .padding(8.dp)
                ) {
                    Text(
                        text = "🛡️ Recommended Action: ${alert.recommendedAction}",
                        fontSize = 11.sp,
                        color = NuKropTextMuted,
                        lineHeight = 16.sp
                    )
                }
            }

            if (alert.predictedMarketImpactPct > 0) {
                Spacer(Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Icons.AutoMirrored.Filled.TrendingUp, null, tint = cardColor, modifier = Modifier.size(14.dp))
                    Text(
                        text = "Projected Mandi Price Impact: +${alert.predictedMarketImpactPct}%",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = cardColor
                    )
                }
            }
        }
    }
}
