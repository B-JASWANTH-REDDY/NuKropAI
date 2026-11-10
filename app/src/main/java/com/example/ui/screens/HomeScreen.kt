package com.example

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.example.model.OutbreakAlert
import com.example.ui.CropItem
import com.example.ui.CropSelectionDialog
import com.example.ui.VoiceOsOverlay
import com.example.ui.theme.*
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.launch

@SuppressLint("MissingPermission")
@Composable
fun HomeScreen(
    modifier: Modifier = Modifier,
    onNavigateToScan: () -> Unit = {},
    onNavigateToMarket: () -> Unit = {},
    onNavigateToChat: () -> Unit = {},
    onNavigateToAutopilot: () -> Unit = {},
    onNavigateToFinance: () -> Unit = {},
    onNavigateToSavedReports: () -> Unit = {},
    onNavigateToEquipmentRental: () -> Unit = {},
    onNavigateToFarmKhata: () -> Unit = {},
    onNavigateToBioShield: () -> Unit = {},
    onNavigateToMandiPilot: () -> Unit = {},
    onNavigateToGramHaul: () -> Unit = {},
    onNavigateToAgriStack: () -> Unit = {},
    onNavigateToYantraShare: () -> Unit = {},
    onNavigateToBioRx: () -> Unit = {},
    onNavigateToCalculators: (CalculatorType) -> Unit = {},
    onNavigateToCommunity: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val scrollState = rememberScrollState()
    val authViewModel: AuthViewModel = viewModel()
    val currentUser by authViewModel.currentUser.collectAsState()

    var showVoiceOs by remember { mutableStateOf(false) }
    var showCropDialog by remember { mutableStateOf(false) }
    var showSprayDetailsDialog by remember { mutableStateOf(false) }
    var myCrops by remember { mutableStateOf(listOf("Cotton", "Rice / Paddy", "Chilli", "Tobacco")) }
    var activeCrop by remember { mutableStateOf("Cotton") }

    var weather by remember { mutableStateOf<WeatherData?>(null) }
    var userState by remember { mutableStateOf("Maharashtra") }
    var activeAlerts by remember { mutableStateOf<List<OutbreakAlert>>(emptyList()) }
    var alertsLoading by remember { mutableStateOf(true) }

    val hasLocation = remember {
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    }

    val locLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) {
            scope.launch {
                val loc = LocationHelper.getCurrentLocationStateAndMandi(context)
                if (loc != null && loc.first.isNotBlank()) {
                    userState = loc.first
                }
                val weatherRes = WeatherService.getWeather(19.0760, 72.8777)
                weather = weatherRes.getOrNull()
            }
        }
    }

    LaunchedEffect(userState) {
        alertsLoading = true
        try {
            val result = DiseaseAggregationService.fetchActiveAlerts(userState)
            activeAlerts = result.getOrElse { emptyList() }
        } catch (_: Exception) {
            activeAlerts = emptyList()
        } finally {
            alertsLoading = false
        }
    }

    LaunchedEffect(Unit) {
        scope.launch {
            val weatherRes = WeatherService.getWeather(19.0760, 72.8777)
            weather = weatherRes.getOrNull()
            if (hasLocation) {
                val loc = LocationHelper.getCurrentLocationStateAndMandi(context)
                if (loc != null && loc.first.isNotBlank()) {
                    userState = loc.first
                }
            }
        }
    }

    val cropEmojiMap = mapOf(
        "Cotton" to "🌾",
        "Tobacco" to "🌿",
        "Rice / Paddy" to "🌾",
        "Chilli" to "🌶️",
        "Tomato" to "🍅",
        "Wheat" to "🌾"
    )

    // Soft mint background matching user screenshot
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(
                        Color(0xFFE5F7EB),
                        Color(0xFFF4FAF5),
                        Color(0xFFFFFFFF)
                    )
                )
            )
    ) {
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(bottom = 120.dp)
        ) {
            // 1. Top Header (NuKropAI title + 3 dots menu)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 20.dp, vertical = 14.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        "NuKropAI",
                        fontSize = 26.sp,
                        fontWeight = FontWeight.Black,
                        color = PlantixText,
                        letterSpacing = (-0.5).sp
                    )
                    Text(
                        "Namaste, ${currentUser?.name?.ifBlank { "Farmer" } ?: "Farmer"}",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = PlantixPrimaryDark
                    )
                }

                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    IconButton(
                        onClick = { showVoiceOs = true },
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(PlantixPrimary.copy(alpha = 0.15f))
                    ) {
                        Text("🎙️", fontSize = 16.sp)
                    }

                    IconButton(onClick = { /* Menu */ }) {
                        Icon(Icons.Default.MoreVert, contentDescription = "Menu", tint = PlantixText, modifier = Modifier.size(24.dp))
                    }
                }
            }

            // 2. Horizontal Crop Selector Carousel with '+' Button
            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                items(myCrops) { crop ->
                    val isSelected = activeCrop == crop
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.clickable { activeCrop = crop }
                    ) {
                        Box(
                            modifier = Modifier
                                .size(72.dp)
                                .clip(CircleShape)
                                .background(Color.White)
                                .border(
                                    width = if (isSelected) 2.dp else 1.dp,
                                    color = if (isSelected) PlantixPrimary else Color(0xFFD6E4D6),
                                    shape = CircleShape
                                )
                                .shadow(if (isSelected) 4.dp else 1.dp, CircleShape, spotColor = Color(0x20000000)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(cropEmojiMap[crop] ?: "🌱", fontSize = 32.sp)
                        }
                        Spacer(Modifier.height(6.dp))
                        Text(
                            crop.split(" / ")[0],
                            fontSize = 13.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            color = if (isSelected) PlantixPrimaryDark else PlantixText
                        )
                    }
                }

                item {
                    // Bright Blue '+' Add Crop Button matching screenshot
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.clickable { showCropDialog = true }
                    ) {
                        Box(
                            modifier = Modifier
                                .size(72.dp)
                                .clip(CircleShape)
                                .background(PlantixActionBlue)
                                .shadow(4.dp, CircleShape, spotColor = PlantixActionBlue),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Add, contentDescription = "Add Crop", tint = Color.White, modifier = Modifier.size(32.dp))
                        }
                        Spacer(Modifier.height(6.dp))
                        Text("Add", fontSize = 13.sp, color = PlantixTextMuted, fontWeight = FontWeight.Medium)
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            // 3. Weather & Spraying Conditions Widget
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Weather Pill
                Surface(
                    modifier = Modifier.weight(0.9f),
                    shape = RoundedCornerShape(24.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, Color(0xFFD8E6D8)),
                    tonalElevation = 1.dp
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = if (weather != null) "${weather!!.temperature.toInt()}°C" else "30 Aug, 30°C",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = PlantixText
                        )
                        Text(weather?.emoji ?: "☁️", fontSize = 18.sp)
                    }
                }

                // Resolved spray advisory from weather
                val currentAdvisory = weather?.sprayAdvisory ?: remember {
                    WeatherService.getDefaultWeather().sprayAdvisory!!
                }

                // Dynamic Spraying Conditions Pill
                Surface(
                    modifier = Modifier
                        .weight(1.3f)
                        .clickable { showSprayDetailsDialog = true },
                    shape = RoundedCornerShape(24.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, Color(0xFFD8E6D8)),
                    tonalElevation = 1.dp
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text(
                                "Spraying (${currentAdvisory.windowLabel}):",
                                fontSize = 10.sp,
                                color = PlantixTextMuted
                            )
                            Text(
                                currentAdvisory.condition.label,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(currentAdvisory.condition.hexColor)
                            )
                        }
                        Box(
                            modifier = Modifier
                                .size(24.dp)
                                .clip(CircleShape)
                                .background(Color(currentAdvisory.condition.hexColor)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = when (currentAdvisory.condition) {
                                    SprayCondition.FAVOURABLE -> Icons.Default.Check
                                    SprayCondition.MODERATE -> Icons.Default.Info
                                    SprayCondition.UNFAVOURABLE -> Icons.Default.Warning
                                    SprayCondition.AVOID_SPRAYING -> Icons.Default.Close
                                },
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(15.dp)
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            // 4. Main 3-Step AI Leaf Doctor Card (Screenshot Exact Reproduction)
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                border = BorderStroke(1.dp, Color(0xFFE2EBE2))
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // 3 Step Icons with Arrows
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        PlantixStepItem("📱🌿", "Take a\npicture")
                        Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, tint = Color(0xFFBDC7BD), modifier = Modifier.size(18.dp))
                        PlantixStepItem("🔬🌱", "See\ndiagnosis")
                        Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, tint = Color(0xFFBDC7BD), modifier = Modifier.size(18.dp))
                        PlantixStepItem("🧴💊", "Get\nmedicine")
                    }

                    Spacer(Modifier.height(20.dp))

                    // Prominent Electric Blue Action Button
                    Button(
                        onClick = onNavigateToScan,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp),
                        shape = RoundedCornerShape(26.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = PlantixActionBlue)
                    ) {
                        Text("Take a picture", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color.White)
                    }
                }
            }

            Spacer(Modifier.height(22.dp))

            // 5. Tools Section Header
            Text(
                "Tools",
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                color = PlantixText,
                modifier = Modifier.padding(horizontal = 20.dp)
            )

            Spacer(Modifier.height(12.dp))

            // Horizontal Plantix Tools Row with New Badges
            LazyRow(
                modifier = Modifier.fillMaxWidth(),
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    PlantixSquareToolCard(
                        icon = "🌾",
                        title = "Fertilizer\ncalculator",
                        badge = null,
                        onClick = { onNavigateToCalculators(CalculatorType.FERTILIZER) }
                    )
                }
                item {
                    PlantixSquareToolCard(
                        icon = "🧴",
                        title = "Pesticide\ncalculator",
                        badge = "New",
                        onClick = { onNavigateToCalculators(CalculatorType.PESTICIDE) }
                    )
                }
                item {
                    PlantixSquareToolCard(
                        icon = "🧮",
                        title = "Farming\ncalculator",
                        badge = "New",
                        onClick = { onNavigateToCalculators(CalculatorType.FARMING_BUDGET) }
                    )
                }
                item {
                    PlantixSquareToolCard(
                        icon = "🛡️",
                        title = "BioShield\nradar",
                        badge = "Live",
                        onClick = onNavigateToBioShield
                    )
                }
                item {
                    PlantixSquareToolCard(
                        icon = "📈",
                        title = "MandiPilot\narbitrage",
                        badge = null,
                        onClick = onNavigateToMandiPilot
                    )
                }
            }

            Spacer(Modifier.height(18.dp))

            // 6. Enterprise Capabilities Suite (All existing features preserved cleanly)
            Text(
                "Advanced Agricultural Suite",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = PlantixText,
                modifier = Modifier.padding(horizontal = 20.dp)
            )

            Spacer(Modifier.height(10.dp))

            Column(
                modifier = Modifier.padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    PlantixWideToolTile(Modifier.weight(1f), "🚚", "GramHaul Logistics", "Shared Truck Pooling", onNavigate = onNavigateToGramHaul)
                    PlantixWideToolTile(Modifier.weight(1f), "🪪", "AgriStack Passport", "Soil & Credit Score", onNavigate = onNavigateToAgriStack)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    PlantixWideToolTile(Modifier.weight(1f), "🚜", "YantraShare Hub", "Rent Drone & Tractor", onNavigate = onNavigateToYantraShare)
                    PlantixWideToolTile(Modifier.weight(1f), "🌿", "BioRx Formulator", "Indigenous Recipes", onNavigate = onNavigateToBioRx)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    PlantixWideToolTile(Modifier.weight(1f), "💰", "KCC Loans & Subsidy", "1-Click Matcher", onNavigate = onNavigateToFinance)
                    PlantixWideToolTile(Modifier.weight(1f), "🧾", "Farm Khata", "Digital Ledger", onNavigate = onNavigateToFarmKhata)
                }
            }

            Spacer(Modifier.height(20.dp))

            // 7. Regional Disease Watch Section
            RegionalOutbreakAlertSection(
                userState = userState,
                alerts = activeAlerts,
                loading = alertsLoading,
                onNavigateToMarket = onNavigateToMarket,
                onNavigateToScan = onNavigateToScan
            )
        }

        // VoiceOS Speech Overlay
        if (showVoiceOs) {
            VoiceOsOverlay(
                onDismiss = { showVoiceOs = false },
                onNavigateToRoute = { route ->
                    when (route) {
                        "market" -> onNavigateToMarket()
                        "scanner" -> onNavigateToScan()
                        "equipment" -> onNavigateToYantraShare()
                        "logistics" -> onNavigateToGramHaul()
                    }
                }
            )
        }

        // Crop Selection Dialog
        if (showCropDialog) {
            CropSelectionDialog(
                selectedCrops = myCrops,
                onCropsUpdated = { updated ->
                    myCrops = updated
                    if (!updated.contains(activeCrop) && updated.isNotEmpty()) {
                        activeCrop = updated[0]
                    }
                },
                onDismiss = { showCropDialog = false }
            )
        }

        // Detailed Spray Advisory Dialog
        if (showSprayDetailsDialog) {
            val advisory = weather?.sprayAdvisory ?: WeatherService.getDefaultWeather().sprayAdvisory!!
            AlertDialog(
                onDismissRequest = { showSprayDetailsDialog = false },
                confirmButton = {
                    TextButton(onClick = { showSprayDetailsDialog = false }) {
                        Text("Close", fontWeight = FontWeight.Bold)
                    }
                },
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(16.dp)
                                .clip(CircleShape)
                                .background(Color(advisory.condition.hexColor))
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            "Spray Advisory (${advisory.windowLabel})",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            text = advisory.adviceText,
                            fontSize = 13.sp,
                            color = PlantixText,
                            lineHeight = 18.sp
                        )
                        HorizontalDivider(Modifier.padding(vertical = 4.dp))
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Delta-T (ΔT):", fontSize = 12.sp, color = PlantixTextMuted)
                            Text("${advisory.deltaT}°C (Ideal: 2-8°C)", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Wind Speed:", fontSize = 12.sp, color = PlantixTextMuted)
                            Text("${weather?.windSpeed ?: 11.5} km/h", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Humidity:", fontSize = 12.sp, color = PlantixTextMuted)
                            Text("${weather?.humidity?.toInt() ?: 62}%", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Rain Probability:", fontSize = 12.sp, color = PlantixTextMuted)
                            Text("${weather?.precipitationProbability?.toInt() ?: 0}%", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                        if (advisory.nextOptimalWindow != null) {
                            Spacer(Modifier.height(4.dp))
                            Text(
                                "Next optimal window: ${advisory.nextOptimalWindow}",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = PlantixPrimaryDark
                            )
                        }
                    }
                }
            )
        }
    }
}

@Composable
fun PlantixStepItem(emoji: String, text: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            modifier = Modifier
                .size(54.dp)
                .clip(CircleShape)
                .background(Color(0xFFF3F7F3)),
            contentAlignment = Alignment.Center
        ) {
            Text(emoji, fontSize = 24.sp)
        }
        Spacer(Modifier.height(6.dp))
        Text(
            text,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            color = PlantixText,
            textAlign = TextAlign.Center,
            lineHeight = 16.sp
        )
    }
}

@Composable
fun PlantixSquareToolCard(
    icon: String,
    title: String,
    badge: String? = null,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .width(118.dp)
            .height(138.dp)
            .clip(RoundedCornerShape(20.dp))
            .clickable { onClick() },
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        border = BorderStroke(1.dp, Color(0xFFE2EBE2))
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp)
        ) {
            if (badge != null) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .clip(RoundedCornerShape(8.dp))
                        .background(PlantixBadgePurple)
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(badge, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = PlantixBadgePurpleText)
                }
            }

            Column(
                modifier = Modifier.align(Alignment.BottomStart)
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(Color(0xFFF2F7F2)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(icon, fontSize = 20.sp)
                }
                Spacer(Modifier.height(8.dp))
                Text(
                    title,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = PlantixText,
                    lineHeight = 15.sp
                )
            }
        }
    }
}

@Composable
fun PlantixWideToolTile(
    modifier: Modifier = Modifier,
    icon: String,
    title: String,
    subtitle: String,
    onNavigate: () -> Unit
) {
    Card(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .clickable { onNavigate() },
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.5.dp),
        border = BorderStroke(1.dp, Color(0xFFE5EDE5))
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(38.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color(0xFFF2F6F2)),
                contentAlignment = Alignment.Center
            ) {
                Text(icon, fontSize = 20.sp)
            }
            Spacer(Modifier.width(10.dp))
            Column {
                Text(title, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = PlantixText, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(subtitle, fontSize = 10.sp, color = PlantixTextMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

@Composable
fun RegionalOutbreakAlertSection(
    userState: String,
    alerts: List<OutbreakAlert>,
    loading: Boolean,
    onNavigateToMarket: () -> Unit,
    onNavigateToScan: () -> Unit
) {
    Column(Modifier.padding(horizontal = 16.dp)) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Filled.Warning,
                    contentDescription = null,
                    tint = PlantixPrimary,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    "Regional Disease Watch ($userState)",
                    color = PlantixText,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold
                )
            }
            if (alerts.isNotEmpty()) {
                Text(
                    "${alerts.size} Active",
                    color = PlantixPrimary,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
        Spacer(Modifier.height(10.dp))

        if (loading) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White)
                    .padding(16.dp),
                contentAlignment = Alignment.Center
            ) {
                Text("Scanning regional telemetry...", color = PlantixTextMuted, fontSize = 12.sp)
            }
        } else if (alerts.isEmpty()) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White)
                    .border(1.dp, PlantixBorder, RoundedCornerShape(16.dp))
                    .padding(16.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Filled.CheckCircle,
                        contentDescription = null,
                        tint = PlantixPrimary,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(Modifier.width(10.dp))
                    Column {
                        Text(
                            "Zero Active Outbreaks in $userState",
                            color = PlantixDarkGreen,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            "Crop health is stable. All neighboring zones clear.",
                            color = PlantixTextMuted,
                            fontSize = 11.sp
                        )
                    }
                }
            }
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                alerts.forEach { alert ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                    ) {
                        Column(Modifier.padding(14.dp)) {
                            Row(
                                Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    alert.diseaseName,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = PlantixText
                                )
                                Text(
                                    "${alert.scanCount} Scans",
                                    fontSize = 11.sp,
                                    color = PlantixPrimary,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            Spacer(Modifier.height(4.dp))
                            Text(
                                "Epicenter: ${alert.sourceState} ➔ Target: ${alert.targetState} • ${alert.severity}",
                                fontSize = 11.sp,
                                color = PlantixTextMuted
                            )
                            Spacer(Modifier.height(6.dp))
                            Text(
                                "Risk Alert: Contagious vector threshold exceeded. Recommended: Apply organic BioRx barrier spray.",
                                fontSize = 11.sp,
                                color = PlantixTextDim,
                                lineHeight = 16.sp
                            )
                        }
                    }
                }
            }
        }
    }
}
