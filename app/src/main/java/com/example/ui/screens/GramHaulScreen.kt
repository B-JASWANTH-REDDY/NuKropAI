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
import com.example.gramhaul.GramHaulEngine
import com.example.gramhaul.HaulVehicleType
import com.example.ui.theme.*

@Composable
fun GramHaulScreen(onNavigateBack: () -> Unit) {
    val scrollState = rememberScrollState()
    var myProduceWeight by remember { mutableStateOf(8.0) } // Quintals
    var requiresColdChain by remember { mutableStateOf(false) }
    var liveTrips by remember { mutableStateOf<List<com.example.gramhaul.GramHaulTripPlan>?>(null) }

    LaunchedEffect(myProduceWeight, requiresColdChain) {
        liveTrips = GramHaulEngine.getLiveOrPooledTrips(
            state = "Andhra Pradesh",
            district = "Guntur",
            farmerProduceWeight = myProduceWeight,
            requiresColdChain = requiresColdChain,
            destinationMandi = "Guntur APMC Mandi"
        )
    }

    val availableTrips = liveTrips ?: remember(myProduceWeight, requiresColdChain) {
        GramHaulEngine.findAvailablePooledTrips(myProduceWeight, requiresColdChain)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(Color(0xFF091214), NuKropDark)))
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
                Text("GramHaul Logistics", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                Text("Shared Rural Farm-to-Mandi Transport", fontSize = 11.sp, color = NuKropAccent)
            }
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(scrollState)
                .padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 120.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // My Load Configuration
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(NuKropCard)
                    .border(1.dp, NuKropAccent.copy(alpha = 0.25f), RoundedCornerShape(16.dp))
                    .padding(16.dp)
            ) {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("My Load: ${myProduceWeight.toInt()} Quintals", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("Cold-Chain Reefer", fontSize = 11.sp, color = NuKropTextMuted)
                            Spacer(Modifier.width(4.dp))
                            Switch(
                                checked = requiresColdChain,
                                onCheckedChange = { requiresColdChain = it },
                                colors = SwitchDefaults.colors(checkedThumbColor = NuKropAccent, checkedTrackColor = NuKropAccent.copy(alpha = 0.5f))
                            )
                        }
                    }
                    Slider(
                        value = myProduceWeight.toFloat(),
                        onValueChange = { myProduceWeight = it.toDouble() },
                        valueRange = 2f..30f,
                        steps = 28,
                        colors = SliderDefaults.colors(thumbColor = NuKropAccent, activeTrackColor = NuKropAccent)
                    )
                }
            }

            Text("🚚 Available Pooled Vehicle Trips (Sub-2s Matching)", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NuKropText)

            availableTrips.forEach { trip ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(NuKropCard)
                        .border(1.dp, Color(0x30FFFFFF), RoundedCornerShape(16.dp))
                        .padding(16.dp)
                ) {
                    Column {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(trip.vehicle.icon, fontSize = 24.sp)
                                Spacer(Modifier.width(8.dp))
                                Column {
                                    Text(trip.vehicle.displayName, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                                    Text("Driver: ${trip.driverName} (${trip.driverPhone})", fontSize = 11.sp, color = NuKropTextMuted)
                                }
                            }
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(NuKropBadgeGreen.copy(alpha = 0.2f))
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            ) {
                                Text(trip.milestoneStatus, fontSize = 10.sp, color = NuKropBadgeGreen, fontWeight = FontWeight.Bold)
                            }
                        }

                        Spacer(Modifier.height(12.dp))
                        HorizontalDivider(color = Color(0x20FFFFFF))
                        Spacer(Modifier.height(10.dp))

                        Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                            Column {
                                Text("Route", fontSize = 11.sp, color = NuKropTextMuted)
                                Text("${trip.originCluster} → ${trip.destinationMandi}", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = NuKropText)
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text("Departure", fontSize = 11.sp, color = NuKropTextMuted)
                                Text(trip.departureTimeFormatted, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = NuKropAccent)
                            }
                        }

                        Spacer(Modifier.height(8.dp))
                        // Capacity Progress Bar
                        val capRatio = (trip.bookedWeightQuintals / trip.totalCapacityQuintals).toFloat().coerceIn(0f, 1f)
                        Text(
                            "Capacity: ${trip.bookedWeightQuintals.toInt()} / ${trip.totalCapacityQuintals.toInt()} Qtl (${trip.availableSpaceQuintals.toInt()} Qtl Remaining)",
                            fontSize = 11.sp,
                            color = NuKropTextDim
                        )
                        Spacer(Modifier.height(4.dp))
                        LinearProgressIndicator(
                            progress = { capRatio },
                            modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
                            color = NuKropAccent,
                            trackColor = Color(0x30FFFFFF)
                        )

                        Spacer(Modifier.height(12.dp))

                        // Pooled Farmers Cost Breakdown
                        trip.batches.forEach { batch ->
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("• ${batch.farmerName} (${batch.weightQuintals} Qtl)", fontSize = 11.sp, color = NuKropTextMuted)
                                Text("₹${batch.allocatedCostRupees.toInt()} (Saved ${batch.costSavedPctVsSoloHire}%)", fontSize = 11.sp, color = NuKropBadgeGreen, fontWeight = FontWeight.Bold)
                            }
                        }

                        Spacer(Modifier.height(12.dp))
                        Button(
                            onClick = { },
                            modifier = Modifier.fillMaxWidth().height(42.dp),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = NuKropAccent)
                        ) {
                            Text("Book Shared Slot (₹${(trip.totalTripCost * (myProduceWeight / trip.totalCapacityQuintals)).toInt()})", color = NuKropDark, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    }
}
