package com.example

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.room.Room
import com.example.data.AppDatabase
import com.example.data.ChatRepository
import com.example.ui.theme.*
import dev.jeziellago.compose.markdowntext.MarkdownText
import androidx.compose.ui.platform.LocalContext
import androidx.compose.foundation.clickable
import android.app.Application
import android.graphics.Bitmap
import android.net.Uri
import java.io.ByteArrayOutputStream
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.result.PickVisualMediaRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import android.content.Intent
import android.speech.RecognizerIntent
import java.util.Locale

@Composable
fun ChatScreen(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val lang = LanguageManager.currentLanguage.collectAsState().value
    val application = context.applicationContext as Application
    val repository = remember { 
        ChatRepository(
            Room.databaseBuilder(application, AppDatabase::class.java, "chat_db").build().chatDao()
        )
    }
    val viewModel: ChatViewModel = viewModel(factory = ChatViewModel.Factory(repository, application))
    
    val messages by viewModel.messages.collectAsState()
    val generatingStatus by viewModel.generatingStatus.collectAsState()
    var input by remember { mutableStateOf("") }
    var imageBytes by remember { mutableStateOf<ByteArray?>(null) }
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()

    var tts by remember { mutableStateOf<android.speech.tts.TextToSpeech?>(null) }
    DisposableEffect(context) {
        val ttsInstance = android.speech.tts.TextToSpeech(context) { status -> }
        tts = ttsInstance
        onDispose {
            ttsInstance.shutdown()
        }
    }

    val pickMedia = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) {
            scope.launch(Dispatchers.IO) {
                imageBytes = context.contentResolver.openInputStream(uri)?.readBytes()
            }
        }
    }
    
    val takePicture = rememberLauncherForActivityResult(ActivityResultContracts.TakePicturePreview()) { bitmap ->
        if (bitmap != null) {
            val stream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, 90, stream)
            imageBytes = stream.toByteArray()
        }
    }

    val speechRecognizerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult(),
        onResult = { result ->
            if (result.resultCode == android.app.Activity.RESULT_OK) {
                val data = result.data
                val results = data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
                if (!results.isNullOrEmpty()) {
                    input = results[0]
                }
            }
        }
    )

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(Color(0xFF0D1208), NuKropDark)))
    ) {
        // Header
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xCC141A0A))
                .statusBarsPadding()
                .padding(horizontal = 16.dp, vertical = 12.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.size(44.dp).clip(CircleShape).background(NuKropSurface), Alignment.Center) {
                    Text("🤖", fontSize = 24.sp)
                }
                Column {
                    Text("Smart Farming Advisor", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Box(Modifier.size(8.dp).clip(CircleShape).background(NuKropBadgeGreen))
                        Text("Multilingual Voice AI • Data-driven Answers", fontSize = 11.sp, color = NuKropTextMuted)
                    }
                }
            }
        }

        // Chat List
        LazyColumn(
            state = listState,
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 100.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(messages) { msg ->
                ChatBubble(msg, tts)
            }
            if (generatingStatus.isNotEmpty()) {
                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Start) {
                        Box(Modifier.clip(RoundedCornerShape(16.dp, 16.dp, 16.dp, 0.dp))
                            .background(NuKropSurface).padding(16.dp)) {
                            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                CircularProgressIndicator(color = NuKropAccent, modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                                Text(generatingStatus, color = NuKropTextMuted, fontSize = 13.sp)
                            }
                        }
                    }
                }
            }
        }

        // Input Area
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xCC141A0A))
                .imePadding()
                .padding(horizontal = 16.dp, vertical = 12.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (imageBytes != null) {
                    Row(
                        modifier = Modifier.clip(RoundedCornerShape(12.dp)).background(NuKropSurface).padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text("🖼️ Image Attached", fontSize = 12.sp, color = NuKropAccent)
                        Icon(
                            Icons.Default.Close, 
                            contentDescription = "Remove", 
                            tint = NuKropError, 
                            modifier = Modifier.size(16.dp).clickable { imageBytes = null }
                        )
                    }
                }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // Camera / Attachment Icon
                    var showAttachMenu by remember { mutableStateOf(false) }
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .clip(CircleShape)
                            .background(NuKropCard)
                            .clickable { showAttachMenu = true },
                        contentAlignment = Alignment.Center
                    ) {
                        Text("📷", fontSize = 20.sp)
                        DropdownMenu(
                            expanded = showAttachMenu,
                            onDismissRequest = { showAttachMenu = false },
                            modifier = Modifier.background(NuKropCard)
                        ) {
                            DropdownMenuItem(
                                text = { Text("Take Photo", color = NuKropText) },
                                onClick = { showAttachMenu = false; takePicture.launch(null) }
                            )
                            DropdownMenuItem(
                                text = { Text("Choose from Gallery", color = NuKropText) },
                                onClick = { showAttachMenu = false; pickMedia.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }
                            )
                        }
                    }

                    // Voice Input Button
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .clip(CircleShape)
                            .background(NuKropCard)
                            .clickable {
                                try {
                                    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                                        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                                        putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
                                        putExtra(RecognizerIntent.EXTRA_PROMPT, "Talk to NuKrop AI...")
                                    }
                                    speechRecognizerLauncher.launch(intent)
                                } catch (e: Exception) {
                                    android.widget.Toast.makeText(context, "Voice recognition not supported on this device", android.widget.Toast.LENGTH_SHORT).show()
                                }
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Text("🎤", fontSize = 20.sp)
                    }

                    OutlinedTextField(
                        value = input,
                        onValueChange = { input = it },
                        placeholder = { Text(AppStrings.get("chat_placeholder", lang), fontSize = 14.sp, color = NuKropTextDim) },
                        modifier = Modifier.weight(1f).heightIn(min = 56.dp, max = 120.dp),
                        shape = RoundedCornerShape(24.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = NuKropCard,
                            unfocusedContainerColor = NuKropCard,
                            focusedBorderColor = NuKropAccent,
                            unfocusedBorderColor = Color(0x30FFFFFF),
                            cursorColor = NuKropAccent,
                            focusedTextColor = NuKropText,
                            unfocusedTextColor = NuKropText
                        )
                    )
                    
                    val canSend = (input.isNotBlank() || imageBytes != null) && generatingStatus.isEmpty()
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .clip(CircleShape)
                            .background(if (canSend) NuKropAccent else NuKropCard)
                            .clickable(enabled = canSend) {
                                viewModel.sendMessage(input, imageBytes)
                                input = ""
                                imageBytes = null
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.AutoMirrored.Filled.Send,
                            contentDescription = "Send",
                            tint = if (canSend) NuKropDark else NuKropTextMuted,
                            modifier = Modifier.size(22.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun ChatBubble(msg: ChatMessage, tts: android.speech.tts.TextToSpeech?) {
    val isUser = msg.isUser
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
        verticalAlignment = Alignment.Bottom
    ) {
        if (!isUser) {
            Box(Modifier.size(28.dp).clip(CircleShape).background(NuKropSurface), Alignment.Center) {
                Text("🤖", fontSize = 14.sp)
            }
            Spacer(Modifier.width(8.dp))
        }
        
        Box(
            modifier = Modifier
                .widthIn(max = 280.dp)
                .clip(RoundedCornerShape(
                    topStart = 16.dp,
                    topEnd = 16.dp,
                    bottomStart = if (isUser) 16.dp else 0.dp,
                    bottomEnd = if (isUser) 0.dp else 16.dp
                ))
                .background(if (isUser) Brush.horizontalGradient(listOf(NuKropGreen, NuKropGreenLight)) else SolidColor(NuKropCard))
                .border(1.dp, if (msg.isError) NuKropError else Color.Transparent, RoundedCornerShape(16.dp))
                .padding(horizontal = 16.dp, vertical = 12.dp)
        ) {
            if (msg.isError) {
                Text(msg.text, color = NuKropError, fontSize = 14.sp)
            } else if (msg.isLoading) {
                Text(msg.text.ifEmpty { "..." }, color = NuKropText, fontSize = 14.sp)
            } else {
                Column {
                    MarkdownText(
                        markdown = msg.text,
                        style = androidx.compose.ui.text.TextStyle(
                            color = if (isUser) NuKropDark else NuKropText,
                            fontSize = 14.sp,
                            lineHeight = 22.sp
                        )
                    )
                    if (!isUser) {
                        Spacer(Modifier.height(8.dp))
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(NuKropAccent.copy(alpha = 0.15f))
                                .clickable {
                                    val cleanText = msg.text.replace(Regex("[*#~_]"), "").replace("-", " ")
                                    tts?.speak(cleanText, android.speech.tts.TextToSpeech.QUEUE_FLUSH, null, null)
                                }
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text("🔊 Play Voice Remedy", color = NuKropAccent, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
        
        if (isUser) {
            Spacer(Modifier.width(8.dp))
            Box(Modifier.size(28.dp).clip(CircleShape).background(NuKropAccent), Alignment.Center) {
                Text("👨‍🌾", fontSize = 14.sp)
            }
        }
    }
}
