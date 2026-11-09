package com.example

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Warning
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
import com.example.bioshield.BioShieldRadarEngine
import com.example.bioshield.GeoLocationPoint
import com.example.bioshield.OutbreakCluster
import com.example.bioshield.OutbreakRiskLevel
import com.example.ui.theme.*

@Composable
fun BioShieldRadarScreen(onNavigateBack: () -> Unit) {
    val scrollState = rememberScrollState()

    var activeCluster by remember { mutableStateOf<OutbreakCluster?>(null) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        val cluster = BioShieldRadarEngine.getLiveOrEvaluatedCluster(
            state = "Andhra Pradesh",
            district = "Guntur",
            latitude = 16.3067,
            longitude = 80.4365,
            diseaseName = "Paddy Blast Fungal Blight",
            cropName = "Paddy / Rice"
        )
        activeCluster = cluster
        isLoading = false
    }

    val displayCluster = activeCluster ?: remember {
        BioShieldRadarEngine.evaluateOutbreakCluster(
            scanCoordinates = listOf(
                Pair(16.3067, 80.4365),
                Pair(16.3120, 80.4410),
                Pair(16.2990, 80.4300),
                Pair(16.3200, 80.4500)
            ),
            diseaseName = "Paddy Blast Fungal Blight",
            cropName = "Paddy / Rice",
            epicenter = GeoLocationPoint(16.3067, 80.4365, "Guntur District", "Andhra Pradesh"),
            humidityPct = 88.0,
            leafWetnessHours = 9.5
        )
    }

    val ndviScore = (displayCluster?.ndviStressIndex ?: 0.54).toFloat()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(Color(0xFF0D1409), NuKropDark)))
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xCC141A0A))
                .statusBarsPadding()
                .padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onNavigateBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = NuKropText)
            }
            Spacer(Modifier.width(4.dp))
            Column {
                Text("BioShield Radar", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                Text("Spatial-Temporal Outbreak Defense", fontSize = 11.sp, color = NuKropAccent)
            }
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(scrollState)
                .padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 120.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Radar Status Banner
            displayCluster?.let { cluster ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color(cluster.riskSeverity.badgeColorHex).copy(alpha = 0.15f))
                        .border(1.dp, Color(cluster.riskSeverity.badgeColorHex).copy(alpha = 0.4f), RoundedCornerShape(16.dp))
                        .padding(16.dp)
                ) {
                    Column {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Warning, contentDescription = null, tint = Color(cluster.riskSeverity.badgeColorHex))
                                Spacer(Modifier.width(8.dp))
                                Text(cluster.riskSeverity.label, color = Color(cluster.riskSeverity.badgeColorHex), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                            Text("${cluster.radiusKm.toInt()} km Radius", color = NuKropTextMuted, fontSize = 11.sp)
                        }
                        Spacer(Modifier.height(8.dp))
                        Text("Contagious Vector: ${cluster.diseaseName}", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                        Text("Epicenter: ${cluster.epicenter.districtName}, ${cluster.epicenter.stateName}", fontSize = 12.sp, color = NuKropTextMuted)
                        Spacer(Modifier.height(8.dp))
                        Text(
                            "${cluster.totalScansDetected} verified farm scans detected within 48h. Microclimate conditions (${cluster.avgMicroclimateHumidity.toInt()}% humidity) favor spore dispersion.",
                            fontSize = 12.sp,
                            color = NuKropTextDim,
                            lineHeight = 18.sp
                        )
                    }
                }
            }

            // Multispectral & NDVI Stress Card
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(NuKropCard)
                    .border(1.dp, NuKropAccent.copy(alpha = 0.2f), RoundedCornerShape(16.dp))
                    .padding(16.dp)
            ) {
                Column {
                    Text("🛰️ Satellite NDVI Crop Stress Index", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NuKropAccent)
                    Spacer(Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Current NDVI Score", fontSize = 11.sp, color = NuKropTextMuted)
                            val stressLabel = if (ndviScore < 0.45f) "Severe Stress" else if (ndviScore < 0.65f) "Stress Detected" else "Healthy Canopy"
                            val stressColor = if (ndviScore < 0.45f) NuKropWarning else if (ndviScore < 0.65f) NuKropWarning else NuKropBadgeGreen
                            Text("$ndviScore ($stressLabel)", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = stressColor)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("Baseline Healthy NDVI", fontSize = 11.sp, color = NuKropTextMuted)
                            Text("0.75 - 0.85 (Optimal)", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = NuKropBadgeGreen)
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    LinearProgressIndicator(
                        progress = { ndviScore },
                        modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
                        color = if (ndviScore < 0.60f) NuKropWarning else NuKropBadgeGreen,
                        trackColor = Color(0x30FFFFFF),
                    )
                }
            }

            // Preemptive Bio-Defense Action Plan
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(NuKropCard)
                    .border(1.dp, NuKropBadgeGreen.copy(alpha = 0.3f), RoundedCornerShape(16.dp))
                .padding(16.dp)
            ) {
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Shield, contentDescription = null, tint = NuKropBadgeGreen, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Preemptive Bio-Defense Barrier Protocol", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NuKropBadgeGreen)
                    }
                    Spacer(Modifier.height(10.dp))
                    Text(
                        displayCluster?.bioDefenseActionPlan ?: "Deploy bio-barriers along ridge perimeter to prevent vector infiltration.",
                        fontSize = 13.sp,
                        color = NuKropText,
                        lineHeight = 20.sp
                    )
                    Spacer(Modifier.height(12.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Estimated Containment: ${displayCluster?.estimatedContainmentDays ?: 10} Days", fontSize = 11.sp, color = NuKropTextMuted)
                        Text("Community Shield: Active", fontSize = 11.sp, color = NuKropBadgeGreen, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
