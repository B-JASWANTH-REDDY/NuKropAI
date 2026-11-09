package com.example

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*

/**
 * Enterprise SRE Tooling: Hardware Provisioning Flow
 * Allows farmers to scan the QR code on the physical starter box to bind it to their account.
 */
@Composable
fun DevicePairingScreen(modifier: Modifier = Modifier) {
    var isScanning by remember { mutableStateOf(false) }
    var scannedResult by remember { mutableStateOf<String?>(null) }
    var pairingStatus by remember { mutableStateOf("IDLE") }
    val scrollState = rememberScrollState()

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(NuKropDark)
            .statusBarsPadding()
            .verticalScroll(scrollState)
            .padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 120.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.QrCodeScanner,
            contentDescription = "Scan QR",
            tint = NuKropAccent,
            modifier = Modifier.size(100.dp)
        )
        
        Spacer(modifier = Modifier.height(24.dp))
        
        Text(
            text = "Hardware Provisioning",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = NuKropText
        )
        
        Spacer(modifier = Modifier.height(8.dp))
        
        Text(
            text = "Scan the QR code located on your NuKrop Smart Starter, Tuya Relay, or ESP32 board to link it securely to your farm.",
            style = MaterialTheme.typography.bodyMedium,
            color = NuKropTextDim,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            modifier = Modifier.padding(horizontal = 24.dp)
        )

        Spacer(modifier = Modifier.height(32.dp))

        if (scannedResult == null) {
            Button(
                onClick = { 
                    isScanning = true 
                    // Simulate CameraX QR Scan delay
                    pairingStatus = "SCANNING..."
                },
                modifier = Modifier.fillMaxWidth().height(50.dp),
                colors = ButtonDefaults.buttonColors(containerColor = NuKropAccent)
            ) {
                Text(if (isScanning) pairingStatus else "Launch Camera Scanner", color = NuKropDark, fontWeight = FontWeight.Bold)
            }
        } else {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(NuKropCard)
                    .padding(16.dp)
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                    Text("Device Bound Successfully!", color = NuKropBadgeGreen, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(8.dp))
                    Text("MAC: 00:1B:44:11:3A:B7", color = NuKropTextMuted, fontSize = 12.sp)
                    Text("Provider: Enterprise MQTT", color = NuKropTextMuted, fontSize = 12.sp)
                }
            }
        }

        // Simulating the CameraX success callback
        LaunchedEffect(isScanning) {
            if (isScanning) {
                try {
                    kotlinx.coroutines.delay(2000)
                    // In production, this data comes from MLKit Vision QR parser
                    val mockQrData = "nukrop://pair?mac=00:1B:44:11:3A:B7&provider=mqtt"
                    scannedResult = mockQrData
                    pairingStatus = "BOUND"
                } finally {
                    isScanning = false
                }
                
                // Usually we would call NuKropIotManager.registerDevice(mockQrData)
            }
        }

        Spacer(modifier = Modifier.height(80.dp))
    }
}
