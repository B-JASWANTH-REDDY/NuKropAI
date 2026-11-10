package com.example

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
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
import kotlinx.coroutines.delay
import kotlin.random.Random

@Composable
fun TractorAutopilotScreen(onNavigateBack: () -> Unit) {
    var isAutopilotActive by remember { mutableStateOf(false) }
    var steeringAngle by remember { mutableStateOf(0f) }
    var speed by remember { mutableStateOf(0f) }
    var satellites by remember { mutableStateOf(4) }
    val scrollState = rememberScrollState()
    
    // Simulate RTK GPS Telemetry
    LaunchedEffect(isAutopilotActive) {
        if (isAutopilotActive) {
            satellites = 12 + Random.nextInt(4)
            while (isAutopilotActive) {
                steeringAngle = (Random.nextFloat() * 10) - 5 // -5 to +5 degrees
                speed = 4.5f + (Random.nextFloat() * 0.5f) // 4.5 to 5.0 km/h
                delay(500)
            }
        } else {
            speed = 0f
            steeringAngle = 0f
            satellites = 4
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(NuKropDark)
            .statusBarsPadding()
            .verticalScroll(scrollState)
            .padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 120.dp)
    ) {
        // Header
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onNavigateBack) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = NuKropText)
            }
            Spacer(Modifier.width(8.dp))
            Text("Tractor AutoPilot (RTK)", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = NuKropText)
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Status Card
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(NuKropCard)
                .border(1.5.dp, if(isAutopilotActive) NuKropBadgeGreen else NuKropTextMuted, RoundedCornerShape(20.dp))
                .padding(20.dp)
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                val iconColor = if (isAutopilotActive) NuKropBadgeGreen else NuKropTextMuted
                Icon(Icons.Default.Agriculture, contentDescription = null, tint = iconColor, modifier = Modifier.size(64.dp))
                Spacer(Modifier.height(16.dp))
                Text(
                    if (isAutopilotActive) "AUTOPILOT ENGAGED" else "STANDBY",
                    fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = iconColor
                )
                Text("Row Following Mode: Active", fontSize = 12.sp, color = NuKropTextDim)
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Telemetry Dashboard
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            TelemetryTile(Modifier.weight(1f), "Speed", String.format("%.1f km/h", speed), Icons.Default.Speed, NuKropAccent)
            TelemetryTile(Modifier.weight(1f), "Steering", String.format("%.1f°", steeringAngle), Icons.Default.TireRepair, NuKropWarning)
        }
        Spacer(modifier = Modifier.height(12.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            TelemetryTile(Modifier.weight(1f), "RTK Satellites", "$satellites Locked", Icons.Default.Satellite, Color(0xFF64B5F6))
            TelemetryTile(Modifier.weight(1f), "Deviation", if(isAutopilotActive) "± 2.1 cm" else "--", Icons.Default.Straighten, NuKropBadgeGreen)
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Engage Button
        Button(
            onClick = { isAutopilotActive = !isAutopilotActive },
            modifier = Modifier.fillMaxWidth().height(60.dp),
            colors = ButtonDefaults.buttonColors(containerColor = if (isAutopilotActive) NuKropError else NuKropBadgeGreen)
        ) {
            Icon(if (isAutopilotActive) Icons.Default.Stop else Icons.Default.PlayArrow, contentDescription = null, tint = NuKropDark)
            Spacer(modifier = Modifier.width(8.dp))
            Text(if (isAutopilotActive) "DISENGAGE AUTOPILOT" else "ENGAGE AUTOPILOT", color = NuKropDark, fontWeight = FontWeight.Bold, fontSize = 16.sp)
        }
        Spacer(modifier = Modifier.height(80.dp))
    }
}

@Composable
fun TelemetryTile(modifier: Modifier, title: String, value: String, icon: androidx.compose.ui.graphics.vector.ImageVector, color: Color) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(NuKropSurface)
            .padding(16.dp)
    ) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(18.dp))
                Text(title, fontSize = 12.sp, color = NuKropTextMuted)
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(value, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = NuKropText)
        }
    }
}

