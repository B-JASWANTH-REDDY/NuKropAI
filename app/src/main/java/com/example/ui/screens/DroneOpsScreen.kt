package com.example

import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FlightTakeoff
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.PrecisionManufacturing
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*

@Composable
fun DroneOpsScreen(modifier: Modifier = Modifier) {
    var selectedMission by remember { mutableStateOf("Weeding") }
    var isAirdropActive by remember { mutableStateOf(false) }

    val scanTransition = rememberInfiniteTransition(label = "drone_scan")
    val lineOffset by scanTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(2000, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "line_offset"
    )

    var weedsCount by remember { mutableStateOf(184) }
    var chemicalSaved by remember { mutableStateOf(88.4f) }
    var batteryPercentage by remember { mutableStateOf(92) }

    val targetTransition = rememberInfiniteTransition(label = "drone_target")
    val targetX by targetTransition.animateFloat(
        initialValue = 0.35f,
        targetValue = 0.65f,
        animationSpec = infiniteRepeatable(
            animation = tween(4500, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "target_x"
    )
    val targetY by targetTransition.animateFloat(
        initialValue = 0.45f,
        targetValue = 0.75f,
        animationSpec = infiniteRepeatable(
            animation = tween(3500, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "target_y"
    )

    LaunchedEffect(isAirdropActive) {
        if (isAirdropActive) {
            while (true) {
                kotlinx.coroutines.delay(2000)
                weedsCount += (1..3).random()
                chemicalSaved = String.format(java.util.Locale.US, "%.1f", 88.0f + (0..20).random() / 10.0f).toFloat()
                if (batteryPercentage > 5) {
                    batteryPercentage -= 1
                }
            }
        }
    }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(NuKropDark)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Text(
                text = "Autonomous Drone Ops",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = NuKropText
            )
            Text(
                text = "Visual Weeding & Spot-Spraying Dashboard",
                style = MaterialTheme.typography.bodyMedium,
                color = NuKropTextMuted
            )
        }

        // Live Feed Simulation Card
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(200.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color(0xFF141F0C))
                    .border(1.dp, NuKropAccent.copy(alpha = 0.5f), RoundedCornerShape(16.dp))
            ) {
                // Simulated camera canvas drawing green crop and red weed highlights
                Canvas(modifier = Modifier.fillMaxSize()) {
                    val w = size.width
                    val h = size.height

                    // Simulated crop rows (lines)
                    drawLine(Color(0x308BC34A), Offset(w * 0.2f, 0f), Offset(w * 0.2f, h), 40f)
                    drawLine(Color(0x308BC34A), Offset(w * 0.5f, 0f), Offset(w * 0.5f, h), 40f)
                    drawLine(Color(0x308BC34A), Offset(w * 0.8f, 0f), Offset(w * 0.8f, h), 40f)

                    // Bounding Box 1: Crop
                    drawRect(
                        color = Color(0xFF8BC34A),
                        topLeft = Offset(w * 0.15f, h * 0.2f),
                        size = Size(80f, 80f),
                        style = androidx.compose.ui.graphics.drawscope.Stroke(2f)
                    )

                    // Bounding Box 2: Weed (Target)
                    drawRect(
                        color = Color(0xFFE57373),
                        topLeft = Offset(w * targetX, h * targetY),
                        size = Size(60f, 60f),
                        style = androidx.compose.ui.graphics.drawscope.Stroke(3f)
                    )

                    // Scanning line
                    val scanY = h * lineOffset
                    drawLine(
                        color = NuKropAccent.copy(alpha = 0.8f),
                        start = Offset(0f, scanY),
                        end = Offset(w, scanY),
                        strokeWidth = 4f
                    )
                }

                // HUD Text overlays
                Text(
                    text = "LIVE FEEDS • CAMERA 01 [ALT: 12m]",
                    color = NuKropAccent,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(12.dp).align(Alignment.TopStart)
                )

                Text(
                    text = "TARGET: DANDELION WEED (LOCK)",
                    color = Color(0xFFE57373),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(12.dp).align(Alignment.BottomStart)
                )

                Box(
                    modifier = Modifier
                        .padding(12.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(NuKropBadgeGreen)
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                        .align(Alignment.TopEnd)
                ) {
                    Text("AUTO_SPRAY_ON", color = NuKropDark, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        // Mode selector
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Button(
                    onClick = { selectedMission = "Weeding" },
                    colors = ButtonDefaults.buttonColors(containerColor = if (selectedMission == "Weeding") NuKropAccent else NuKropCard),
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Visual Weeding", color = if (selectedMission == "Weeding") NuKropDark else NuKropText, fontWeight = FontWeight.Bold)
                }
                Button(
                    onClick = { selectedMission = "SpotSpray" },
                    colors = ButtonDefaults.buttonColors(containerColor = if (selectedMission == "SpotSpray") NuKropAccent else NuKropCard),
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Spot Spraying", color = if (selectedMission == "SpotSpray") NuKropDark else NuKropText, fontWeight = FontWeight.Bold)
                }
            }
        }

        // Stats Grid
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = NuKropCard),
                modifier = Modifier.fillMaxWidth().border(1.dp, Color(0x10FFFFFF), RoundedCornerShape(16.dp))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Mission Telemetry", fontWeight = FontWeight.Bold, color = NuKropText, fontSize = 14.sp)
                    Spacer(Modifier.height(12.dp))
                    Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                        Column {
                            Text("Weeds Tagged", fontSize = 10.sp, color = NuKropTextMuted)
                            Text("${weedsCount} Weeds", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Chemical Saved", fontSize = 10.sp, color = NuKropTextMuted)
                            Text("${chemicalSaved}%", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = NuKropBadgeGreen)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("Est. Battery", fontSize = 10.sp, color = NuKropTextMuted)
                            Text("${batteryPercentage}% (${batteryPercentage * 30 / 60} hrs)", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = NuKropAccent)
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                    HorizontalDivider(color = Color(0x10FFFFFF))
                    Spacer(Modifier.height(12.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.Info, null, tint = NuKropAccent, modifier = Modifier.size(16.dp))
                        Text(
                            text = "Local Regulations: Permitted fly zone. Airspace cleared by DGCA.",
                            fontSize = 11.sp,
                            color = NuKropTextMuted
                        )
                    }
                }
            }
        }

        item {
            Button(
                onClick = { isAirdropActive = !isAirdropActive },
                modifier = Modifier.fillMaxWidth().height(50.dp),
                colors = ButtonDefaults.buttonColors(containerColor = if (isAirdropActive) NuKropBadgeGreen.copy(alpha=0.2f) else NuKropAccent)
            ) {
                Icon(
                    Icons.Default.PrecisionManufacturing,
                    contentDescription = null,
                    tint = if (isAirdropActive) NuKropBadgeGreen else NuKropDark
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    if (isAirdropActive) "Active Mission Airborne" else "Dispatch Autonomous Drone",
                    color = if (isAirdropActive) NuKropBadgeGreen else NuKropDark,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        item { Spacer(Modifier.height(80.dp)) }
    }
}
