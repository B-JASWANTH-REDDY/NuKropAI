package com.example

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.*
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

@Composable
fun FieldNavigationScreen(modifier: Modifier = Modifier, onBack: () -> Unit = {}) {
    var isTracking by remember { mutableStateOf(false) }
    var sprayCoverageMode by remember { mutableStateOf(false) }

    Column(modifier = modifier.fillMaxSize().background(NuKropDark)) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth().statusBarsPadding().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = NuKropText)
                }
                Text("Intelligent Navigation", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = NuKropText)
            }
            Box(Modifier.clip(RoundedCornerShape(4.dp)).background(NuKropAccent.copy(alpha=0.2f)).padding(horizontal = 6.dp, vertical = 2.dp)) {
                Text("GPS Active", fontSize = 10.sp, color = NuKropAccent, fontWeight = FontWeight.Bold)
            }
        }

        // Map View Placeholder (Would integrate Mapbox/Google Maps here)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .padding(horizontal = 16.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(Color(0xFF202A16))
                .border(1.dp, Color(0x30FFFFFF), RoundedCornerShape(16.dp)),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Filled.Map, contentDescription = null, tint = NuKropTextDim, modifier = Modifier.size(48.dp))
                Spacer(Modifier.height(8.dp))
                Text("Mapbox GL / Google Maps View", color = NuKropTextDim, fontSize = 14.sp)
                if (isTracking) {
                    Spacer(Modifier.height(16.dp))
                    Text("Recording Path & Telemetry...", color = NuKropAccent, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
            
            // Floating tools on Map
            Column(
                modifier = Modifier.align(Alignment.TopEnd).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Box(
                    modifier = Modifier.size(40.dp).clip(CircleShape).background(NuKropSurface)
                        .clickable { sprayCoverageMode = !sprayCoverageMode },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Filled.WaterDrop, contentDescription = "Spray", tint = if (sprayCoverageMode) NuKropBadgeGreen else NuKropTextMuted)
                }
                Box(
                    modifier = Modifier.size(40.dp).clip(CircleShape).background(NuKropSurface),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Filled.Layers, contentDescription = "Layers", tint = NuKropTextMuted)
                }
            }
        }

        // Bottom Dashboard
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
                .background(NuKropSurface)
                .navigationBarsPadding()
                .padding(20.dp)
                .padding(bottom = 80.dp)
        ) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Operation Metrics", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                if (sprayCoverageMode) {
                    Text("Spray Mode: ON", fontSize = 12.sp, color = NuKropBadgeGreen, fontWeight = FontWeight.Bold)
                }
            }
            Spacer(Modifier.height(16.dp))
            
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MetricCard(Modifier.weight(1f), "Area Covered", if (isTracking) "1.2 Ha" else "0.0 Ha", Icons.Filled.SquareFoot)
                MetricCard(Modifier.weight(1f), "Distance", if (isTracking) "0.8 km" else "0.0 km", Icons.Filled.Route)
                MetricCard(Modifier.weight(1f), "Fuel Est.", if (isTracking) "2.4 L" else "0.0 L", Icons.Filled.LocalGasStation)
            }
            
            Spacer(Modifier.height(24.dp))
            
            Button(
                onClick = { isTracking = !isTracking },
                modifier = Modifier.fillMaxWidth().height(56.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = if (isTracking) NuKropError else NuKropAccent)
            ) {
                Text(
                    if (isTracking) "STOP TRACKING & SYNC" else "START FIELD OPERATION",
                    color = NuKropDark,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 16.sp
                )
            }
        }
    }
}

@Composable
fun MetricCard(modifier: Modifier = Modifier, title: String, value: String, icon: androidx.compose.ui.graphics.vector.ImageVector) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(NuKropCard)
            .border(1.dp, Color(0x10FFFFFF), RoundedCornerShape(12.dp))
            .padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(icon, contentDescription = null, tint = NuKropAccent, modifier = Modifier.size(20.dp))
        Spacer(Modifier.height(8.dp))
        Text(value, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = NuKropText, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
        Text(title, fontSize = 10.sp, color = NuKropTextMuted, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
    }
}
