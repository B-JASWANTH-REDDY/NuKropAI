package com.example

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*
import kotlin.math.ceil
import kotlin.math.roundToInt

enum class CalculatorType(val title: String, val icon: String) {
    FERTILIZER("Fertilizer Calculator", "🌾"),
    PESTICIDE("Pesticide Calculator", "🧴"),
    FARMING_BUDGET("Farming Budget & Profit", "🧮")
}

@Composable
fun CalculatorsScreen(
    initialTab: CalculatorType = CalculatorType.FERTILIZER,
    onNavigateBack: () -> Unit
) {
    var selectedCalculator by remember { mutableStateOf(initialTab) }
    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PlantixBackground)
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White)
                .statusBarsPadding()
                .padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onNavigateBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = PlantixText)
            }
            Spacer(Modifier.width(4.dp))
            Column {
                Text("Smart Farming Calculators", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = PlantixText)
                Text("Precise dosages, budgets, and yield analytics", fontSize = 11.sp, color = PlantixTextMuted)
            }
        }

        // Top Navigation Tabs
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White)
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            CalculatorType.values().forEach { calc ->
                val isSelected = selectedCalculator == calc
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(20.dp))
                        .background(if (isSelected) PlantixPrimary else Color(0xFFEFF3EF))
                        .clickable { selectedCalculator = calc }
                        .padding(vertical = 8.dp, horizontal = 4.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        "${calc.icon} ${calc.title.split(" ")[0]}",
                        fontSize = 12.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                        color = if (isSelected) Color.White else PlantixText
                    )
                }
            }
        }

        HorizontalDivider(color = PlantixBorder)

        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(scrollState)
                .padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 120.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            when (selectedCalculator) {
                CalculatorType.FERTILIZER -> FertilizerCalculatorView()
                CalculatorType.PESTICIDE -> PesticideCalculatorView()
                CalculatorType.FARMING_BUDGET -> FarmingBudgetCalculatorView()
            }
        }
    }
}

@Composable
fun FertilizerCalculatorView() {
    var acreageText by remember { mutableStateOf("3.0") }
    var selectedCrop by remember { mutableStateOf("Rice / Paddy") }

    val acreage = acreageText.toDoubleOrNull() ?: 1.0

    // Typical NPK recommendation per acre in bags (45kg Urea, 50kg DAP, 50kg MOP)
    val (ureaBags, dapBags, mopBags, sspBags) = when (selectedCrop) {
        "Cotton" -> Tuple4(ceil(2.2 * acreage).toInt(), ceil(1.0 * acreage).toInt(), ceil(0.8 * acreage).toInt(), ceil(1.5 * acreage).toInt())
        "Chilli" -> Tuple4(ceil(2.8 * acreage).toInt(), ceil(1.5 * acreage).toInt(), ceil(1.2 * acreage).toInt(), ceil(2.0 * acreage).toInt())
        "Wheat" -> Tuple4(ceil(1.8 * acreage).toInt(), ceil(1.0 * acreage).toInt(), ceil(0.6 * acreage).toInt(), ceil(1.0 * acreage).toInt())
        else -> Tuple4(ceil(2.0 * acreage).toInt(), ceil(1.0 * acreage).toInt(), ceil(0.8 * acreage).toInt(), ceil(1.2 * acreage).toInt())
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(Modifier.padding(16.dp)) {
            Text("🌾 Fertilizer Requirement Estimator", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = PlantixText)
            Spacer(Modifier.height(12.dp))

            OutlinedTextField(
                value = acreageText,
                onValueChange = { acreageText = it },
                label = { Text("Field Area (in Acres)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            )

            Spacer(Modifier.height(16.dp))
            Text("Select Crop:", fontSize = 12.sp, color = PlantixTextMuted)
            Spacer(Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("Rice / Paddy", "Cotton", "Chilli", "Wheat").forEach { crop ->
                    val isSel = selectedCrop == crop
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (isSel) PlantixBadgeGreen else Color(0xFFF2F4F2))
                            .border(1.dp, if (isSel) PlantixPrimary else Color.Transparent, RoundedCornerShape(12.dp))
                            .clickable { selectedCrop = crop }
                            .padding(horizontal = 10.dp, vertical = 6.dp)
                    ) {
                        Text(crop, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = if (isSel) PlantixPrimary else PlantixText)
                    }
                }
            }

            Spacer(Modifier.height(20.dp))
            HorizontalDivider(color = PlantixBorder)
            Spacer(Modifier.height(14.dp))

            Text("Calculated Fertilizer Bags for $acreage Acres of $selectedCrop:", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = PlantixPrimary)
            Spacer(Modifier.height(10.dp))

            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                FertilizerResultChip("Urea (45kg)", "$ureaBags Bags", "Nitrogen (N)")
                FertilizerResultChip("DAP (50kg)", "$dapBags Bags", "Phosphate (P)")
            }
            Spacer(Modifier.height(8.dp))
            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                FertilizerResultChip("MOP (50kg)", "$mopBags Bags", "Potassium (K)")
                FertilizerResultChip("SSP (50kg)", "$sspBags Bags", "Sulfur + Calcium")
            }

            Spacer(Modifier.height(14.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color(0xFFE8F5E9))
                    .padding(10.dp)
            ) {
                Text("Schedule: Apply 50% DAP & MOP as Basal dose at sowing. Top-dress Urea in 2 split applications at 25 and 45 days.", fontSize = 11.sp, color = PlantixDarkGreen, lineHeight = 16.sp)
            }
        }
    }
}

@Composable
fun FertilizerResultChip(name: String, count: String, role: String) {
    Box(
        modifier = Modifier
            .width(160.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFFF6FAF6))
            .border(1.dp, PlantixBorder, RoundedCornerShape(12.dp))
            .padding(10.dp)
    ) {
        Column {
            Text(name, fontSize = 11.sp, color = PlantixTextMuted)
            Text(count, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = PlantixText)
            Text(role, fontSize = 10.sp, color = PlantixPrimary)
        }
    }
}

@Composable
fun PesticideCalculatorView() {
    var isTreeMode by remember { mutableStateOf(false) }
    var areaOrTreesText by remember { mutableStateOf("2.5") }
    var dosagePerLiterText by remember { mutableStateOf("2.0") }
    var tankCapacityText by remember { mutableStateOf("16") } // 16L Knapsack

    val area = areaOrTreesText.toDoubleOrNull() ?: 1.0
    val dosage = dosagePerLiterText.toDoubleOrNull() ?: 2.0
    val tankCap = tankCapacityText.toDoubleOrNull() ?: 16.0

    // Calculations
    val totalWaterLiters = if (!isTreeMode) area * 200.0 else area * 10.0 // 200L per acre vs 10L per tree
    val totalChemicalMl = totalWaterLiters * dosage
    val totalTanks = ceil(totalWaterLiters / tankCap).toInt()

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(Modifier.padding(16.dp)) {
            Text("🧴 Pesticide & Spray Volume Calculator", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = PlantixText)
            Spacer(Modifier.height(12.dp))

            // Field Crop vs Orchard Tree Toggle
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color(0xFFEFF3EF))
                    .padding(4.dp)
            ) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (!isTreeMode) PlantixPrimary else Color.Transparent)
                        .clickable { isTreeMode = false }
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("🌾 Field Crops (Acres)", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = if (!isTreeMode) Color.White else PlantixText)
                }
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (isTreeMode) PlantixPrimary else Color.Transparent)
                        .clickable { isTreeMode = true }
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("🌳 Fruit Trees (Orchards)", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = if (isTreeMode) Color.White else PlantixText)
                }
            }

            Spacer(Modifier.height(14.dp))

            OutlinedTextField(
                value = areaOrTreesText,
                onValueChange = { areaOrTreesText = it },
                label = { Text(if (!isTreeMode) "Area in Acres" else "Total Number of Trees") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            )

            Spacer(Modifier.height(10.dp))

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = dosagePerLiterText,
                    onValueChange = { dosagePerLiterText = it },
                    label = { Text("Dosage (ml/g per Liter)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                )
                OutlinedTextField(
                    value = tankCapacityText,
                    onValueChange = { tankCapacityText = it },
                    label = { Text("Tank Capacity (L)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                )
            }

            Spacer(Modifier.height(20.dp))
            HorizontalDivider(color = PlantixBorder)
            Spacer(Modifier.height(14.dp))

            Text("Calculated Spray Solution:", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = PlantixPrimary)
            Spacer(Modifier.height(10.dp))

            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                FertilizerResultChip("Chemical Required", "${(totalChemicalMl).toInt()} ml / g", "Concentrate")
                FertilizerResultChip("Total Water Volume", "${totalWaterLiters.toInt()} Liters", "Carrier")
            }
            Spacer(Modifier.height(8.dp))
            FertilizerResultChip("Spray Tanks to Mix", "$totalTanks Tanks (${tankCap.toInt()}L each)", "${(dosage * tankCap).toInt()} ml per tank")
        }
    }
}

@Composable
fun FarmingBudgetCalculatorView() {
    var totalCostText by remember { mutableStateOf("45000") }
    var expectedYieldText by remember { mutableStateOf("25.0") } // Quintals
    var marketPriceText by remember { mutableStateOf("2850") } // Rs/Qtl

    val cost = totalCostText.toDoubleOrNull() ?: 1.0
    val yieldQtl = expectedYieldText.toDoubleOrNull() ?: 1.0
    val priceQtl = marketPriceText.toDoubleOrNull() ?: 1.0

    val noLossPrice = (cost / yieldQtl * 10.0).roundToInt() / 10.0
    val requiredYield = (cost / priceQtl * 10.0).roundToInt() / 10.0
    val grossRevenue = yieldQtl * priceQtl
    val estimatedProfit = grossRevenue - cost
    val maxInputCeiling = grossRevenue * 0.65 // Safe 65% ceiling

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(Modifier.padding(16.dp)) {
            Text("🧮 Farming Budget, Yield & Profitability", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = PlantixText)
            Spacer(Modifier.height(12.dp))

            OutlinedTextField(
                value = totalCostText,
                onValueChange = { totalCostText = it },
                label = { Text("Total Input & Labor Expenses (₹)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            )
            Spacer(Modifier.height(10.dp))

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = expectedYieldText,
                    onValueChange = { expectedYieldText = it },
                    label = { Text("Expected Yield (Qtl)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                )
                OutlinedTextField(
                    value = marketPriceText,
                    onValueChange = { marketPriceText = it },
                    label = { Text("Selling Price (₹/Qtl)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                )
            }

            Spacer(Modifier.height(20.dp))
            HorizontalDivider(color = PlantixBorder)
            Spacer(Modifier.height(14.dp))

            Text("Financial Feasibility Summary:", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = PlantixPrimary)
            Spacer(Modifier.height(10.dp))

            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                FertilizerResultChip("No-Loss Price", "₹$noLossPrice/Qtl", "Break-even threshold")
                FertilizerResultChip("Required Yield", "$requiredYield Qtl", "To cover ₹${cost.toInt()}")
            }
            Spacer(Modifier.height(8.dp))
            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                FertilizerResultChip("Estimated Profit", "₹${estimatedProfit.toInt()}", if (estimatedProfit >= 0) "Net Gain" else "Loss")
                FertilizerResultChip("Max Safe Budget", "₹${maxInputCeiling.toInt()}", "65% of gross revenue")
            }
        }
    }
}

private data class Tuple4<A, B, C, D>(val first: A, val second: B, val third: C, val fourth: D)
