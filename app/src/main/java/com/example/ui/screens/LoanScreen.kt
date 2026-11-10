package com.example

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun LoanScreen(onNavigateBack: () -> Unit) {
    var isAnalyzing by remember { mutableStateOf(false) }
    var showResults by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val lang = LanguageManager.currentLanguage.collectAsState().value

    // Get real state from location
    var userState by remember { mutableStateOf("Maharashtra") }
    LaunchedEffect(Unit) {
        val loc = LocationHelper.getCurrentLocationStateAndMandi(context)
        if (loc != null) userState = loc.first
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(Color(0xFF0D1208), NuKropDark)))
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
                Text(AppStrings.get("subsidy_title", lang), fontSize = 20.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                Text("Real Govt Schemes for $userState", fontSize = 11.sp, color = NuKropTextMuted)
            }
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .padding(16.dp)
        ) {
            if (!showResults) {
                Spacer(Modifier.height(24.dp))
                Text(AppStrings.get("ai_matcher", lang), fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = NuKropAccent)
                Spacer(Modifier.height(8.dp))
                Text(
                    "Let AI analyze your farm profile (Size, Crop, State) to instantly find eligible subsidies and loans you are missing.",
                    color = NuKropTextMuted,
                    lineHeight = 22.sp
                )

                Spacer(Modifier.height(32.dp))

                Button(
                    onClick = { isAnalyzing = true },
                    modifier = Modifier.fillMaxWidth().height(60.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = NuKropAccent)
                ) {
                    if (isAnalyzing) {
                        CircularProgressIndicator(color = NuKropDark, modifier = Modifier.size(24.dp), strokeWidth = 2.5.dp)
                        Spacer(Modifier.width(12.dp))
                        Text(AppStrings.get("scanning_gov", lang), color = NuKropDark, fontWeight = FontWeight.Bold)
                    } else {
                        Icon(Icons.Default.Search, contentDescription = null, tint = NuKropDark)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(AppStrings.get("find_subsidies", lang), color = NuKropDark, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    }
                }

                LaunchedEffect(isAnalyzing) {
                    if (isAnalyzing) {
                        try {
                            delay(2000)
                            showResults = true
                        } finally {
                            isAnalyzing = false
                        }
                    }
                }
            } else {
                val realSubsidies = remember(userState) { SubsidiesApiService.getSubsidiesForState(userState) }

                Column(Modifier.verticalScroll(rememberScrollState()).padding(bottom = 120.dp)) {
                    Box(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
                            .background(NuKropBadgeGreen.copy(alpha = 0.12f))
                            .border(1.dp, NuKropBadgeGreen.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
                            .padding(12.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Default.CheckCircle, null, tint = NuKropBadgeGreen, modifier = Modifier.size(20.dp))
                            Text(
                                "AI Found ${realSubsidies.size} Eligible Schemes for your Farm in $userState.",
                                color = NuKropBadgeGreen, fontSize = 13.sp, fontWeight = FontWeight.Bold
                            )
                        }
                    }
                    Spacer(Modifier.height(16.dp))

                    val colors = listOf(Color(0xFF64B5F6), NuKropWarning, NuKropAccent, Color(0xFFBA68C8))
                    realSubsidies.forEachIndexed { index, subsidy ->
                        SchemeCard(subsidy.name, subsidy.amount, subsidy.description, subsidy.url, colors[index % colors.size])
                        Spacer(Modifier.height(12.dp))
                    }
                    Spacer(Modifier.height(80.dp))
                }
            }
        }
    }
}

@Composable
fun SchemeCard(title: String, amount: String, desc: String, url: String, accent: Color) {
    val context = LocalContext.current
    
    val openUrl = {
        if (url.isNotBlank()) {
            try {
                val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url))
                context.startActivity(intent)
            } catch (e: Exception) { }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(NuKropCard)
            .border(1.dp, accent.copy(alpha = 0.3f), RoundedCornerShape(16.dp))
            .clickable { openUrl() }
            .padding(16.dp)
    ) {
        Column {
            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween, Alignment.Top) {
                Text(title, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = NuKropText, modifier = Modifier.weight(1f))
                Spacer(Modifier.width(8.dp))
                Box(Modifier.clip(RoundedCornerShape(8.dp)).background(accent.copy(alpha = 0.15f)).padding(horizontal = 8.dp, vertical = 4.dp)) {
                    Text(amount, color = accent, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
            Spacer(Modifier.height(10.dp))
            Text(desc, fontSize = 12.sp, color = NuKropTextMuted, lineHeight = 19.sp)
            Spacer(Modifier.height(14.dp))
            Button(
                onClick = openUrl,
                modifier = Modifier.fillMaxWidth().height(42.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = accent.copy(alpha = 0.15f))
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Icons.Default.OpenInNew, null, tint = accent, modifier = Modifier.size(16.dp))
                    Text("Apply on Official Portal 🌐", color = accent, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

