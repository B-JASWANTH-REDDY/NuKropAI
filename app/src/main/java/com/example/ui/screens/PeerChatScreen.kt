package com.example

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Phone
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
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

data class PeerMessage(
    val id: String,
    val text: String,
    val isFromMe: Boolean,
    val timestamp: String
)

private val chatHttpClient = OkHttpClient.Builder()
    .connectTimeout(10, TimeUnit.SECONDS)
    .readTimeout(10, TimeUnit.SECONDS)
    .build()

suspend fun fetchPeerMessages(myId: String, recipientId: String): List<PeerMessage> = withContext(Dispatchers.IO) {
    try {
        val url = "$SUPABASE_URL/rest/v1/peer_messages?or=(and(sender_id.eq.${myId},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${myId}))&order=created_at.asc&limit=100"
        val req = Request.Builder().url(url)
            .addHeader("apikey", SUPABASE_ANON_KEY)
            .addHeader("Authorization", "Bearer $SUPABASE_ANON_KEY")
            .addHeader("Accept", "application/json").get().build()
        val body = chatHttpClient.newCall(req).execute().body?.string() ?: return@withContext emptyList()
        val arr = JSONArray(body)
        val list = mutableListOf<PeerMessage>()
        for (i in 0 until arr.length()) {
            val obj = arr.getJSONObject(i)
            val ts = obj.optString("created_at", "")
            val formatted = if (ts.length >= 16) ts.substring(11, 16) else ts
            list.add(PeerMessage(
                id = obj.optString("id", "$i"),
                text = obj.optString("message", ""),
                isFromMe = obj.optString("sender_id", "") == myId,
                timestamp = formatted
            ))
        }
        list
    } catch (e: Exception) { emptyList() }
}

suspend fun sendPeerMessage(myId: String, recipientId: String, text: String): Boolean = withContext(Dispatchers.IO) {
    try {
        val payload = JSONObject().apply {
            put("sender_id", myId)
            put("recipient_id", recipientId)
            put("message", text)
        }.toString()
        val body = payload.toRequestBody("application/json".toMediaTypeOrNull())
        val req = Request.Builder().url("$SUPABASE_URL/rest/v1/peer_messages")
            .addHeader("apikey", SUPABASE_ANON_KEY)
            .addHeader("Authorization", "Bearer $SUPABASE_ANON_KEY")
            .addHeader("Content-Type", "application/json")
            .addHeader("Prefer", "return=minimal")
            .post(body).build()
        val response = chatHttpClient.newCall(req).execute()
        response.isSuccessful
    } catch (e: Exception) { false }
}

@Composable
fun PeerChatScreen(
    recipientName: String,
    recipientInfo: String,
    recipientPhone: String = "9876543210",
    onNavigateBack: () -> Unit
) {
    val context = LocalContext.current
    var input by remember { mutableStateOf("") }
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()

    // Use logged-in user email as ID, fallback to device ID
    val myId = remember {
        try {
            val prefs = context.getSharedPreferences("nukrop_auth", android.content.Context.MODE_PRIVATE)
            prefs.getString("user_name", null) ?: android.provider.Settings.Secure.getString(context.contentResolver, android.provider.Settings.Secure.ANDROID_ID) ?: "unknown_user"
        } catch (e: Exception) { "unknown_user" }
    }
    val recipientId = recipientName.lowercase().replace(" ", "_")

    var messages by remember { mutableStateOf<List<PeerMessage>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var isSending by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    // Load messages and poll every 5 seconds
    LaunchedEffect(myId, recipientId) {
        while (true) {
            val fetched = fetchPeerMessages(myId, recipientId)
            if (fetched.isNotEmpty() || isLoading) {
                messages = fetched
                isLoading = false
                if (fetched.isNotEmpty()) {
                    listState.animateScrollToItem(fetched.size - 1)
                }
            }
            if (isLoading) isLoading = false
            delay(5000L)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(Color(0xFF0D1208), NuKropDark)))
    ) {
        // Header Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xCC141A0A))
                .statusBarsPadding()
                .padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(modifier = Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onNavigateBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = NuKropText)
                }
                Box(
                    modifier = Modifier.size(40.dp).clip(CircleShape)
                        .background(NuKropAccent.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(recipientName.take(1).uppercase(), color = NuKropAccent, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                }
                Spacer(Modifier.width(10.dp))
                Column(modifier = Modifier.weight(1f, fill = false)) {
                    Text(recipientName, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = NuKropText, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                    Text(recipientInfo, fontSize = 11.sp, color = NuKropBadgeGreen, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                }
            }
            IconButton(onClick = {
                try { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$recipientPhone"))) } catch (_: Exception) {}
            }) {
                Icon(Icons.Default.Phone, contentDescription = "Call", tint = NuKropAccent)
            }
        }

        // Messages List
        Box(modifier = Modifier.weight(1f)) {
            if (isLoading) {
                CircularProgressIndicator(
                    color = NuKropAccent,
                    modifier = Modifier.align(Alignment.Center)
                )
            } else if (messages.isEmpty()) {
                Column(
                    modifier = Modifier.align(Alignment.Center),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("💬", fontSize = 48.sp)
                    Spacer(Modifier.height(8.dp))
                    Text("No messages yet. Say hello!", color = NuKropTextMuted, fontSize = 14.sp)
                    Spacer(Modifier.height(4.dp))
                    Text("Messages are saved securely in the cloud.", color = NuKropTextDim, fontSize = 11.sp)
                }
            } else {
                LazyColumn(
                    state = listState,
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 120.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(messages, key = { it.id }) { msg ->
                        PeerMessageBubble(msg)
                    }
                }
            }
        }

        errorMessage?.let { err ->
            Text(
                err,
                color = Color(0xFFFF6B6B),
                fontSize = 11.sp,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 2.dp)
            )
        }

        // Input Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xEE141A0A))
                .imePadding()
                .navigationBarsPadding()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedTextField(
                value = input,
                onValueChange = { input = it },
                placeholder = { Text("Type message to $recipientName...", fontSize = 13.sp, color = NuKropTextDim) },
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(24.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = NuKropCard,
                    unfocusedContainerColor = NuKropCard,
                    focusedBorderColor = NuKropAccent,
                    unfocusedBorderColor = Color(0x30FFFFFF),
                    focusedTextColor = NuKropText,
                    unfocusedTextColor = NuKropText
                ),
                maxLines = 3,
                enabled = !isSending
            )
            IconButton(
                onClick = {
                    val msg = input.trim()
                    if (msg.isNotBlank() && !isSending) {
                        isSending = true
                        errorMessage = null
                        val optimistic = PeerMessage(
                            id = System.currentTimeMillis().toString(),
                            text = msg,
                            isFromMe = true,
                            timestamp = java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault()).format(java.util.Date())
                        )
                        messages = messages + optimistic
                        input = ""
                        scope.launch {
                            try {
                                val ok = sendPeerMessage(myId, recipientId, msg)
                                if (!ok) {
                                    errorMessage = "⚠ Message failed to send. Check your internet connection."
                                    messages = messages.filter { it.id != optimistic.id }
                                }
                            } catch (e: Exception) {
                                errorMessage = "⚠ Message failed to send: ${e.message}"
                                messages = messages.filter { it.id != optimistic.id }
                            } finally {
                                isSending = false
                            }
                        }
                    }
                },
                modifier = Modifier.size(48.dp).clip(CircleShape)
                    .background(if (input.isNotBlank()) NuKropAccent else Color.Gray.copy(alpha = 0.3f))
            ) {
                if (isSending) {
                    CircularProgressIndicator(color = NuKropDark, modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                } else {
                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send", tint = NuKropDark)
                }
            }
        }
    }
}

@Composable
fun PeerMessageBubble(msg: PeerMessage) {
    Box(
        modifier = Modifier.fillMaxWidth(),
        contentAlignment = if (msg.isFromMe) Alignment.CenterEnd else Alignment.CenterStart
    ) {
        Box(
            modifier = Modifier
                .widthIn(max = 280.dp)
                .clip(RoundedCornerShape(
                    topStart = 16.dp, topEnd = 16.dp,
                    bottomStart = if (msg.isFromMe) 16.dp else 4.dp,
                    bottomEnd = if (msg.isFromMe) 4.dp else 16.dp
                ))
                .background(if (msg.isFromMe) NuKropAccent.copy(alpha = 0.22f) else NuKropCard)
                .border(1.dp, if (msg.isFromMe) NuKropAccent.copy(alpha = 0.4f) else Color.White.copy(alpha = 0.08f), RoundedCornerShape(16.dp))
                .padding(horizontal = 14.dp, vertical = 10.dp)
        ) {
            Column {
                Text(msg.text, color = NuKropText, fontSize = 14.sp, lineHeight = 19.sp)
                Spacer(Modifier.height(4.dp))
                Text(msg.timestamp, color = NuKropTextMuted, fontSize = 10.sp, modifier = Modifier.align(Alignment.End))
            }
        }
    }
}
