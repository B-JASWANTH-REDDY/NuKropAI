package com.example

import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*
import kotlin.math.cos
import kotlin.math.sin

data class FarmPlotInfo(
    val name: String,
    val coords: String,
    val harvestRate: String,
    val hectares: String,
    val plantHealth: Int,
    val waterDepth: Int,
    val soil: Int,
    val pest: Int
)

val PLOTS = listOf(
    FarmPlotInfo("Emerald Valley Plot F5", "40.7128° N (North) | 74.0060° W (West)", "24 kg/h", "14ha", 98, 56, 75, 3),
    FarmPlotInfo("North Field Plot B2", "40.7180° N (North) | 74.0010° W (East)", "18 kg/h", "8ha", 82, 44, 68, 7),
    FarmPlotInfo("South Farm Plot A1", "40.7050° N (South) | 74.0120° W (South)", "30 kg/h", "20ha", 91, 62, 81, 2)
)

@Composable
fun FarmMapScreen(modifier: Modifier = Modifier) {
    var selectedPlotIndex by remember { mutableStateOf(0) }
    val plot = PLOTS[selectedPlotIndex]

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF0D1208))
    ) {
        // Aerial farm map background (simulated with canvas)
        AerialMapView(modifier = Modifier.fillMaxSize())

        // Top header overlay
        Column(modifier = Modifier.fillMaxSize()) {
            // Header
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xCC0D1208))
                    .statusBarsPadding()
                    .padding(horizontal = 16.dp, vertical = 12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = plot.name,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = NuKropText,
                            maxLines = 1,
                            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                        )
                        Text(
                            text = plot.coords,
                            fontSize = 10.sp,
                            color = NuKropTextMuted,
                            maxLines = 1,
                            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                        )
                    }
                    Spacer(Modifier.width(8.dp))
                    // Plot selector
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        PLOTS.forEachIndexed { index, _ ->
                            Box(
                                modifier = Modifier
                                    .size(if (index == selectedPlotIndex) 10.dp else 8.dp)
                                    .clip(CircleShape)
                                    .background(
                                        if (index == selectedPlotIndex) NuKropAccent
                                        else NuKropTextDim
                                    )
                                    .clickable { selectedPlotIndex = index }
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            // Stats panel at bottom right
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .padding(16.dp)
                    .padding(bottom = 80.dp),
                horizontalArrangement = Arrangement.End
            ) {
                FarmStatsPanel(plot = plot)
            }
        }

        // Plot boundary markers on map (decorative)
        PlotBoundaryOverlay(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.6f)
                .align(Alignment.Center)
        )
    }
}

@Composable
fun AerialMapView(modifier: Modifier = Modifier) {
    val colors = listOf(
        Color(0xFF2D4A10), Color(0xFF3D6018), Color(0xFF4A7820),
        Color(0xFF5E9428), Color(0xFF3A5C14), Color(0xFF486A1C)
    )

    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height

        // Simulate farm aerial view with grid patches
        val cols = 6
        val rows = 10
        val cellW = w / cols
        val cellH = h / rows

        for (r in 0 until rows) {
            for (c in 0 until cols) {
                val colorIndex = ((r * cols + c + r) % colors.size)
                val shade = colors[colorIndex]
                drawRect(
                    color = shade,
                    topLeft = Offset(c * cellW, r * cellH),
                    size = Size(cellW, cellH)
                )
                // Field lines
                drawRect(
                    color = Color(0x30000000),
                    topLeft = Offset(c * cellW, r * cellH),
                    size = Size(cellW, cellH),
                    style = Stroke(1.5f)
                )
            }
        }

        // Road/path dividers
        drawLine(Color(0x60CCAA44), Offset(w * 0.33f, 0f), Offset(w * 0.33f, h), 6f)
        drawLine(Color(0x60CCAA44), Offset(w * 0.66f, 0f), Offset(w * 0.66f, h), 4f)
        drawLine(Color(0x60CCAA44), Offset(0f, h * 0.45f), Offset(w, h * 0.45f), 6f)
    }
}

@Composable
fun PlotBoundaryOverlay(modifier: Modifier = Modifier) {
    Canvas(modifier = modifier) {
        val cx = size.width * 0.4f
        val cy = size.height * 0.5f
        val rx = size.width * 0.28f
        val ry = size.height * 0.35f

        // Draw selected plot boundary
        val path = androidx.compose.ui.graphics.Path().apply {
            moveTo(cx - rx, cy - ry * 0.6f)
            lineTo(cx + rx * 0.3f, cy - ry)
            lineTo(cx + rx, cy + ry * 0.2f)
            lineTo(cx - rx * 0.2f, cy + ry)
            close()
        }
        drawPath(path, color = Color(0x60C8E837))
        drawPath(path, color = Color(0xFFC8E837), style = Stroke(2.5f, cap = StrokeCap.Round))

        // Corner markers
        val corners = listOf(
            Offset(cx - rx, cy - ry * 0.6f),
            Offset(cx + rx * 0.3f, cy - ry),
            Offset(cx + rx, cy + ry * 0.2f),
            Offset(cx - rx * 0.2f, cy + ry)
        )
        corners.forEach { corner ->
            drawCircle(Color(0xFFC8E837), 8f, corner)
            drawCircle(Color.White, 4f, corner)
        }
    }
}

@Composable
fun FarmStatsPanel(plot: FarmPlotInfo) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(16.dp))
            .background(Color(0xDD141A0A))
            .border(1.dp, Color(0x40C8E837), RoundedCornerShape(16.dp))
            .padding(14.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            // Rate & hectare
            Row(
                horizontalArrangement = Arrangement.spacedBy(24.dp),
                verticalAlignment = Alignment.Bottom
            ) {
                Column {
                    Text(plot.harvestRate, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = NuKropAccent)
                }
                Column {
                    Text(plot.hectares, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = NuKropText)
                }
            }
            HorizontalDivider(color = Color(0x20FFFFFF), thickness = 1.dp)
            StatRow("Plant Health", plot.plantHealth, NuKropBadgeGreen)
            StatRow("Water Depth", plot.waterDepth, Color(0xFF64B5F6))
            StatRow("Soil", plot.soil, NuKropAccentDark)
            StatRow("Pest", plot.pest, NuKropError)
        }
    }
}

@Composable
fun StatRow(label: String, value: Int, color: Color) {
    Row(
        modifier = Modifier.width(160.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, fontSize = 11.sp, color = NuKropTextMuted, modifier = Modifier.weight(1f))
        Text("$value%", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = color)
    }
}
