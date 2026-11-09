package com.example

import android.os.Handler
import android.os.Looper
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.ui.theme.NuKropAccent
import kotlinx.coroutines.launch

private val GreenAccent = Color(0xFFC8E837)
private val DarkBg1 = Color(0xFF0A0F06)
private val DarkBg2 = Color(0xFF141C0A)
private val DarkBg3 = Color(0xFF1E2A10)
private val CardBg = Color(0xCC101810)
private val SubtleWhite = Color(0x99FFFFFF)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    viewModel: AuthViewModel = viewModel()
) {
    var isSignUp by remember { mutableStateOf(true) }
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var pass by remember { mutableStateOf("") }
    var passVisible by remember { mutableStateOf(false) }

    val authState by viewModel.authState.collectAsState()
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    // Pulsing glow animation
    val infiniteTransition = rememberInfiniteTransition(label = "glow")
    val glowAlpha by infiniteTransition.animateFloat(
        initialValue = 0.15f, targetValue = 0.35f,
        animationSpec = infiniteRepeatable(tween(2200, easing = EaseInOutSine), RepeatMode.Reverse),
        label = "glowAlpha"
    )
    val glowScale by infiniteTransition.animateFloat(
        initialValue = 0.9f, targetValue = 1.1f,
        animationSpec = infiniteRepeatable(tween(3000, easing = EaseInOutSine), RepeatMode.Reverse),
        label = "glowScale"
    )

    LaunchedEffect(authState) {
        if (authState is AuthState.Success) onLoginSuccess()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBg3)
    ) {
        androidx.compose.foundation.Image(
            painter = androidx.compose.ui.res.painterResource(id = R.drawable.farm_bg),
            contentDescription = "Farm Background",
            contentScale = androidx.compose.ui.layout.ContentScale.Crop,
            modifier = Modifier.fillMaxSize()
        )
        Box(modifier = Modifier.fillMaxSize().background(Color(0xD90A0F06))) // Dark overlay for readability
        // Animated background glow orbs
        Box(
            modifier = Modifier
                .size(320.dp)
                .offset(x = (-60).dp, y = (-40).dp)
                .scale(glowScale)
                .background(
                    Brush.radialGradient(listOf(GreenAccent.copy(alpha = glowAlpha), Color.Transparent)),
                    CircleShape
                )
        )
        Box(
            modifier = Modifier
                .size(260.dp)
                .align(Alignment.BottomEnd)
                .offset(x = 60.dp, y = 60.dp)
                .scale(1.1f - (glowScale - 0.9f))
                .background(
                    Brush.radialGradient(listOf(GreenAccent.copy(alpha = glowAlpha * 0.6f), Color.Transparent)),
                    CircleShape
                )
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .statusBarsPadding()
                .navigationBarsPadding()
                .imePadding()
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.height(52.dp))

            // Logo Section
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .background(
                        Brush.radialGradient(listOf(GreenAccent.copy(alpha = 0.25f), Color.Transparent)),
                        CircleShape
                    )
                    .border(1.5.dp, GreenAccent.copy(alpha = 0.5f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text("🌿", fontSize = 36.sp)
            }

            Spacer(modifier = Modifier.height(16.dp))
            Text(
                "NuKropAI",
                fontSize = 38.sp,
                fontWeight = FontWeight.ExtraBold,
                color = Color.White,
                letterSpacing = (-1).sp
            )
            Text(
                "Smart Agriculture · Powered by AI",
                fontSize = 13.sp,
                color = SubtleWhite,
                letterSpacing = 0.3.sp
            )

            Spacer(modifier = Modifier.height(36.dp))

            // Glass Card
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(32.dp))
                    .background(CardBg)
                    .border(
                        width = 1.dp,
                        brush = Brush.verticalGradient(
                            listOf(GreenAccent.copy(alpha = 0.45f), Color(0x15FFFFFF))
                        ),
                        shape = RoundedCornerShape(32.dp)
                    )
                    .padding(28.dp)
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {

                    // Toggle tabs
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(18.dp))
                            .background(Color(0x25FFFFFF))
                            .padding(4.dp)
                    ) {
                        Row {
                            listOf("Sign Up" to true, "Sign In" to false).forEach { (label, mode) ->
                                val selected = isSignUp == mode
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(14.dp))
                                        .background(
                                            if (selected) Brush.horizontalGradient(
                                                listOf(GreenAccent, Color(0xFFA8C420))
                                            ) else Brush.horizontalGradient(listOf(Color.Transparent, Color.Transparent))
                                        )
                                        .clickable { isSignUp = mode; name = ""; email = ""; pass = "" }
                                        .padding(vertical = 12.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        label,
                                        color = if (selected) Color(0xFF0A0F06) else SubtleWhite,
                                        fontWeight = if (selected) FontWeight.ExtraBold else FontWeight.Normal,
                                        fontSize = 14.sp
                                    )
                                }
                            }
                        }
                    }

                    Spacer(Modifier.height(24.dp))

                    if (isSignUp) {
                        NuKropTextField(
                            value = name,
                            onValueChange = { name = it },
                            placeholder = "Full Name",
                            icon = "👤"
                        )
                        Spacer(Modifier.height(14.dp))
                    }

                    NuKropTextField(
                        value = email,
                        onValueChange = { email = it },
                        placeholder = "Email Address",
                        icon = "✉️"
                    )
                    Spacer(Modifier.height(14.dp))

                    NuKropTextField(
                        value = pass,
                        onValueChange = { pass = it },
                        placeholder = "Password",
                        icon = "🔒",
                        isPassword = true,
                        passwordVisible = passVisible,
                        onTogglePassword = { passVisible = !passVisible }
                    )
                    Spacer(Modifier.height(24.dp))

                    // Main CTA Button
                    Button(
                        onClick = {
                            if (isSignUp) viewModel.signUp(email, pass, name)
                            else viewModel.signIn(email, pass)
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp),
                        shape = RoundedCornerShape(28.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                        contentPadding = PaddingValues(0.dp),
                        elevation = ButtonDefaults.buttonElevation(0.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(
                                    Brush.horizontalGradient(listOf(GreenAccent, Color(0xFFA8C420))),
                                    RoundedCornerShape(28.dp)
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            if (authState is AuthState.Loading) {
                                CircularProgressIndicator(
                                    color = DarkBg1,
                                    modifier = Modifier.size(24.dp),
                                    strokeWidth = 2.5.dp
                                )
                            } else {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Text(if (isSignUp) "🌱" else "🔑", fontSize = 18.sp)
                                    Text(
                                        if (isSignUp) "Create Account" else "Sign In",
                                        color = DarkBg1,
                                        fontWeight = FontWeight.ExtraBold,
                                        fontSize = 16.sp
                                    )
                                }
                            }
                        }
                    }

                    if (authState is AuthState.Error) {
                        Spacer(Modifier.height(12.dp))
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0x30FF4444))
                                .border(1.dp, Color(0x50FF4444), RoundedCornerShape(12.dp))
                                .padding(12.dp)
                        ) {
                            Text(
                                "⚠️  " + (authState as AuthState.Error).message,
                                color = Color(0xFFFF6B6B),
                                fontSize = 12.sp,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }

                    Spacer(Modifier.height(14.dp))

                    // Google (Gmail) Sign-In Button
                    OutlinedButton(
                        onClick = { viewModel.signInWithGoogle(context) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp),
                        shape = RoundedCornerShape(26.dp),
                        colors = ButtonDefaults.outlinedButtonColors(containerColor = Color(0x15FFFFFF)),
                        border = BorderStroke(1.dp, Color(0x40FFFFFF))
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Text("🌐", fontSize = 18.sp)
                            Text(
                                "Continue with Google (Gmail)",
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            )
                        }
                    }


                }
            }

            Spacer(Modifier.height(24.dp))

            // Footer note
            Row(
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    if (isSignUp) "Already a farmer? " else "New here? ",
                    color = SubtleWhite,
                    fontSize = 14.sp
                )
                Text(
                    if (isSignUp) "Sign In" else "Create Account",
                    color = GreenAccent,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    modifier = Modifier.clickable { isSignUp = !isSignUp; name = ""; email = ""; pass = "" }
                )
            }

            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable
fun NuKropTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    icon: String,
    isPassword: Boolean = false,
    passwordVisible: Boolean = false,
    onTogglePassword: (() -> Unit)? = null
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        leadingIcon = {
            Text(icon, fontSize = 16.sp, modifier = Modifier.padding(start = 8.dp))
        },
        placeholder = {
            Text(placeholder, color = Color(0x66FFFFFF), fontSize = 14.sp)
        },
        visualTransformation = if (isPassword && !passwordVisible) PasswordVisualTransformation() else VisualTransformation.None,
        trailingIcon = if (isPassword) {
            {
                IconButton(onClick = { onTogglePassword?.invoke() }) {
                    Text(if (passwordVisible) "🙈" else "👁", fontSize = 18.sp)
                }
            }
        } else null,
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = GreenAccent,
            unfocusedBorderColor = Color(0x30FFFFFF),
            focusedContainerColor = Color(0x18FFFFFF),
            unfocusedContainerColor = Color(0x10FFFFFF),
            focusedTextColor = Color.White,
            unfocusedTextColor = Color.White,
            cursorColor = GreenAccent
        ),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
        singleLine = true
    )
}

