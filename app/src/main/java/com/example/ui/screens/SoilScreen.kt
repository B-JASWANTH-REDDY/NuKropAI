package com.example

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Eco
import androidx.compose.material.icons.filled.SettingsInputAntenna
import androidx.compose.material3.*
import androidx.compose.material.icons.filled.*
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.telemetry.NuKropIotManager
import com.example.telemetry.CommandState

import androidx.compose.material.icons.filled.WaterDrop
import androidx.compose.material.icons.filled.PowerSettingsNew
import androidx.compose.material.icons.automirrored.filled.Message
import androidx.compose.material.icons.automirrored.filled.TrendingDown
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*
import com.example.agronomy.AutonomousAgronomist

@Composable
fun SoilScreen(modifier: Modifier = Modifier) {
    val iotState by NuKropIotManager.deviceState.collectAsStateWithLifecycle()
    val commandState by NuKropIotManager.commandState.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        // Connect to real WebSocket Gateway on screen load
        NuKropIotManager.connectWebSocket("smart_pump_1")
    }

    DisposableEffect(Unit) {
        onDispose { NuKropIotManager.disconnect() }
    }
    
    var autoMotorEnabled by remember { mutableStateOf(false) }
    var whatsappAlerts by remember { mutableStateOf(true) }
    var planResult by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(NuKropDark)
            .statusBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 120.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "Soil Health Intelligence",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = NuKropText
                )
                Text(
                    text = "Subsoil Probe & Carbon Sensors",
                    fontSize = 12.sp,
                    color = NuKropTextMuted
                )
            }
            
            // Sensor toggle button
            Button(onClick = { /* TODO: Launch Add Device Wizard */ }, colors = ButtonDefaults.buttonColors(containerColor = NuKropCard)) { Text("+ Add Device", color = NuKropAccent, fontSize = 12.sp) }
        }
        
        Spacer(modifier = Modifier.height(16.dp))

        // Live sensors panel
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(NuKropCard)
                .border(1.5.dp, NuKropAccent.copy(alpha = 0.4f), RoundedCornerShape(20.dp))
                .padding(16.dp)
        ) {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Default.SettingsInputAntenna, null, tint = NuKropAccent, modifier = Modifier.size(18.dp))
                        Text("📡 Live Subsoil Sensors Active", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = NuKropText)
                    }
                    Box(Modifier.clip(RoundedCornerShape(8.dp)).background(NuKropBadgeGreen.copy(alpha=0.15f)).padding(horizontal = 8.dp, vertical = 4.dp)) {
                        Text(iotState.status.uppercase(), fontSize = 10.sp, color = if (iotState.status == "online") NuKropBadgeGreen else NuKropError, fontWeight = FontWeight.Bold)
                    }
                }
                Spacer(Modifier.height(16.dp))
                
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    SensorTile(Modifier.weight(1f), "Nitrogen (N)", "45 mg/kg", "Optimal", NuKropBadgeGreen)
                    SensorTile(Modifier.weight(1f), "Phosphorus (P)", "18 mg/kg", "Low", NuKropWarning)
                }
                Spacer(Modifier.height(10.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    SensorTile(Modifier.weight(1f), "Potassium (K)", "162 mg/kg", "Optimal", NuKropBadgeGreen)
                    SensorTile(Modifier.weight(1f), "Organic Carbon", "1.85%", "Below Target (>2%)", NuKropWarning)
                }
                Spacer(Modifier.height(10.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    SensorTile(Modifier.weight(1f), "Soil pH", "6.4", "Slightly Acidic", NuKropAccent)
                    SensorTile(Modifier.weight(1f), "Soil Moisture", iotState.moisture.toString() + "%", "Good", NuKropBadgeGreen)
                }
            }
        }

        // AI Irrigation Automation
        Spacer(modifier = Modifier.height(24.dp))
        Text(
            text = "AI Irrigation Automation",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = NuKropText
        )
        Spacer(modifier = Modifier.height(12.dp))

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(NuKropCard)
                .border(1.5.dp, Color(0xFF64B5F6).copy(alpha = 0.3f), RoundedCornerShape(20.dp))
                .padding(16.dp)
        ) {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(modifier = Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Default.PowerSettingsNew, null, tint = if (iotState.isRunning) NuKropBadgeGreen else NuKropTextMuted, modifier = Modifier.size(24.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Borewell Motor", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NuKropText, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                            Text(if (iotState.isRunning) "Status: RUNNING (${iotState.amperage}A)" else "Status: OFF (0.0A)", fontSize = 11.sp, color = if (iotState.isRunning) NuKropBadgeGreen else NuKropTextMuted, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                        }
                    }
                    Spacer(Modifier.width(8.dp))
                    
                    val isPending = commandState == CommandState.PENDING || commandState == CommandState.VERIFICATION
                    if (isPending) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color(0xFF64B5F6), strokeWidth = 2.dp)
                            Spacer(Modifier.width(6.dp))
                            Text(if (commandState == CommandState.VERIFICATION) "VERIFYING..." else "SENDING...", fontSize = 9.sp, color = NuKropTextMuted, fontWeight = FontWeight.Bold)
                        }
                    } else if (iotState.status == "fault") {
                        Text("⚠️ FAULT", color = NuKropError, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    } else {
                        Switch(
                            checked = iotState.isRunning,
                            onCheckedChange = { isOn -> 
                                NuKropIotManager.sendAsyncCommand("smart_pump_1", if (isOn) "MOTOR_ON" else "MOTOR_OFF")
                            },
                            colors = SwitchDefaults.colors(checkedThumbColor = NuKropCard, checkedTrackColor = Color(0xFF64B5F6))
                        )
                    }
                }
                
                Spacer(modifier = Modifier.height(16.dp))
                
                Row(
                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(NuKropSurface).padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(modifier = Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Default.Message, null, tint = Color(0xFF25D366), modifier = Modifier.size(20.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text("WhatsApp Alerts", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = NuKropText, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                            Text("Get notified when motor runs", fontSize = 10.sp, color = NuKropTextMuted, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                        }
                    }
                    Spacer(Modifier.width(8.dp))
                    Switch(
                        checked = whatsappAlerts,
                        onCheckedChange = { whatsappAlerts = it },
                        colors = SwitchDefaults.colors(checkedThumbColor = NuKropCard, checkedTrackColor = Color(0xFF25D366))
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(NuKropSurface).padding(12.dp)) {
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                Icon(Icons.Default.WaterDrop, null, tint = Color(0xFF64B5F6), modifier = Modifier.size(14.dp))
                                Text("Predicted Need", fontSize = 11.sp, color = NuKropTextMuted)
                            }
                            Spacer(Modifier.height(4.dp))
                            Text("450 Liters", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                            Text("Next 48 Hours", fontSize = 10.sp, color = NuKropTextDim)
                        }
                    }
                    
                    Box(Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(NuKropSurface).padding(12.dp)) {
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                Icon(Icons.Default.TrendingDown, null, tint = NuKropBadgeGreen, modifier = Modifier.size(14.dp))
                                Text("Water Saved", fontSize = 11.sp, color = NuKropTextMuted)
                            }
                            Spacer(Modifier.height(4.dp))
                            Text("22%", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = NuKropBadgeGreen)
                            Text("This Month vs Avg", fontSize = 10.sp, color = NuKropTextDim)
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))
        Button(
            onClick = { 
                val pVal = 6.4
                val nVal = 45
                val cVal = 1.85
                
                var agronomistPlan = AutonomousAgronomist.generateTreatmentPlan("General", nVal, pVal)
                if (cVal < 2.0) {
                    agronomistPlan += "\n\n⚠️ Carbon Level Warning: Organic carbon is $cVal%, which is below the target 2.0%. Incorporate green manure (e.g., Sesbania/dhaincha) or apply 10 tonnes/hectare of compost to replenish organic matter."
                }
                planResult = agronomistPlan
            },
            modifier = Modifier.fillMaxWidth().height(50.dp),
            colors = ButtonDefaults.buttonColors(containerColor = NuKropAccent)
        ) {
            Icon(Icons.Default.Eco, contentDescription = null, tint = NuKropDark)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Generate Treatment Plan", color = NuKropDark, fontWeight = FontWeight.Bold)
        }
        
        if (planResult != null) {
            Spacer(modifier = Modifier.height(16.dp))
            Card(
                colors = CardDefaults.cardColors(containerColor = NuKropCard),
                modifier = Modifier.fillMaxWidth().border(1.dp, Color(0x20FFFFFF), RoundedCornerShape(12.dp))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "AI Agronomist Plan",
                        fontWeight = FontWeight.Bold,
                        color = NuKropAccent,
                        fontSize = 15.sp
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = planResult!!,
                        color = NuKropText,
                        lineHeight = 20.sp,
                        fontSize = 13.sp
                    )
                }
            }
        }
        Spacer(modifier = Modifier.height(100.dp))
    }
}

@Composable
fun SensorTile(modifier: Modifier, title: String, value: String, status: String, statusColor: Color) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(NuKropSurface)
            .padding(12.dp)
    ) {
        Column {
            Text(title, fontSize = 11.sp, color = NuKropTextMuted)
            Spacer(modifier = Modifier.height(4.dp))
            Text(value, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = NuKropText)
            Spacer(modifier = Modifier.height(4.dp))
            Text(status, fontSize = 10.sp, color = statusColor, fontWeight = FontWeight.SemiBold)
        }
    }
}

