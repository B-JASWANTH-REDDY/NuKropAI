package com.example

import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.example.ui.PlantixBottomBar
import com.example.ui.theme.MyApplicationTheme

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * NuKropAI Enterprise 100% Pure Native Android Jetpack Compose Application Root
 * ═════════════════════════════════════════════════════════════════════════════
 * Orchestrates pure native Jetpack Compose agrarian screens, navigation backstack,
 * Material 3 theming, and docked Plantix bottom navigation bar.
 */
@Composable
fun NuKropNativeApp() {
    MyApplicationTheme {
        var currentTab by remember { mutableStateOf<Tab>(Tab.Home) }
        var isSplashComplete by remember { mutableStateOf(false) }

        if (!isSplashComplete) {
            SplashScreen(onStartFarming = { isSplashComplete = true })
        } else {
            // Native hardware back button handling
            BackHandler(enabled = currentTab !is Tab.Home) {
                currentTab = Tab.Home
            }

            val showBottomBar = currentTab is Tab.Home ||
                    currentTab is Tab.Community ||
                    currentTab is Tab.Scan ||
                    currentTab is Tab.Market ||
                    currentTab is Tab.Profile

            Scaffold(
                containerColor = Color(0xFFF8FAF8),
                bottomBar = {
                    if (showBottomBar) {
                        PlantixBottomBar(
                            currentTab = currentTab,
                            onTabSelected = { tab -> currentTab = tab },
                            onScannerClick = { currentTab = Tab.Scan }
                        )
                    }
                }
            ) { innerPadding ->
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(if (showBottomBar) innerPadding else PaddingValues())
                ) {
                    when (val tab = currentTab) {
                        is Tab.Home -> HomeScreen(
                            onNavigateToScan = { currentTab = Tab.Scan },
                            onNavigateToMarket = { currentTab = Tab.Market },
                            onNavigateToCommunity = { currentTab = Tab.Community },
                            onNavigateToAutopilot = { currentTab = Tab.Autopilot },
                            onNavigateToFinance = { currentTab = Tab.Finance },
                            onNavigateToSavedReports = { currentTab = Tab.SavedReports },
                            onNavigateToEquipmentRental = { currentTab = Tab.EquipmentRental },
                            onNavigateToFarmKhata = { currentTab = Tab.FarmKhata },
                            onNavigateToBioShield = { currentTab = Tab.BioShieldRadar },
                            onNavigateToMandiPilot = { currentTab = Tab.MandiPilot },
                            onNavigateToGramHaul = { currentTab = Tab.GramHaul },
                            onNavigateToAgriStack = { currentTab = Tab.AgriStackPassport },
                            onNavigateToYantraShare = { currentTab = Tab.YantraShare },
                            onNavigateToBioRx = { currentTab = Tab.BioRx },
                            onNavigateToCalculators = { calcType -> currentTab = Tab.Calculators(calcType) }
                        )

                        is Tab.Market -> MarketScreen()

                        is Tab.Community -> CommunityScreen(
                            onNavigateToChat = { currentTab = Tab.PeerChat("Agri Advisor", "Kisan Agronomist", "18001801551") }
                        )

                        is Tab.Scan -> DiseaseScannerScreen()

                        is Tab.Profile -> ProfileScreen(
                            onSignOut = {
                                isSplashComplete = false
                                currentTab = Tab.Home
                            }
                        )

                        is Tab.BioRx -> BioRxScreen(onNavigateBack = { currentTab = Tab.Home })

                        is Tab.FarmKhata -> FarmKhataScreen(onNavigateBack = { currentTab = Tab.Home })

                        is Tab.GramHaul -> GramHaulScreen(onNavigateBack = { currentTab = Tab.Home })

                        is Tab.AgriStackPassport -> AgriStackPassportScreen(onNavigateBack = { currentTab = Tab.Home })

                        is Tab.Autopilot -> TractorAutopilotScreen(onNavigateBack = { currentTab = Tab.Home })

                        is Tab.EquipmentRental -> EquipmentRentalScreen(
                            onNavigateBack = { currentTab = Tab.Home },
                            onNavigateToPeerChat = { name, info, phone ->
                                currentTab = Tab.PeerChat(name, info, phone)
                            }
                        )

                        is Tab.BioShieldRadar -> BioShieldRadarScreen(onNavigateBack = { currentTab = Tab.Home })

                        is Tab.MandiPilot -> MandiPilotScreen(onNavigateBack = { currentTab = Tab.Home })

                        is Tab.YantraShare -> YantraShareScreen(onNavigateBack = { currentTab = Tab.Home })

                        is Tab.SavedReports -> SavedReportsScreen(onNavigateBack = { currentTab = Tab.Home })

                        is Tab.Calculators -> CalculatorsScreen(
                            initialTab = tab.type,
                            onNavigateBack = { currentTab = Tab.Home }
                        )

                        is Tab.PeerChat -> PeerChatScreen(
                            recipientName = tab.name,
                            recipientInfo = tab.info,
                            recipientPhone = tab.phone,
                            onNavigateBack = { currentTab = Tab.Home }
                        )

                        else -> HomeScreen(
                            onNavigateToScan = { currentTab = Tab.Scan },
                            onNavigateToMarket = { currentTab = Tab.Market },
                            onNavigateToCommunity = { currentTab = Tab.Community }
                        )
                    }
                }
            }
        }
    }
}
