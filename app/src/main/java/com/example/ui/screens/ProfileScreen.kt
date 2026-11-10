package com.example

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*
import androidx.compose.ui.layout.ContentScale
import coil.compose.AsyncImage
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.launch
import androidx.compose.ui.platform.LocalContext
import androidx.compose.foundation.border
import androidx.compose.material3.CircularProgressIndicator

@Composable
fun ProfileScreen(modifier: Modifier = Modifier, onSignOut: (() -> Unit)? = null) {
    val scrollState = rememberScrollState()
    val authViewModel: AuthViewModel = viewModel()
    val currentUser by authViewModel.currentUser.collectAsState()
    val user = currentUser

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(NuKropDark)
            .verticalScroll(scrollState)
    ) {
        // Header gradient bar
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(
                        listOf(Color(0xFF2D3A1C), NuKropDark)
                    )
                )
                .statusBarsPadding()
                .padding(bottom = 20.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Real Avatar
                Box(
                    modifier = Modifier
                        .size(90.dp)
                        .clip(CircleShape)
                        .background(NuKropCard)
                        .border(2.dp, NuKropAccent, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    val photoUrl = user?.avatarUrl
                    if (photoUrl != null) {
                        AsyncImage(
                            model = photoUrl,
                            contentDescription = "Profile Picture",
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize().clip(CircleShape)
                        )
                    } else {
                        Text("👨‍🌾", fontSize = 46.sp)
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
                // Real Name
                Text(
                    text = user?.name?.ifBlank { "Guest Farmer" } ?: "Guest Farmer",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = NuKropText
                )
                Spacer(modifier = Modifier.height(4.dp))
                // Real Email
                Text(
                    user?.email?.ifBlank { "No Email Found" } ?: "No Email Found",
                    fontSize = 12.sp,
                    color = NuKropTextMuted
                )
                Spacer(modifier = Modifier.height(12.dp))

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    // Member badge
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .background(NuKropAccent.copy(alpha = 0.15f))
                            .border(1.dp, NuKropAccent.copy(alpha = 0.4f), RoundedCornerShape(20.dp))
                            .padding(horizontal = 14.dp, vertical = 6.dp)
                    ) {
                        Text(
                            "🌟 Premium Member",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = NuKropAccent
                        )
                    }
                }
            }
        }

        // Editable Farm Profile Section
        Spacer(modifier = Modifier.height(16.dp))
        var editState by remember { mutableStateOf("") }
        var editCrop by remember { mutableStateOf("") }
        var editFarmSize by remember { mutableStateOf("") }
        var isSavingProfile by remember { mutableStateOf(false) }
        var profileSaveStatus by remember { mutableStateOf("") }
        val profileScope = rememberCoroutineScope()
        val profileContext = LocalContext.current

        // Load saved values from prefs
        LaunchedEffect(Unit) {
            val prefs = profileContext.getSharedPreferences("nukrop_farm_profile", android.content.Context.MODE_PRIVATE)
            editState = prefs.getString("state", "") ?: ""
            editCrop = prefs.getString("crop", "") ?: ""
            editFarmSize = prefs.getString("farm_size", "") ?: ""
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(NuKropCard)
                .border(1.dp, NuKropAccent.copy(alpha = 0.2f), RoundedCornerShape(16.dp))
                .padding(16.dp)
        ) {
            Text("🌾 Farm Profile", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NuKropAccent)
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = editState, onValueChange = { editState = it },
                label = { Text("Your State (e.g. Punjab)", color = NuKropTextMuted, fontSize = 12.sp) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
                colors = OutlinedTextFieldDefaults.colors(focusedTextColor = NuKropText, unfocusedTextColor = NuKropText, focusedBorderColor = NuKropAccent, unfocusedBorderColor = Color(0x30FFFFFF))
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = editCrop, onValueChange = { editCrop = it },
                label = { Text("Primary Crop (e.g. Wheat, Rice)", color = NuKropTextMuted, fontSize = 12.sp) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
                colors = OutlinedTextFieldDefaults.colors(focusedTextColor = NuKropText, unfocusedTextColor = NuKropText, focusedBorderColor = NuKropAccent, unfocusedBorderColor = Color(0x30FFFFFF))
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = editFarmSize, onValueChange = { editFarmSize = it },
                label = { Text("Farm Size (e.g. 5 Acres)", color = NuKropTextMuted, fontSize = 12.sp) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
                colors = OutlinedTextFieldDefaults.colors(focusedTextColor = NuKropText, unfocusedTextColor = NuKropText, focusedBorderColor = NuKropAccent, unfocusedBorderColor = Color(0x30FFFFFF))
            )
            Spacer(Modifier.height(12.dp))
            Button(
                onClick = {
                    if (!isSavingProfile) {
                        isSavingProfile = true
                        profileSaveStatus = ""
                        val prefs = profileContext.getSharedPreferences("nukrop_farm_profile", android.content.Context.MODE_PRIVATE)
                        prefs.edit().putString("state", editState).putString("crop", editCrop).putString("farm_size", editFarmSize).apply()
                        profileScope.launch {
                            try {
                                val userEmail = user?.email?.ifBlank { null }
                                    ?: try {
                                        val authPrefs = profileContext.getSharedPreferences("nukrop_auth", android.content.Context.MODE_PRIVATE)
                                        authPrefs.getString("user_email", null) ?: authPrefs.getString("user_name", "user@nukrop.ai") ?: "user@nukrop.ai"
                                    } catch (e: Exception) { "user@nukrop.ai" }
                                val userName = user?.name?.ifBlank { "Farmer" } ?: "Farmer"
                                SupabaseApi.syncProfile(userEmail, userName, editState, "", editCrop, 0.0, 0.0)
                                profileSaveStatus = "✅ Profile saved!"
                            } catch (e: Exception) {
                                profileSaveStatus = "⚠ Error saving profile: ${e.message}"
                            } finally {
                                isSavingProfile = false
                            }
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth().height(44.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = NuKropAccent)
            ) {
                if (isSavingProfile) CircularProgressIndicator(color = NuKropDark, modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                else Text("Save Profile", color = NuKropDark, fontWeight = FontWeight.Bold)
            }
            if (profileSaveStatus.isNotEmpty()) {
                Spacer(Modifier.height(6.dp))
                Text(profileSaveStatus, color = NuKropBadgeGreen, fontSize = 12.sp)
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Settings section
        Column(modifier = Modifier.padding(horizontal = 16.dp)) {
            Text("Settings", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = NuKropText)
            Spacer(modifier = Modifier.height(12.dp))

            val context = androidx.compose.ui.platform.LocalContext.current
            val currentLang by LanguageManager.currentLanguage.collectAsState()
            var showLanguageMenu by remember { mutableStateOf(false) }
            
            var showPrivacyDialog by remember { mutableStateOf(false) }
            var showAboutDialog by remember { mutableStateOf(false) }
            val packageInfo = remember {
                try {
                    context.packageManager.getPackageInfo(context.packageName, 0)
                } catch (e: Exception) {
                    null
                }
            }
            val versionName = packageInfo?.versionName ?: "1.0.0"

            if (showPrivacyDialog) {
                AlertDialog(
                    onDismissRequest = { showPrivacyDialog = false },
                    containerColor = NuKropCard,
                    title = { Text("Privacy & Data", color = NuKropText, fontWeight = FontWeight.Bold) },
                    text = { Text("NuKropAI respects your privacy. We only collect location data and crop scans to provide accurate insights. Your data is encrypted and never sold to third parties.", color = NuKropTextMuted) },
                    confirmButton = { Button(onClick = { showPrivacyDialog = false }, colors = ButtonDefaults.buttonColors(containerColor = NuKropAccent)) { Text("Got it", color = NuKropDark, fontWeight = FontWeight.Bold) } }
                )
            }

            if (showAboutDialog) {
                AlertDialog(
                    onDismissRequest = { showAboutDialog = false },
                    containerColor = NuKropCard,
                    title = { Text("About NuKropAI", color = NuKropText, fontWeight = FontWeight.Bold) },
                    text = { Text("NuKropAI Agriculture OS\nVersion $versionName\n\nEmpowering farmers with state-of-the-art AI technology.", color = NuKropTextMuted) },
                    confirmButton = { Button(onClick = { showAboutDialog = false }, colors = ButtonDefaults.buttonColors(containerColor = NuKropAccent)) { Text("Close", color = NuKropDark, fontWeight = FontWeight.Bold) } }
                )
            }

            SettingsItem(
                icon = Icons.Default.Notifications, 
                title = "Notifications", 
                subtitle = "Push alerts, reminders",
                onClick = {
                    val intent = android.content.Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                        putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, context.packageName)
                    }
                    try { context.startActivity(intent) } catch (e: Exception) { }
                }
            )
            
            Spacer(modifier = Modifier.height(12.dp))
            
            Box {
                SettingsItem(
                    icon = Icons.Default.Language, 
                    title = "Language & Region", 
                    subtitle = LanguageManager.getLanguageName(currentLang),
                    onClick = { showLanguageMenu = true }
                )
                DropdownMenu(
                    expanded = showLanguageMenu,
                    onDismissRequest = { showLanguageMenu = false },
                    modifier = Modifier.background(NuKropCard)
                ) {
                    val langs = listOf(
                        "te" to "తెలుగు",
                        "hi" to "हिन्दी",
                        "ta" to "தமிழ்",
                        "kn" to "ಕನ್ನಡ",
                        "ml" to "മലയാളം",
                        "mr" to "मराठी",
                        "bn" to "বাংলা",
                        "gu" to "ગુજરાતી",
                        "pa" to "ਪੰਜਾਬੀ",
                        "or" to "ଓଡ଼ିଆ",
                        "en" to "English"
                    )
                    langs.forEach { (code, name) ->
                        DropdownMenuItem(
                            text = { Text(name, color = if (currentLang == code) NuKropAccent else NuKropText) },
                            onClick = {
                                LanguageManager.setLanguage(context, code)
                                showLanguageMenu = false
                            }
                        )
                    }
                }
            }
            
            SettingsItem(
                icon = Icons.Default.Shield, 
                title = "Privacy & Data", 
                subtitle = "Manage your data",
                onClick = { showPrivacyDialog = true }
            )
            Spacer(modifier = Modifier.height(12.dp))
            SettingsItem(
                icon = Icons.AutoMirrored.Filled.Help, 
                title = "Help & Support", 
                subtitle = "FAQs, contact us",
                onClick = {
                    val intent = android.content.Intent(android.content.Intent.ACTION_SENDTO).apply {
                        data = android.net.Uri.parse("mailto:support@nukrop.ai")
                        putExtra(android.content.Intent.EXTRA_SUBJECT, "NuKropAI Support Request")
                    }
                    try { context.startActivity(intent) } catch (e: Exception) { }
                }
            )
            Spacer(modifier = Modifier.height(12.dp))
            SettingsItem(
                icon = Icons.Default.Info, 
                title = "About NuKropAI", 
                subtitle = "Version $versionName",
                onClick = { showAboutDialog = true }
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Logout
        Button(
            onClick = { onSignOut?.invoke() },
            modifier = Modifier
                .padding(horizontal = 16.dp)
                .fillMaxWidth()
                .height(52.dp),
            shape = RoundedCornerShape(26.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFF2A1A1A)
            ),
            border = BorderStroke(1.dp, NuKropError.copy(alpha = 0.4f))
        ) {
            Text("Sign Out", color = NuKropError, fontWeight = FontWeight.SemiBold)
        }

        Spacer(modifier = Modifier.height(80.dp))
    }
}

@Composable
fun FarmStatCard(modifier: Modifier = Modifier, value: String, label: String, icon: String) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(NuKropCard)
            .border(1.dp, Color(0x20C8E837), RoundedCornerShape(16.dp))
            .padding(vertical = 14.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(icon, fontSize = 22.sp)
            Spacer(modifier = Modifier.height(6.dp))
            Text(value, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = NuKropAccent)
            Text(label, fontSize = 10.sp, color = NuKropTextMuted)
        }
    }
}

@Composable
fun FarmListItem(name: String, area: String, status: String, isPrimary: Boolean) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(NuKropCard)
            .border(
                1.dp,
                if (isPrimary) NuKropAccent.copy(alpha = 0.4f) else Color(0x15FFFFFF),
                RoundedCornerShape(14.dp)
            )
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(
            modifier = Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(
                        Brush.verticalGradient(listOf(Color(0xFF3A5C1A), Color(0xFF4A7C2A)))
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text("🌾", fontSize = 22.sp)
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(name, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = NuKropText, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                Text("$area • $status", fontSize = 11.sp, color = NuKropTextMuted, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
            }
        }
        if (isPrimary) {
            Spacer(Modifier.width(8.dp))
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(NuKropAccent.copy(alpha = 0.15f))
                    .padding(horizontal = 8.dp, vertical = 3.dp)
            ) {
                Text("Active", fontSize = 10.sp, color = NuKropAccent, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun SettingsItem(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit = {}
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(NuKropCard)
            .clickable { onClick() }
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(
            modifier = Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(NuKropSurface),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = NuKropAccent, modifier = Modifier.size(20.dp))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = NuKropText, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                Text(subtitle, fontSize = 11.sp, color = NuKropTextMuted, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
            }
        }
        Spacer(Modifier.width(8.dp))
        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = NuKropTextDim, modifier = Modifier.size(18.dp))
    }
}
