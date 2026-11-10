package com.example

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Opacity
import androidx.compose.material.icons.filled.SettingsInputComponent
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*
import com.example.satellite.SatelliteTelemetryManager

@Composable
fun FarmDigitalTwinScreen(modifier: Modifier = Modifier) {
    var ndviScore by remember { mutableStateOf("Loading NDVI...") }
    var soilMoisture by remember { mutableStateOf("Loading Moisture...") }
    var autoPilotIrrigation by remember { mutableStateOf(true) }

    var valve1Open by remember { mutableStateOf(true) }
    var valve2Open by remember { mutableStateOf(false) }
    var valve3Open by remember { mutableStateOf(false) }
    
    var moisture1 by remember { mutableStateOf(32) }
    var moisture2 by remember { mutableStateOf(52) }
    var moisture3 by remember { mutableStateOf(48) }

    // What-If Sandbox
    var sandboxCrop by remember { mutableStateOf("Tomato") }
    var sandboxSize by remember { mutableFloatStateOf(3f) }
    var runningSimulation by remember { mutableStateOf(false) }
    var simulationResult by remember { mutableStateOf<String?>(null) }

    // Pre-Harvest Loan
    var generatingCertificate by remember { mutableStateOf(false) }
    var certificateData by remember { mutableStateOf<String?>(null) }
    var loanApproved by remember { mutableStateOf(false) }
    
    LaunchedEffect(Unit) {
        ndviScore = SatelliteTelemetryManager.fetchNDVI(28.7041, 77.1025)
        soilMoisture = SatelliteTelemetryManager.getSoilMoisture(28.7041, 77.1025)
    }

    LaunchedEffect(autoPilotIrrigation) {
        while (true) {
            kotlinx.coroutines.delay(4000)
            
            if (autoPilotIrrigation) {
                if (moisture1 < 40) valve1Open = true
                if (moisture1 > 60) valve1Open = false
                
                if (moisture2 < 40) valve2Open = true
                if (moisture2 > 60) valve2Open = false
                
                if (moisture3 < 40) valve3Open = true
                if (moisture3 > 60) valve3Open = false
            }
            
            moisture1 = if (valve1Open) (moisture1 + 3).coerceAtMost(100) else (moisture1 - 1).coerceAtLeast(10)
            moisture2 = if (valve2Open) (moisture2 + 3).coerceAtMost(100) else (moisture2 - 1).coerceAtLeast(10)
            moisture3 = if (valve3Open) (moisture3 + 3).coerceAtMost(100) else (moisture3 - 1).coerceAtLeast(10)
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(NuKropDark)
            .statusBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Column {
            Text(
                text = "Farm Digital Twin",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = NuKropText
            )
            Text(
                text = "Satellite Multi-spectral & Irrigation Control",
                style = MaterialTheme.typography.bodyMedium,
                color = NuKropTextMuted
            )
        }

        // NDVI Map Visual
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(180.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(NuKropCard)
                .border(1.dp, Color(0x10FFFFFF), RoundedCornerShape(16.dp)),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    imageVector = Icons.Default.Map,
                    contentDescription = null,
                    modifier = Modifier.size(48.dp),
                    tint = NuKropAccent.copy(alpha = 0.5f)
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text("Sentinel-2 Live Crop Health Map", color = NuKropText, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                Text("NDVI Score: $ndviScore • Soil Moisture: $soilMoisture", color = NuKropTextMuted, fontSize = 11.sp)
            }
        }

        // What-If Sandbox Card
        Card(
            colors = CardDefaults.cardColors(containerColor = NuKropCard),
            modifier = Modifier.fillMaxWidth().border(1.dp, Color(0x15FFFFFF), RoundedCornerShape(16.dp))
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("What-If Crop Simulation Sandbox", fontWeight = FontWeight.Bold, color = NuKropText, fontSize = 15.sp)
                Spacer(Modifier.height(4.dp))
                Text("Run ML simulations to forecast yield loss against weather warnings.", fontSize = 11.sp, color = NuKropTextMuted)
                
                Spacer(Modifier.height(12.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("Tomato", "Wheat", "Rice", "Cotton").forEach { crop ->
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (sandboxCrop == crop) NuKropAccent else NuKropSurface)
                                .clickable { sandboxCrop = crop }
                                .padding(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Text(crop, color = if (sandboxCrop == crop) NuKropDark else NuKropText, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
                
                Spacer(Modifier.height(12.dp))
                Text("Field Size: ${String.format(java.util.Locale.US, "%.1f", sandboxSize)} Acres", fontSize = 12.sp, color = NuKropText)
                Slider(
                    value = sandboxSize,
                    onValueChange = { sandboxSize = it },
                    valueRange = 1f..10f,
                    colors = SliderDefaults.colors(
                        thumbColor = NuKropAccent,
                        activeTrackColor = NuKropAccent,
                        inactiveTrackColor = NuKropSurface
                    )
                )
                
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = {
                        runningSimulation = true
                        simulationResult = null
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = NuKropAccent)
                ) {
                    if (runningSimulation) {
                        CircularProgressIndicator(color = NuKropDark, modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                    } else {
                        Text("Run Yield & Heatwave Simulation", color = NuKropDark, fontWeight = FontWeight.Bold)
                    }
                }
                
                // Simulated execution
                if (runningSimulation) {
                    LaunchedEffect(Unit) {
                        kotlinx.coroutines.delay(2000)
                        runningSimulation = false
                        simulationResult = "SIMULATION RESULTS FOR ${sandboxCrop.uppercase()}:\n" +
                                "• Yield Loss Risk: 14% loss projected if planted tomorrow due to forecasted heatwave on Day 12.\n" +
                                "• Recommendation: Delay sowing by 8 days (optimal date June 2nd).\n" +
                                "• AI Soil Strategy: Boost Potassium NPK feeding by 12% to enhance heat-stress cell resistance."
                    }
                }
                
                simulationResult?.let { result ->
                    Spacer(Modifier.height(12.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFF2E2C1A))
                            .border(1.dp, NuKropWarning.copy(alpha=0.3f), RoundedCornerShape(8.dp))
                            .padding(12.dp)
                    ) {
                        Text(result, color = NuKropWarning, fontSize = 12.sp, lineHeight = 18.sp)
                    }
                }
            }
        }

        // AI Yield & Pre-Harvest Financing Certificate Card
        Card(
            colors = CardDefaults.cardColors(containerColor = NuKropCard),
            modifier = Modifier.fillMaxWidth().border(1.dp, Color(0x15FFFFFF), RoundedCornerShape(16.dp))
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("AI Yield & Pre-Harvest Finance", fontWeight = FontWeight.Bold, color = NuKropText, fontSize = 15.sp)
                Spacer(Modifier.height(4.dp))
                Text("Use Google Earth Engine NDVI analysis and mandi trends to generate a bank-grade credit certificate.", fontSize = 11.sp, color = NuKropTextMuted)
                
                Spacer(Modifier.height(12.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(NuKropSurface)
                        .padding(12.dp)
                ) {
                    Column {
                        Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                            Text("Current NDVI score", fontSize = 11.sp, color = NuKropTextMuted)
                            Text("0.76 (Optimal Health)", fontSize = 11.sp, color = NuKropBadgeGreen, fontWeight = FontWeight.Bold)
                        }
                        Spacer(Modifier.height(4.dp))
                        Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                            Text("Estimated Yield", fontSize = 11.sp, color = NuKropTextMuted)
                            Text("4.2 Tons / Acre", fontSize = 11.sp, color = NuKropText, fontWeight = FontWeight.Bold)
                        }
                        Spacer(Modifier.height(4.dp))
                        Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                            Text("Projected Mandi Value", fontSize = 11.sp, color = NuKropTextMuted)
                            Text("₹88,200", fontSize = 11.sp, color = NuKropAccent, fontWeight = FontWeight.Bold)
                        }
                    }
                }
                
                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = {
                        generatingCertificate = true
                        certificateData = null
                        loanApproved = false
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = NuKropAccent)
                ) {
                    if (generatingCertificate) {
                        CircularProgressIndicator(color = NuKropDark, modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                    } else {
                        Text("Generate Lending Certificate", color = NuKropDark, fontWeight = FontWeight.Bold)
                    }
                }
                
                if (generatingCertificate) {
                    LaunchedEffect(Unit) {
                        kotlinx.coroutines.delay(2000)
                        generatingCertificate = false
                        certificateData = "VERIFIED LENDING CERTIFICATE\n" +
                                "Certificate ID: NK-89240-GEE\n" +
                                "Issuer: Google Earth Engine Satellite API & NuKrop AI\n" +
                                "Collateral Valuation: ₹88,200\n" +
                                "Verify Sign: [SHA256 Signed Hash]"
                    }
                }
                
                certificateData?.let { data ->
                    Spacer(Modifier.height(12.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFF1B2C1A))
                            .border(1.dp, NuKropBadgeGreen.copy(alpha=0.3f), RoundedCornerShape(8.dp))
                            .padding(12.dp)
                    ) {
                        Column {
                            Text(data, color = NuKropBadgeGreen, fontSize = 12.sp, lineHeight = 18.sp)
                            Spacer(Modifier.height(8.dp))
                            Button(
                                onClick = { loanApproved = true },
                                modifier = Modifier.fillMaxWidth(),
                                colors = ButtonDefaults.buttonColors(containerColor = NuKropAccent)
                            ) {
                                Text("Apply for Micro-Loan (₹45,000)", color = NuKropDark, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
                
                if (loanApproved) {
                    Spacer(Modifier.height(8.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(NuKropBadgeGreen.copy(alpha = 0.2f))
                            .padding(12.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("🎉 Loan Approved! ₹45,000 sent to mobile wallet instantly.", color = NuKropBadgeGreen, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        // Smart Micro-Irrigation Controls
        Card(
            colors = CardDefaults.cardColors(containerColor = NuKropCard),
            modifier = Modifier.fillMaxWidth().border(1.dp, NuKropAccent.copy(alpha = 0.3f), RoundedCornerShape(16.dp))
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Default.Opacity, null, tint = NuKropAccent, modifier = Modifier.size(20.dp))
                        Text("Smart Micro-Irrigation", fontWeight = FontWeight.Bold, color = NuKropText, fontSize = 14.sp)
                    }
                    
                    Switch(
                        checked = autoPilotIrrigation,
                        onCheckedChange = { autoPilotIrrigation = it },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = NuKropDark,
                            checkedTrackColor = NuKropAccent,
                            uncheckedThumbColor = NuKropTextDim,
                            uncheckedTrackColor = NuKropSurface
                        )
                    )
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    text = if (autoPilotIrrigation) "AI Auto-Pilot: Adjusting valves live based on weather forecasts & subsoil sensors."
                           else "Manual Mode: Valves must be controlled manually. Click a valve to toggle it.",
                    fontSize = 11.sp,
                    color = NuKropTextMuted,
                    lineHeight = 15.sp
                )
                
                Spacer(Modifier.height(16.dp))
                HorizontalDivider(color = Color(0x10FFFFFF))
                Spacer(Modifier.height(12.dp))

                // Valve list
                ValveRow(
                    name = "Valve 01 (Northeast)",
                    details = "Moisture: ${moisture1}% (${if (moisture1 < 40) "Critical" else "Optimal"})",
                    status = if (valve1Open) (if (autoPilotIrrigation) "AI OPENING (2.5 L/min)" else "MANUAL OPEN") else "CLOSED",
                    statusColor = if (valve1Open) NuKropWarning else NuKropTextMuted,
                    onClick = { if (!autoPilotIrrigation) valve1Open = !valve1Open }
                )
                Spacer(Modifier.height(10.dp))
                ValveRow(
                    name = "Valve 02 (Northwest)",
                    details = "Moisture: ${moisture2}% (${if (moisture2 < 40) "Critical" else "Optimal"})",
                    status = if (valve2Open) (if (autoPilotIrrigation) "AI OPENING (2.5 L/min)" else "MANUAL OPEN") else "CLOSED",
                    statusColor = if (valve2Open) NuKropWarning else NuKropBadgeGreen,
                    onClick = { if (!autoPilotIrrigation) valve2Open = !valve2Open }
                )
                Spacer(Modifier.height(10.dp))
                ValveRow(
                    name = "Valve 03 (South Field)",
                    details = "Moisture: ${moisture3}% (${if (moisture3 < 40) "Critical" else "Optimal"})",
                    status = if (valve3Open) (if (autoPilotIrrigation) "AI OPENING (2.5 L/min)" else "MANUAL OPEN") else "CLOSED",
                    statusColor = if (valve3Open) NuKropWarning else NuKropBadgeGreen,
                    onClick = { if (!autoPilotIrrigation) valve3Open = !valve3Open }
                )

                Spacer(Modifier.height(16.dp))
                HorizontalDivider(color = Color(0x10FFFFFF))
                Spacer(Modifier.height(12.dp))

                Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                    Column {
                        Text("Water Savings Today", fontSize = 10.sp, color = NuKropTextMuted)
                        Text("34% saved vs Flood", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NuKropBadgeGreen)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("Next Auto Cycle", fontSize = 10.sp, color = NuKropTextMuted)
                        Text("May 24, 06:00 AM", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NuKropAccent)
                    }
                }
            }
        }

        // Moisture alerts from sensors/satellites
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF331D1C))
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(Icons.Default.Warning, contentDescription = null, tint = NuKropError)
                Spacer(modifier = Modifier.width(16.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text("Moisture Stress Alert", fontWeight = FontWeight.Bold, color = NuKropError, fontSize = 14.sp)
                    Text("Sector 4 is showing high moisture stress (NDVI drop 8%). Open Valve 04 manually if auto-irrigation is disabled.", style = MaterialTheme.typography.bodySmall, color = NuKropTextMuted, lineHeight = 16.sp)
                }
            }
        }
        Spacer(modifier = Modifier.height(80.dp))
    }
}

@Composable
fun ValveRow(name: String, details: String, status: String, statusColor: Color, onClick: () -> Unit = {}) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable { onClick() },
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(name, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = NuKropText, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
            Text(details, fontSize = 11.sp, color = NuKropTextMuted, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
        }
        Spacer(Modifier.width(8.dp))
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(statusColor.copy(alpha = 0.15f))
                .padding(horizontal = 10.dp, vertical = 6.dp)
        ) {
            Text(status, color = statusColor, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
    }
}
