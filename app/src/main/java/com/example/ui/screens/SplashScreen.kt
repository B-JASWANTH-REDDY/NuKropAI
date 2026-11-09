package com.example

import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*
import kotlinx.coroutines.delay

@Composable
fun SplashScreen(onStartFarming: () -> Unit) {
    val infiniteTransition = rememberInfiniteTransition(label = "splash_anim")
    val gradientOffset by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(3000, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "gradient"
    )

    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        delay(200)
        visible = true
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        Color(0xFF1C2410),
                        Color(0xFF2D3A1C),
                        Color(0xFF3D5020),
                        Color(0xFF4A5E28)
                    )
                )
            )
    ) {
        // Decorative circles background
        Canvas(modifier = Modifier.fillMaxSize()) {
            drawCircle(
                color = Color(0x15C8E837),
                radius = size.width * 0.8f,
                center = Offset(size.width * 0.7f + gradientOffset * 50f, size.height * 0.2f)
            )
            drawCircle(
                color = Color(0x10C8E837),
                radius = size.width * 0.5f,
                center = Offset(size.width * 0.1f, size.height * 0.8f)
            )
        }

        val scrollState = rememberScrollState()
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .verticalScroll(scrollState)
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            // Top: Logo / Brand
            Column(modifier = Modifier.padding(top = 16.dp)) {
                Text(
                    text = "NuKropAI",
                    fontSize = 34.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = NuKropAccent,
                    letterSpacing = (-0.5).sp
                )
                Text(
                    text = "Smart Agriculture Platform",
                    fontSize = 14.sp,
                    color = NuKropTextMuted,
                    letterSpacing = 1.sp
                )
            }

            // Middle: Feature cards
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                // Hero text area
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp)
                        .clip(RoundedCornerShape(24.dp))
                        .background(
                            Brush.linearGradient(
                                colors = listOf(Color(0xFF3D5020), Color(0xFF2D3A1C))
                            )
                        )
                        .border(1.dp, Color(0x30C8E837), RoundedCornerShape(24.dp))
                        .padding(20.dp)
                ) {
                    Column(
                        modifier = Modifier.align(Alignment.BottomStart)
                    ) {
                        Text(
                            text = "Smart farming tools\nto grow better\ncrops with less effort.",
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold,
                            color = NuKropAccent,
                            lineHeight = 30.sp
                        )
                    }
                    // Decorative drone icon area
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .size(48.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0x40C8E837)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("🛸", fontSize = 24.sp)
                    }
                }

                // Two feature cards side by side
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    FeatureCard(
                        modifier = Modifier.weight(1f),
                        emoji = "🌱",
                        title = "Green Focus",
                        subtitle = "Simplifying Farming,\nOne Tap at a Time"
                    )
                    FeatureCard(
                        modifier = Modifier.weight(1f),
                        emoji = "🚜",
                        title = "Future-Driven",
                        subtitle = "Cultivating Smart\nGreener Fields"
                    )
                }
            }

            // Bottom: Start Farming Button
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Button(
                    onClick = onStartFarming,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(60.dp),
                    shape = RoundedCornerShape(30.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF1A1E10)
                    ),
                    border = BorderStroke(1.dp, NuKropAccent.copy(alpha = 0.5f))
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text(
                            text = "Start Farming",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = NuKropText
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy((-6).dp)) {
                            repeat(3) { i ->
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                                    contentDescription = null,
                                    tint = NuKropAccent.copy(alpha = 1f - i * 0.3f),
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "AI-powered insights for every farmer",
                    fontSize = 12.sp,
                    color = NuKropTextDim,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.navigationBarsPadding())
            }
        }
    }
}

@Composable
fun FeatureCard(
    modifier: Modifier = Modifier,
    emoji: String,
    title: String,
    subtitle: String
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(
                Brush.verticalGradient(
                    colors = listOf(Color(0xFF2E381C), Color(0xFF1E2514))
                )
            )
            .border(1.dp, Color(0x20C8E837), RoundedCornerShape(16.dp))
            .padding(14.dp)
    ) {
        Column {
            Text(emoji, fontSize = 28.sp)
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = title,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = NuKropAccent,
                letterSpacing = 0.5.sp
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = subtitle,
                fontSize = 10.sp,
                color = NuKropTextMuted,
                lineHeight = 14.sp
            )
        }
    }
}
