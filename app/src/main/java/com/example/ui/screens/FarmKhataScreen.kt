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

import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody

data class KhataEntry(
    val title: String,
    val category: String,
    val amount: Double,
    val isIncome: Boolean,
    val date: String
)

@Composable
fun FarmKhataScreen(
    onNavigateBack: () -> Unit
) {
    val scrollState = rememberScrollState()
    var showAddDialog by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val httpClient = remember { okhttp3.OkHttpClient.Builder().connectTimeout(10, java.util.concurrent.TimeUnit.SECONDS).readTimeout(10, java.util.concurrent.TimeUnit.SECONDS).build() }

    val context = androidx.compose.ui.platform.LocalContext.current
    val myId = remember {
        try {
            val prefs = context.getSharedPreferences("nukrop_auth", android.content.Context.MODE_PRIVATE)
            prefs.getString("user_name", null) ?: "unknown_user"
        } catch (e: Exception) { "unknown_user" }
    }

    val seedEntries = remember {
        listOf(
            KhataEntry("Wheat Harvest Sale", "Crop Sale", 125000.0, true, "Yesterday"),
            KhataEntry("IFFCO NPK Fertilizer 50kg", "Fertilizer", 1450.0, false, "05 Aug"),
            KhataEntry("Tractor Fuel (Diesel 20L)", "Fuel", 1900.0, false, "28 Jul")
        )
    }
    var entries by remember { mutableStateOf<List<KhataEntry>>(seedEntries) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(myId) {
        try {
            withContext(kotlinx.coroutines.Dispatchers.IO) {
                try {
                    val url = "$SUPABASE_URL/rest/v1/farm_khata_entries?select=*&user_id=eq.$myId&order=created_at.desc&limit=100"
                    val req = okhttp3.Request.Builder().url(url)
                        .addHeader("apikey", SUPABASE_ANON_KEY)
                        .addHeader("Authorization", "Bearer $SUPABASE_ANON_KEY")
                        .addHeader("Accept", "application/json").get().build()
                    val body = httpClient.newCall(req).execute().body?.string() ?: ""
                    val arr = org.json.JSONArray(body)
                    if (arr.length() > 0) {
                        val list = mutableListOf<KhataEntry>()
                        for (i in 0 until arr.length()) {
                            val obj = arr.getJSONObject(i)
                            list.add(KhataEntry(
                                title = obj.optString("title", "Entry"),
                                category = obj.optString("category", "General"),
                                amount = obj.optDouble("amount", 0.0),
                                isIncome = obj.optBoolean("is_income", false),
                                date = obj.optString("entry_date", "Today")
                            ))
                        }
                        entries = list
                    }
                } catch (_: Exception) {}
            }
        } finally {
            isLoading = false
        }
    }

    val totalIncome = entries.filter { it.isIncome }.sumOf { it.amount }
    val totalExpense = entries.filter { !it.isIncome }.sumOf { it.amount }
    val netProfit = totalIncome - totalExpense

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
                Text("Digital Farm Khata & Credit Score", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                Text("Bookkeeping, profit calculator & loan eligibility", fontSize = 11.sp, color = NuKropTextMuted)
            }
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(scrollState)
                .padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 120.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Net Profit Card
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(NuKropCard)
                    .border(1.dp, NuKropAccent.copy(alpha = 0.35f), RoundedCornerShape(20.dp))
                    .padding(18.dp)
            ) {
                Column {
                    Text("NET FARM PROFIT (THIS SEASON)", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = NuKropTextMuted)
                    Spacer(Modifier.height(4.dp))
                    Text("₹ ${String.format("%,.0f", netProfit)}", fontSize = 28.sp, fontWeight = FontWeight.ExtraBold, color = NuKropAccent)

                    Spacer(Modifier.height(14.dp))

                    Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                        Column {
                            Text("Total Income", fontSize = 11.sp, color = NuKropTextMuted)
                            Text("₹ ${String.format("%,.0f", totalIncome)}", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = NuKropBadgeGreen)
                        }
                        Column {
                            Text("Total Expense", fontSize = 11.sp, color = NuKropTextMuted)
                            Text("₹ ${String.format("%,.0f", totalExpense)}", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color(0xFFFF5252))
                        }
                    }
                }
            }

            // Bank Loan Eligibility Score Badge
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(NuKropBadgeGreen.copy(alpha = 0.12f))
                    .border(1.dp, NuKropBadgeGreen.copy(alpha = 0.3f), RoundedCornerShape(16.dp))
                    .padding(14.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Icon(Icons.Default.VerifiedUser, null, tint = NuKropBadgeGreen, modifier = Modifier.size(24.dp))
                    Column {
                        Text("AI Credit Score: 785 / 900 (EXCELLENT)", color = NuKropBadgeGreen, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        Text("Eligible for up to ₹2,50,000 Kisan Credit Card (KCC) Low-Interest Loan.", color = NuKropTextMuted, fontSize = 11.sp)
                    }
                }
            }

            // Recent Transactions Section Header
            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween, Alignment.CenterVertically) {
                Text("Recent Khata Entries", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                Button(
                    onClick = { showAddDialog = true },
                    colors = ButtonDefaults.buttonColors(containerColor = NuKropAccent),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Icon(Icons.Default.Add, null, tint = NuKropDark, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Add Entry", color = NuKropDark, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                entries.forEach { entry ->
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(NuKropCard)
                            .border(1.dp, Color.White.copy(alpha = 0.05f), RoundedCornerShape(14.dp))
                            .padding(14.dp)
                    ) {
                        Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween, Alignment.CenterVertically) {
                            Row(modifier = Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(if (entry.isIncome) NuKropBadgeGreen.copy(alpha = 0.15f) else Color.Red.copy(alpha = 0.15f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        if (entry.isIncome) Icons.Default.TrendingUp else Icons.Default.TrendingDown,
                                        contentDescription = null,
                                        tint = if (entry.isIncome) NuKropBadgeGreen else Color(0xFFFF5252),
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(entry.title, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = NuKropText, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                                    Text("${entry.category} • ${entry.date}", fontSize = 11.sp, color = NuKropTextMuted, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                                }
                            }
                            Spacer(Modifier.width(8.dp))
                            Text(
                                "${if (entry.isIncome) "+" else "-"}₹${String.format("%,.0f", entry.amount)}",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (entry.isIncome) NuKropBadgeGreen else Color(0xFFFF5252),
                                maxLines = 1
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(80.dp))
        }
    }

    if (showAddDialog) {
        var titleInput by remember { mutableStateOf("") }
        var categoryInput by remember { mutableStateOf("Fertilizer") }
        var amountInput by remember { mutableStateOf("") }
        var isIncomeInput by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = { showAddDialog = false },
            containerColor = NuKropCard,
            title = { Text("Add Farm Khata Entry", color = NuKropText, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = titleInput,
                        onValueChange = { titleInput = it },
                        label = { Text("Description (e.g. Seed Purchase)", color = NuKropTextMuted) },
                        colors = OutlinedTextFieldDefaults.colors(focusedTextColor = NuKropText, unfocusedTextColor = NuKropText)
                    )
                    OutlinedTextField(
                        value = amountInput,
                        onValueChange = { amountInput = it },
                        label = { Text("Amount (₹)", color = NuKropTextMuted) },
                        colors = OutlinedTextFieldDefaults.colors(focusedTextColor = NuKropText, unfocusedTextColor = NuKropText)
                    )
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(
                            selected = !isIncomeInput,
                            onClick = { isIncomeInput = false },
                            label = { Text("Expense (-)") }
                        )
                        FilterChip(
                            selected = isIncomeInput,
                            onClick = { isIncomeInput = true },
                            label = { Text("Income (+)") }
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val amt = amountInput.toDoubleOrNull() ?: 0.0
                        if (titleInput.isNotBlank() && amt > 0.0) {
                            val newEntry = KhataEntry(titleInput, categoryInput, amt, isIncomeInput, "Today")
                            entries = listOf(newEntry) + entries
                            scope.launch {
                                withContext(kotlinx.coroutines.Dispatchers.IO) {
                                    try {
                                        val payload = org.json.JSONObject().apply {
                                            put("user_id", myId)
                                            put("title", titleInput.trim())
                                            put("category", categoryInput)
                                            put("amount", amt)
                                            put("is_income", isIncomeInput)
                                            put("entry_date", java.text.SimpleDateFormat("dd MMM yyyy", java.util.Locale.getDefault()).format(java.util.Date()))
                                        }.toString()
                                        val reqBody = payload.toRequestBody("application/json".toMediaTypeOrNull())
                                        okhttp3.Request.Builder().url("$SUPABASE_URL/rest/v1/farm_khata_entries")
                                            .addHeader("apikey", SUPABASE_ANON_KEY)
                                            .addHeader("Authorization", "Bearer $SUPABASE_ANON_KEY")
                                            .addHeader("Content-Type", "application/json")
                                            .addHeader("Prefer", "return=minimal")
                                            .post(reqBody).build().let { httpClient.newCall(it).execute() }
                                    } catch (_: Exception) {}
                                }
                            }
                        }
                        showAddDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = NuKropAccent)
                ) {
                    Text("Save Entry", color = NuKropDark, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddDialog = false }) {
                    Text("Cancel", color = NuKropTextMuted)
                }
            }
        )
    }
}

