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
import com.example.agristack.AgriStackPassportEngine
import com.example.ui.theme.*

@Composable
fun AgriStackPassportScreen(onNavigateBack: () -> Unit) {
    val scrollState = rememberScrollState()
    var livePassport by remember { mutableStateOf<com.example.agristack.AgriStackPassport?>(null) }

    LaunchedEffect(Unit) {
        livePassport = AgriStackPassportEngine.getLiveOrFallbackPassport(
            farmerId = "IN-AP-GNT-4122",
            defaultName = "B. Jaswanth Reddy",
            defaultState = "Andhra Pradesh"
        )
    }

    val passport = livePassport ?: remember { AgriStackPassportEngine.getSovereignPassport() }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(Color(0xFF10140A), NuKropDark)))
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
                Text("AgriStack Health Passport", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                Text("Sovereign Soil & National Farmer Registry", fontSize = 11.sp, color = NuKropAccent)
            }
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(scrollState)
                .padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 120.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Sovereign ID Card
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(
                        Brush.linearGradient(
                            listOf(
                                Color(0xFF1E3A1E),
                                Color(0xFF132413),
                                NuKropCard
                            )
                        )
                    )
                    .border(1.5.dp, NuKropAccent.copy(alpha = 0.5f), RoundedCornerShape(20.dp))
                    .padding(18.dp)
            ) {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.Top
                    ) {
                        Column {
                            Text("GOVERNMENT OF INDIA • AGRI-STACK", fontSize = 10.sp, color = NuKropAccent, fontWeight = FontWeight.ExtraBold)
                            Spacer(Modifier.height(4.dp))
                            Text(passport.farmerName, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                            Text("ID: ${passport.sovereignFarmerId}", fontSize = 12.sp, color = NuKropTextMuted)
                        }
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(NuKropBadgeGreen)
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text("PM-KISAN VERIFIED", fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, color = NuKropDark)
                        }
                    }

                    Spacer(Modifier.height(14.dp))
                    HorizontalDivider(color = Color(0x30FFFFFF))
                    Spacer(Modifier.height(10.dp))

                    Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                        Column {
                            Text("Survey / Khasra No.", fontSize = 10.sp, color = NuKropTextMuted)
                            Text(passport.surveyParcelNumber, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                        }
                        Column {
                            Text("Land Holding", fontSize = 10.sp, color = NuKropTextMuted)
                            Text("${passport.landSizeAcres} Acres", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("Village / District", fontSize = 10.sp, color = NuKropTextMuted)
                            Text("${passport.villageName}, ${passport.district}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                        }
                    }
                }
            }

            // Algorithmic Agri-Credit Score Gauge
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
                        Text("🏛️ Algorithmic Agri-Credit Score", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NuKropBadgeGreen)
                        Text("${passport.agriCreditScore} / 900", fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, color = NuKropBadgeGreen)
                    }
                    Spacer(Modifier.height(4.dp))
                    Text(passport.creditRatingTier, fontSize = 11.sp, color = NuKropAccent, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(8.dp))
                    LinearProgressIndicator(
                        progress = { (passport.agriCreditScore - 300) / 600f },
                        modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
                        color = NuKropBadgeGreen,
                        trackColor = Color(0x30FFFFFF)
                    )
                    Spacer(Modifier.height(8.dp))
                    Text("Pre-Approved Kisan Credit Card (KCC) Limit: ₹${passport.maxEligibleKccLoanLimit.toInt()}", fontSize = 12.sp, color = NuKropTextDim)
                }
            }

            // Digitized Soil Health Card
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(NuKropCard)
                    .border(1.dp, Color(0x30FFFFFF), RoundedCornerShape(16.dp))
                    .padding(16.dp)
            ) {
                Column {
                    Text("🌱 Digitized Soil Health Card", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                    Text("Status: ${passport.soilHealthSummary.overallFertilityIndex}", fontSize = 11.sp, color = NuKropBadgeGreen, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(10.dp))

                    Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                        Text("Nitrogen (N): ${passport.soilHealthSummary.nitrogenKgPerHa} kg/ha", fontSize = 11.sp, color = NuKropTextMuted)
                        Text("Phosphorus (P): ${passport.soilHealthSummary.phosphorusKgPerHa} kg/ha", fontSize = 11.sp, color = NuKropTextMuted)
                    }
                    Spacer(Modifier.height(4.dp))
                    Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                        Text("Potassium (K): ${passport.soilHealthSummary.potassiumKgPerHa} kg/ha", fontSize = 11.sp, color = NuKropTextMuted)
                        Text("Soil pH: ${passport.soilHealthSummary.soilPh} (Neutral)", fontSize = 11.sp, color = NuKropTextMuted)
                    }
                    Spacer(Modifier.height(4.dp))
                    Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                        Text("Organic Carbon: ${passport.soilHealthSummary.organicCarbonPct}%", fontSize = 11.sp, color = NuKropAccent, fontWeight = FontWeight.Bold)
                        Text("Zinc: ${passport.soilHealthSummary.zincPpm} ppm | Iron: ${passport.soilHealthSummary.ironPpm} ppm", fontSize = 11.sp, color = NuKropTextDim)
                    }
                }
            }

            // 1-Click Scheme Matcher
            Text("📜 Matched Government Schemes & Subsidies", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NuKropText)
            passport.eligibleSchemes.forEach { scheme ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(NuKropCard)
                        .border(1.dp, NuKropAccent.copy(alpha = 0.2f), RoundedCornerShape(14.dp))
                        .padding(14.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(scheme.schemeName, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                            Text("${scheme.ministryOrDepartment} • ${scheme.validityYear}", fontSize = 11.sp, color = NuKropTextMuted)
                            Text("Direct Benefit: ${scheme.directBenefitAmountFormatted}", fontSize = 12.sp, color = NuKropAccent, fontWeight = FontWeight.SemiBold)
                        }
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(NuKropAccent.copy(alpha = 0.15f))
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(scheme.applicationStatus, fontSize = 10.sp, color = NuKropAccent, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}
