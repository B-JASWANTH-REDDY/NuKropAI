package com.example

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
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
import com.example.ui.theme.*
import com.example.yantra.EscrowBookingContract
import com.example.yantra.YantraEquipmentListing
import com.example.yantra.YantraShareEngine

@Composable
fun YantraShareScreen(onNavigateBack: () -> Unit) {
    val scrollState = rememberScrollState()
    val listings = remember { YantraShareEngine.getSampleListings() }
    var activeEscrowContract by remember { mutableStateOf<EscrowBookingContract?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(Color(0xFF141008), NuKropDark)))
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
                Text("YantraShare Hub", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                Text("P2P Farm Machinery & IoT Telematics Escrow", fontSize = 11.sp, color = NuKropAccent)
            }
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(scrollState)
                .padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 120.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Active Escrow Banner if booked
            activeEscrowContract?.let { contract ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color(contract.status.badgeColorHex).copy(alpha = 0.15f))
                        .border(1.dp, Color(contract.status.badgeColorHex), RoundedCornerShape(16.dp))
                        .padding(16.dp)
                ) {
                    Column {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(contract.status.label, fontSize = 11.sp, color = Color(contract.status.badgeColorHex), fontWeight = FontWeight.Bold)
                            Text("ID: ${contract.bookingId}", fontSize = 10.sp, color = NuKropTextMuted)
                        }
                        Spacer(Modifier.height(6.dp))
                        Text(contract.equipmentTitle, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                        Text("Escrow Total: ₹${contract.totalEscrowAmount.toInt()} (${contract.bookingDuration})", fontSize = 12.sp, color = NuKropAccent)
                        Spacer(Modifier.height(8.dp))
                        Text("Payment is safely locked in Escrow. Funds are released only after field work verification.", fontSize = 11.sp, color = NuKropTextDim)
                    }
                }
            }

            Text("🚜 Available Farm Machinery & Equipment Network", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NuKropText)

            listings.forEach { item ->
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
                                Text(item.category.icon, fontSize = 22.sp)
                                Spacer(Modifier.width(8.dp))
                                Column {
                                    Text(item.title, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                                    Text("Owner: ${item.ownerName} (${item.distanceKm} km away)", fontSize = 11.sp, color = NuKropTextMuted)
                                }
                            }
                            Text("★ ${item.reliabilityRating}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = NuKropAccent)
                        }

                        Spacer(Modifier.height(10.dp))
                        HorizontalDivider(color = Color(0x20FFFFFF))
                        Spacer(Modifier.height(8.dp))

                        // Rate Tiers
                        Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                            Text("Hourly: ₹${item.hourlyRateRupees.toInt()}/hr", fontSize = 11.sp, color = NuKropText)
                            Text("Acre: ₹${item.perAcreRateRupees.toInt()}/acre", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = NuKropBadgeGreen)
                            Text("Daily: ₹${item.dailyRateRupees.toInt()}/day", fontSize = 11.sp, color = NuKropTextMuted)
                        }

                        Spacer(Modifier.height(8.dp))

                        // IoT Telematics Telemetry
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(NuKropSurface)
                                .padding(10.dp)
                        ) {
                            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                                Text("⏱️ ${item.engineHoursLogged.toInt()} Run Hrs", fontSize = 11.sp, color = NuKropTextMuted)
                                Text("⛽ ${item.fuelLevelPct}% Fuel", fontSize = 11.sp, color = NuKropTextMuted)
                                Text("🔋 ${item.batteryHealthPct}% Battery", fontSize = 11.sp, color = NuKropTextMuted)
                                Text("🛡️ Geofenced", fontSize = 11.sp, color = NuKropBadgeGreen, fontWeight = FontWeight.Bold)
                            }
                        }

                        Spacer(Modifier.height(12.dp))
                        Button(
                            onClick = {
                                activeEscrowContract = YantraShareEngine.createEscrowContract(item, 4.5, true)
                            },
                            modifier = Modifier.fillMaxWidth().height(42.dp),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = NuKropAccent)
                        ) {
                            Text("Book with Escrow Protection (₹${((item.perAcreRateRupees * 4.5) + 300.0).toInt()})", color = NuKropDark, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    }
}
