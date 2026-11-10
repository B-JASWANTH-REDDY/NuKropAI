package com.example

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Chat
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import androidx.compose.runtime.rememberCoroutineScope

data class EquipmentItem(
    val id: String = java.util.UUID.randomUUID().toString(),
    val name: String,
    val category: String,
    val rate: String,
    val owner: String,
    val distance: String,
    val phone: String,
    val isAvailable: Boolean,
    val icon: String
)

@Composable
fun EquipmentRentalScreen(
    onNavigateBack: () -> Unit,
    onNavigateToPeerChat: (name: String, info: String, phone: String) -> Unit
) {
    val context = LocalContext.current
    val scrollState = rememberScrollState()
    var showAddDialog by remember { mutableStateOf(false) }

    val seedEquipment = remember {
        listOf(
            EquipmentItem(name = "Mahindra 575 DI Tractor (45 HP)", category = "Tractor & Tillage", rate = "₹450 / Hour", owner = "Verma Farms", distance = "Nearby", phone = "9876543210", isAvailable = true, icon = "🚜"),
            EquipmentItem(name = "DJI Agras T40 Spraying Drone", category = "Pesticide Drone", rate = "₹350 / Acre", owner = "AgriTech Co-op", distance = "Nearby", phone = "9812345678", isAvailable = true, icon = "🛸"),
            EquipmentItem(name = "Solar Drip Irrigation Pump", category = "Irrigation", rate = "₹150 / Day", owner = "Ramesh Singh", distance = "Nearby", phone = "9988776655", isAvailable = true, icon = "💧")
        )
    }
    var equipmentList by remember { mutableStateOf<List<EquipmentItem>>(seedEquipment) }
    var isLoadingEquipment by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()
    val httpClient2 = remember { okhttp3.OkHttpClient.Builder().connectTimeout(10, java.util.concurrent.TimeUnit.SECONDS).readTimeout(10, java.util.concurrent.TimeUnit.SECONDS).build() }

    LaunchedEffect(Unit) {
        try {
            withContext(kotlinx.coroutines.Dispatchers.IO) {
                try {
                    val url = "$SUPABASE_URL/rest/v1/equipment_listings?select=*&order=created_at.desc&limit=50"
                    val req = okhttp3.Request.Builder().url(url)
                        .addHeader("apikey", SUPABASE_ANON_KEY)
                        .addHeader("Authorization", "Bearer $SUPABASE_ANON_KEY")
                        .addHeader("Accept", "application/json").get().build()
                    val body = httpClient2.newCall(req).execute().body?.string() ?: ""
                    val arr = org.json.JSONArray(body)
                    if (arr.length() > 0) {
                        val list = mutableListOf<EquipmentItem>()
                        for (i in 0 until arr.length()) {
                            val obj = arr.getJSONObject(i)
                            list.add(EquipmentItem(
                                id = obj.optString("id", java.util.UUID.randomUUID().toString()),
                                name = obj.optString("name", "Equipment"),
                                category = obj.optString("category", "General"),
                                rate = obj.optString("rate", "Contact Owner"),
                                owner = obj.optString("owner_name", "Farmer"),
                                distance = obj.optString("location", "Nearby"),
                                phone = obj.optString("phone", "0000000000"),
                                isAvailable = obj.optBoolean("is_available", true),
                                icon = obj.optString("icon", "🚜")
                            ))
                        }
                        equipmentList = list
                    }
                } catch (_: Exception) {}
            }
        } finally {
            isLoadingEquipment = false
        }
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
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onNavigateBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = NuKropText)
                }
                Spacer(Modifier.width(4.dp))
                Column {
                    Text("P2P Equipment & Drone Rental", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                    Text("Rent tractors, drones & machinery directly", fontSize = 11.sp, color = NuKropTextMuted)
                }
            }

            Button(
                onClick = { showAddDialog = true },
                colors = ButtonDefaults.buttonColors(containerColor = NuKropAccent),
                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                shape = RoundedCornerShape(8.dp)
            ) {
                Icon(Icons.Default.Add, null, tint = NuKropDark, modifier = Modifier.size(14.dp))
                Spacer(Modifier.width(4.dp))
                Text("List Mine", color = NuKropDark, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(scrollState)
                .padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 120.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Banner
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(NuKropBadgeGreen.copy(alpha = 0.12f))
                    .border(1.dp, NuKropBadgeGreen.copy(alpha = 0.3f), RoundedCornerShape(16.dp))
                    .padding(16.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("🚜", fontSize = 32.sp)
                    Column {
                        Text("Nearby Rental Marketplace", color = NuKropBadgeGreen, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        Text("Save 60% machinery cost by renting directly from verified nearby farmers.", color = NuKropTextMuted, fontSize = 11.sp)
                    }
                }
            }

            equipmentList.forEach { item ->
                EquipmentCard(
                    item = item,
                    onChatClick = { onNavigateToPeerChat(item.owner, item.name, item.phone) },
                    onCallClick = {
                        try {
                            val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:${item.phone}"))
                            context.startActivity(intent)
                        } catch (_: Exception) {}
                    }
                )
            }

            Spacer(Modifier.height(80.dp))
        }
    }

    if (showAddDialog) {
        var nameInput by remember { mutableStateOf("") }
        var categoryInput by remember { mutableStateOf("Tractor") }
        var rateInput by remember { mutableStateOf("") }
        var phoneInput by remember { mutableStateOf("") }
        var locationInput by remember { mutableStateOf("Pune, Maharashtra") }

        AlertDialog(
            onDismissRequest = { showAddDialog = false },
            containerColor = NuKropCard,
            title = { Text("List Vehicle / Equipment", color = NuKropText, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = nameInput,
                        onValueChange = { nameInput = it },
                        label = { Text("Vehicle Name (e.g. Swaraj 744 FE)", color = NuKropTextMuted) },
                        colors = OutlinedTextFieldDefaults.colors(focusedTextColor = NuKropText, unfocusedTextColor = NuKropText)
                    )
                    OutlinedTextField(
                        value = rateInput,
                        onValueChange = { rateInput = it },
                        label = { Text("Rental Rate (e.g. ₹400 / Hour)", color = NuKropTextMuted) },
                        colors = OutlinedTextFieldDefaults.colors(focusedTextColor = NuKropText, unfocusedTextColor = NuKropText)
                    )
                    OutlinedTextField(
                        value = phoneInput,
                        onValueChange = { phoneInput = it },
                        label = { Text("Phone Number", color = NuKropTextMuted) },
                        colors = OutlinedTextFieldDefaults.colors(focusedTextColor = NuKropText, unfocusedTextColor = NuKropText)
                    )
                    OutlinedTextField(
                        value = locationInput,
                        onValueChange = { locationInput = it },
                        label = { Text("Location / District", color = NuKropTextMuted) },
                        colors = OutlinedTextFieldDefaults.colors(focusedTextColor = NuKropText, unfocusedTextColor = NuKropText)
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (nameInput.isNotBlank() && rateInput.isNotBlank()) {
                            val newItem = EquipmentItem(
                                name = nameInput.trim(),
                                category = categoryInput,
                                rate = rateInput.trim(),
                                owner = "My Listed Vehicle",
                                distance = locationInput,
                                phone = if (phoneInput.isBlank()) "9876543210" else phoneInput.trim(),
                                isAvailable = true,
                                icon = if (categoryInput.contains("Drone", ignoreCase = true)) "🛸" else "🚜"
                            )
                            equipmentList = listOf(newItem) + equipmentList
                            
                            scope.launch {
                                withContext(kotlinx.coroutines.Dispatchers.IO) {
                                    try {
                                        val payload = org.json.JSONObject().apply {
                                            put("name", nameInput.trim())
                                            put("category", categoryInput)
                                            put("rate", rateInput.trim())
                                            put("owner_name", "My Farm")
                                            put("location", locationInput.trim())
                                            put("phone", if (phoneInput.isBlank()) "9876543210" else phoneInput.trim())
                                            put("is_available", true)
                                            put("icon", if (categoryInput.contains("Drone", ignoreCase = true)) "🛸" else "🚜")
                                        }.toString()
                                        val reqBody = payload.toRequestBody("application/json".toMediaTypeOrNull())
                                        okhttp3.Request.Builder().url("$SUPABASE_URL/rest/v1/equipment_listings")
                                            .addHeader("apikey", SUPABASE_ANON_KEY)
                                            .addHeader("Authorization", "Bearer $SUPABASE_ANON_KEY")
                                            .addHeader("Content-Type", "application/json")
                                            .addHeader("Prefer", "return=minimal")
                                            .post(reqBody).build().let { httpClient2.newCall(it).execute() }
                                    } catch (_: Exception) {}
                                }
                            }
                        }
                        showAddDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = NuKropAccent)
                ) {
                    Text("Publish Listing", color = NuKropDark, fontWeight = FontWeight.Bold)
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

@Composable
fun EquipmentCard(item: EquipmentItem, onChatClick: () -> Unit, onCallClick: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(NuKropCard)
            .border(1.dp, if (item.isAvailable) NuKropAccent.copy(alpha = 0.3f) else Color.Gray.copy(alpha = 0.2f), RoundedCornerShape(16.dp))
            .padding(16.dp)
    ) {
        Column {
            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween, Alignment.Top) {
                Row(modifier = Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .clip(CircleShape)
                            .background(NuKropAccent.copy(alpha = 0.15f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(item.icon, fontSize = 22.sp)
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(item.name, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NuKropText, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                        Text("${item.category} • ${item.distance}", fontSize = 11.sp, color = NuKropTextMuted, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                    }
                }
                Spacer(Modifier.width(8.dp))
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (item.isAvailable) NuKropBadgeGreen.copy(alpha = 0.15f) else Color.Red.copy(alpha = 0.15f))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        if (item.isAvailable) "AVAILABLE" else "BOOKED",
                        color = if (item.isAvailable) NuKropBadgeGreen else Color.Red,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(Modifier.height(12.dp))

            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween, Alignment.CenterVertically) {
                Text(item.rate, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, color = NuKropAccent)
                Text(item.owner, fontSize = 11.sp, color = NuKropTextMuted)
            }

            Spacer(Modifier.height(14.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = onCallClick,
                    enabled = item.isAvailable,
                    modifier = Modifier.weight(1f).height(40.dp),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = NuKropAccent.copy(alpha = 0.2f))
                ) {
                    Icon(Icons.Default.Phone, null, tint = NuKropAccent, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Call Owner", color = NuKropAccent, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }

                Button(
                    onClick = onChatClick,
                    modifier = Modifier.weight(1f).height(40.dp),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = NuKropBadgeGreen.copy(alpha = 0.2f))
                ) {
                    Icon(Icons.AutoMirrored.Filled.Chat, null, tint = NuKropBadgeGreen, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Chat / Book", color = NuKropBadgeGreen, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
