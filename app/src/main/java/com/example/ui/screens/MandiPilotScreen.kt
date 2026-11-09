package com.example

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import com.example.mandipilot.BuyerBidQuote
import com.example.mandipilot.MandiArbitrageOption
import com.example.mandipilot.MandiPilotEngine
import com.example.mandipilot.PriceForecastResult
import com.example.ui.theme.*

@Composable
fun MandiPilotScreen(onNavigateBack: () -> Unit) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val farmPrefs = remember { context.getSharedPreferences("nukrop_farm_profile", android.content.Context.MODE_PRIVATE) }
    val savedCrop = remember { farmPrefs.getString("crop", "Paddy / Rice")?.ifBlank { "Paddy / Rice" } ?: "Paddy / Rice" }
    val savedState = remember { farmPrefs.getString("state", "Telangana")?.ifBlank { "Telangana" } ?: "Telangana" }
    val savedDistrict = remember { farmPrefs.getString("district", "") ?: "" }

    val scrollState = rememberScrollState()
    var batchSize by remember { mutableStateOf(50.0) } // Quintals
    var isPerishable by remember { mutableStateOf(false) }
    var liveArbitrage by remember { mutableStateOf<List<MandiArbitrageOption>?>(null) }

    LaunchedEffect(batchSize, isPerishable, savedCrop, savedState) {
        liveArbitrage = MandiPilotEngine.getLiveOrFallbackArbitrage(
            commodity = savedCrop,
            state = savedState,
            district = savedDistrict,
            batchSizeQuintals = batchSize,
            isPerishable = isPerishable
        )
    }

    val arbitrageOptions = liveArbitrage ?: remember(batchSize, isPerishable, savedCrop, savedState) {
        MandiPilotEngine.calculateMandiArbitrage(
            batchSizeQuintals = batchSize,
            isPerishable = isPerishable,
            state = savedState,
            originDistrict = savedDistrict
        )
    }

    val forecast = remember(savedCrop) {
        MandiPilotEngine.forecastPriceMovement(savedCrop, 2850.0)
    }

    val verifiedBids = remember(savedCrop) {
        MandiPilotEngine.getVerifiedBuyerBids(savedCrop, 2850.0)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(Color(0xFF0C1408), NuKropDark)))
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
                Text("MandiPilot Arbitrage", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                Text("APMC Discovery for $savedCrop ($savedState)", fontSize = 11.sp, color = NuKropAccent)
            }
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(scrollState)
                .padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 120.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Batch Configuration Card
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
                        Text("Harvest Batch: ${batchSize.toInt()} Quintals", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("Perishable Crop", fontSize = 11.sp, color = NuKropTextMuted)
                            Spacer(Modifier.width(4.dp))
                            Switch(
                                checked = isPerishable,
                                onCheckedChange = { isPerishable = it },
                                colors = SwitchDefaults.colors(checkedThumbColor = NuKropAccent, checkedTrackColor = NuKropAccent.copy(alpha = 0.5f))
                            )
                        }
                    }
                    Slider(
                        value = batchSize.toFloat(),
                        onValueChange = { batchSize = it.toDouble() },
                        valueRange = 10f..200f,
                        steps = 19,
                        colors = SliderDefaults.colors(thumbColor = NuKropAccent, activeTrackColor = NuKropAccent)
                    )
                }
            }

            // 15-Day Predictive Price Trend
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(NuKropCard)
                    .border(1.dp, NuKropBadgeGreen.copy(alpha = 0.3f), RoundedCornerShape(16.dp))
                    .padding(16.dp)
            ) {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("📈 15-Day Price Trend Forecast", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NuKropBadgeGreen)
                        Text(forecast.predictedTrend, fontSize = 11.sp, color = NuKropBadgeGreen, fontWeight = FontWeight.Bold)
                    }
                    Spacer(Modifier.height(8.dp))
                    Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                        Column {
                            Text("Today Modal", fontSize = 11.sp, color = NuKropTextMuted)
                            Text("₹${forecast.currentModalPrice.toInt()}/Qtl", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                        }
                        Column {
                            Text("7-Day Forecast", fontSize = 11.sp, color = NuKropTextMuted)
                            Text("₹${forecast.forecast7dPrice.toInt()}/Qtl", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NuKropAccent)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("15-Day Peak", fontSize = 11.sp, color = NuKropTextMuted)
                            Text("₹${forecast.forecast15dPrice.toInt()}/Qtl", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NuKropBadgeGreen)
                        }
                    }
                    Spacer(Modifier.height(6.dp))
                    Text(forecast.keyDrivingFactor, fontSize = 11.sp, color = NuKropTextDim, lineHeight = 16.sp)
                }
            }

            // Multi-Mandi Arbitrage Matrix (>= 5 Mandis within 100km)
            Text("📍 Regional Mandi Arbitrage Matrix (Within 100km)", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NuKropText)

            arbitrageOptions.forEach { opt ->
                val isBest = opt.isRecommendedBestOption
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(if (isBest) NuKropBadgeGreen.copy(alpha = 0.12f) else NuKropCard)
                        .border(
                            1.dp,
                            if (isBest) NuKropBadgeGreen.copy(alpha = 0.5f) else Color(0x20FFFFFF),
                            RoundedCornerShape(16.dp)
                        )
                        .padding(14.dp)
                ) {
                    Column {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(opt.mandiName, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                                Text("${opt.district} (${opt.distanceKm.toInt()} km away) • ${opt.arrivalVolumeTons.toInt()} Tons Inflow", fontSize = 11.sp, color = NuKropTextMuted)
                            }
                            if (isBest) {
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(NuKropBadgeGreen)
                                        .padding(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Text("BEST NET RETURN", fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = NuKropDark)
                                }
                            }
                        }

                        Spacer(Modifier.height(10.dp))
                        HorizontalDivider(color = Color(0x20FFFFFF))
                        Spacer(Modifier.height(8.dp))

                        // Fee Breakdown
                        Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                            Text("Gross APMC Modal: ₹${opt.grossModalPricePerQtl}/Qtl", fontSize = 11.sp, color = NuKropText)
                            Text("Net Realized: ₹${opt.netRealizedPricePerQtl}/Qtl", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = if (isBest) NuKropBadgeGreen else NuKropAccent)
                        }
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "Deductions: Freight -₹${opt.estimatedFreightPerQtl} | Cess -₹${opt.apmcCessPerQtl} | Spoilage -₹${opt.transitSpoilagePenaltyPerQtl}",
                            fontSize = 10.sp,
                            color = NuKropTextDim
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "Total Net Batch Revenue: ₹${opt.totalNetRevenueForBatch.toInt()} (+₹${opt.arbitrageGainVsLocalMandi.toInt()} vs local)",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (opt.arbitrageGainVsLocalMandi >= 0) NuKropBadgeGreen else NuKropWarning
                        )
                    }
                }
            }

            // Direct Buyer & FPO Bidding Channel
            Text("🤝 Direct Institutional Buyer & FPO Bids", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NuKropText)
            verifiedBids.forEach { bid ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(NuKropCard)
                        .border(1.dp, NuKropAccent.copy(alpha = 0.25f), RoundedCornerShape(16.dp))
                        .padding(14.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(bid.buyerName, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                            Text("${bid.buyerType} • ${bid.paymentTerm}", fontSize = 11.sp, color = NuKropTextMuted)
                            Text("Offered: ₹${bid.offeredPricePerQtl.toInt()}/Qtl (Farm Gate Pickup)", fontSize = 12.sp, color = NuKropAccent, fontWeight = FontWeight.SemiBold)
                        }
                        Button(
                            onClick = { },
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = NuKropAccent)
                        ) {
                            Text("Accept Bid", color = NuKropDark, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}
