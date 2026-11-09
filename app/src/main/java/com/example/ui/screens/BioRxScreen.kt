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
import com.example.biorx.BioRxEngine
import com.example.biorx.OrganicFormulationType
import com.example.ui.theme.*

@Composable
fun BioRxScreen(onNavigateBack: () -> Unit) {
    val scrollState = rememberScrollState()
    var selectedFormulation by remember { mutableStateOf(OrganicFormulationType.JEEVAMRUTHA) }
    var acreage by remember { mutableStateOf(4.5) }

    val prescription = remember(selectedFormulation, acreage) {
        BioRxEngine.calculatePrescription(selectedFormulation, acreage)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(Color(0xFF09140B), NuKropDark)))
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
                Text("BioRx Organic Formulator", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                Text("Indigenous Formulations & Scaled Dosages", fontSize = 11.sp, color = NuKropAccent)
            }
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(scrollState)
                .padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 120.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Formulation Selector Horizontal Chips
            Text("Select Indigenous Recipe Formulation:", fontSize = 13.sp, color = NuKropTextMuted, fontWeight = FontWeight.SemiBold)
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(
                    OrganicFormulationType.JEEVAMRUTHA,
                    OrganicFormulationType.NEEMASTRA,
                    OrganicFormulationType.BEEJAMRUTHA,
                    OrganicFormulationType.DASHAPARNI_ARK
                ).forEach { form ->
                    val isSelected = selectedFormulation == form
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (isSelected) NuKropBadgeGreen.copy(alpha = 0.2f) else NuKropCard)
                            .border(1.dp, if (isSelected) NuKropBadgeGreen else Color(0x20FFFFFF), RoundedCornerShape(12.dp))
                            .clickable { selectedFormulation = form }
                            .padding(12.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(form.icon, fontSize = 20.sp)
                            Spacer(Modifier.width(10.dp))
                            Column {
                                Text(form.title, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                                Text(form.purpose, fontSize = 11.sp, color = NuKropTextMuted)
                            }
                        }
                    }
                }
            }

            // Acreage Calibration Slider Card
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
                        Text("Target Farm Area: $acreage Acres", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                        Text("Saved ₹${prescription.costSavedVsChemicalPesticidesRupees.toInt()}", fontSize = 12.sp, color = NuKropBadgeGreen, fontWeight = FontWeight.Bold)
                    }
                    Slider(
                        value = acreage.toFloat(),
                        onValueChange = { acreage = ((it * 2).toInt() / 2.0).coerceAtLeast(0.5) },
                        valueRange = 0.5f..15f,
                        steps = 28,
                        colors = SliderDefaults.colors(thumbColor = NuKropAccent, activeTrackColor = NuKropAccent)
                    )
                }
            }

            // Scaled Ingredients Checklist
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(NuKropCard)
                    .border(1.dp, Color(0x30FFFFFF), RoundedCornerShape(16.dp))
                    .padding(16.dp)
            ) {
                Column {
                    Text("🧪 Calibrated Ingredients for $acreage Acres", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NuKropAccent)
                    Spacer(Modifier.height(10.dp))
                    prescription.scaledIngredients.forEach { ing ->
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(Modifier.weight(1f)) {
                                Text(ing.ingredientName, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = NuKropText)
                                Text(ing.roleInFormulation, fontSize = 10.sp, color = NuKropTextDim)
                            }
                            Text(ing.scaledQuantityFormatted, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = NuKropBadgeGreen)
                        }
                    }
                }
            }

            // Step-by-Step Preparation Protocol
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(NuKropCard)
                    .border(1.dp, NuKropBadgeGreen.copy(alpha = 0.3f), RoundedCornerShape(16.dp))
                    .padding(16.dp)
            ) {
                Column {
                    Text("📜 Step-by-Step Preparation Protocol", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NuKropBadgeGreen)
                    Spacer(Modifier.height(8.dp))
                    prescription.preparationSteps.forEach { step ->
                        Text(step, fontSize = 12.sp, color = NuKropText, lineHeight = 18.sp, modifier = Modifier.padding(vertical = 2.dp))
                    }
                    Spacer(Modifier.height(8.dp))
                    Text("Application: ${prescription.applicationMethod}", fontSize = 11.sp, color = NuKropAccent, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}
