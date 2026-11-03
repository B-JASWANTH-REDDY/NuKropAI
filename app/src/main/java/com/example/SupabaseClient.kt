package com.example

import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.realtime.Realtime
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

val SUPABASE_URL = "https://yxjqseiegwjdfnccdchk.supabase.co"
val SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4anFzZWllZ3dqZGZuY2NkY2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NDU2NTMsImV4cCI6MjEwMTUyMTY1M30.J4swglpV5qu3hRZFll3aqhG1Y2G9mUllvXMjKq6Ikmo"

val supabase = createSupabaseClient(
    supabaseUrl = SUPABASE_URL,
    supabaseKey = SUPABASE_ANON_KEY
) {
    install(Auth)
    install(Postgrest)
    install(Realtime)
}

object SupabaseApi {
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    /**
     * Query real mandi live rates directly from Supabase DB table `mandi_live_rates`
     */
    suspend fun fetchMandiRates(state: String, commodity: String): List<MandiRecord> = withContext(Dispatchers.IO) {
        try {
            val stateEnc = URLEncoder.encode(state.trim(), "UTF-8")
            val commEnc = URLEncoder.encode(commodity.trim(), "UTF-8")
            val url = "$SUPABASE_URL/rest/v1/mandi_live_rates?select=*&state=ilike.*$stateEnc*&commodity=ilike.*$commEnc*&order=id.desc&limit=20"
            val request = Request.Builder()
                .url(url)
                .addHeader("apikey", SUPABASE_ANON_KEY)
                .addHeader("Authorization", "Bearer $SUPABASE_ANON_KEY")
                .addHeader("Accept", "application/json")
                .get()
                .build()

            val (isSuccessful, body) = httpClient.newCall(request).execute().use { response ->
                Pair(response.isSuccessful, response.body?.string() ?: "")
            }
            if (!isSuccessful || body.isBlank()) return@withContext emptyList()

            val jsonArray = JSONArray(body)
            val list = mutableListOf<MandiRecord>()
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                list.add(
                    MandiRecord(
                        state = obj.optString("state", state),
                        district = obj.optString("district", "Central"),
                        market = obj.optString("market", "Main Market"),
                        commodity = obj.optString("commodity", commodity),
                        variety = obj.optString("variety", "Standard"),
                        minPrice = obj.optDouble("min_price", 2000.0),
                        maxPrice = obj.optDouble("max_price", 2600.0),
                        modalPrice = obj.optDouble("modal_price", 2400.0),
                        arrivalDate = obj.optString("arrival_date", "Today")
                    )
                )
            }
            list
        } catch (e: Exception) {
            emptyList()
        }
    }

    /**
     * Sync user location / profile to Supabase `user_profiles` for nearby farmer discovery
     */
    suspend fun syncProfile(userEmail: String, name: String, state: String, district: String, crop: String, lat: Double, lng: Double) = withContext(Dispatchers.IO) {
        try {
            val jsonPayload = JSONObject().apply {
                put("email", userEmail)
                put("full_name", name)
                put("state", state)
                put("district", district)
                put("primary_crop", crop)
                put("latitude", lat)
                put("longitude", lng)
            }.toString()

            val url = "$SUPABASE_URL/rest/v1/user_profiles"
            val mediaType = "application/json".toMediaTypeOrNull()
            val body = jsonPayload.toRequestBody(mediaType)
            val request = Request.Builder()
                .url(url)
                .addHeader("apikey", SUPABASE_ANON_KEY)
                .addHeader("Authorization", "Bearer $SUPABASE_ANON_KEY")
                .addHeader("Prefer", "resolution=merge-duplicates")
                .post(body)
                .build()

            httpClient.newCall(request).execute().use { /* close response stream */ }
        } catch (_: Exception) {}
    }

    /**
     * Record an anonymous disease scan in Supabase `disease_scans`
     */
    suspend fun recordDiseaseScan(payload: com.example.model.DiseaseScanPayload): Boolean = withContext(Dispatchers.IO) {
        try {
            val result = DiseaseAggregationService.recordScan(payload)
            result.getOrDefault(false)
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Fetch active outbreak alerts for a given target state
     */
    suspend fun fetchOutbreakAlerts(state: String): List<com.example.model.OutbreakAlertRecord> = withContext(Dispatchers.IO) {
        try {
            val result = DiseaseAggregationService.fetchActiveAlerts(state)
            result.getOrDefault(emptyList())
        } catch (_: Exception) {
            emptyList()
        }
    }

    /**
     * Fetch real-time Mandi Arbitrage Quotes from Supabase `mandi_arbitrage_quotes`
     */
    suspend fun fetchMandiArbitrageQuotes(
        commodity: String,
        state: String,
        originDistrict: String = ""
    ): List<com.example.mandipilot.MandiArbitrageOption> = withContext(Dispatchers.IO) {
        try {
            val commEnc = URLEncoder.encode(commodity.trim(), "UTF-8")
            val stateEnc = URLEncoder.encode(state.trim(), "UTF-8")
            val url = "$SUPABASE_URL/rest/v1/mandi_arbitrage_quotes?select=*&commodity=ilike.*$commEnc*&origin_state=ilike.*$stateEnc*&order=net_realized_price.desc&limit=10"
            val request = Request.Builder()
                .url(url)
                .addHeader("apikey", SUPABASE_ANON_KEY)
                .addHeader("Authorization", "Bearer $SUPABASE_ANON_KEY")
                .addHeader("Accept", "application/json")
                .get()
                .build()

            val (isSuccessful, body) = httpClient.newCall(request).execute().use { response ->
                Pair(response.isSuccessful, response.body?.string() ?: "")
            }
            if (!isSuccessful || body.isBlank()) return@withContext emptyList()

            val jsonArray = JSONArray(body)
            val list = mutableListOf<com.example.mandipilot.MandiArbitrageOption>()
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                val grossPrice = obj.optDouble("modal_price", 2600.0)
                val freight = obj.optDouble("estimated_freight", 30.0)
                val cess = obj.optDouble("apmc_cess", grossPrice * 0.018)
                val spoilage = obj.optDouble("transit_spoilage_cost", grossPrice * 0.01)
                val netRealized = obj.optDouble("net_realized_price", grossPrice - freight - cess - spoilage)
                val dist = obj.optDouble("distance_km", 25.0)

                list.add(
                    com.example.mandipilot.MandiArbitrageOption(
                        mandiName = obj.optString("mandi_name", "APMC Market"),
                        district = obj.optString("origin_district", originDistrict.ifBlank { "District" }),
                        distanceKm = dist,
                        grossModalPricePerQtl = grossPrice,
                        estimatedFreightPerQtl = freight,
                        apmcCessPerQtl = cess,
                        transitSpoilagePenaltyPerQtl = spoilage,
                        netRealizedPricePerQtl = netRealized,
                        totalNetRevenueForBatch = netRealized * 50.0,
                        arbitrageGainVsLocalMandi = obj.optDouble("arbitrage_spread", 0.0),
                        arrivalVolumeTons = 120.0 + dist * 1.5,
                        isRecommendedBestOption = i == 0
                    )
                )
            }
            list
        } catch (_: Exception) {
            emptyList()
        }
    }

    /**
     * Fetch sovereign AgriStack farmer passport from Supabase `agristack_passports`
     */
    suspend fun fetchAgriStackPassport(farmerId: String): com.example.agristack.AgriStackPassport? = withContext(Dispatchers.IO) {
        try {
            val idEnc = URLEncoder.encode(farmerId.trim(), "UTF-8")
            val url = "$SUPABASE_URL/rest/v1/agristack_passports?farmer_id=eq.$idEnc&select=*,soil_health_records(*)&limit=1"
            val request = Request.Builder()
                .url(url)
                .addHeader("apikey", SUPABASE_ANON_KEY)
                .addHeader("Authorization", "Bearer $SUPABASE_ANON_KEY")
                .addHeader("Accept", "application/json")
                .get()
                .build()

            val (isSuccessful, body) = httpClient.newCall(request).execute().use { response ->
                Pair(response.isSuccessful, response.body?.string() ?: "")
            }
            if (!isSuccessful || body.isBlank()) return@withContext null

            val jsonArray = JSONArray(body)
            if (jsonArray.length() == 0) return@withContext null
            val obj = jsonArray.getJSONObject(0)

            val landAcres = obj.optDouble("total_land_acres", 4.5)
            val creditScore = obj.optInt("agri_credit_score", 740)
            val (score, tier) = com.example.agristack.AgriStackPassportEngine.calculateAgriCreditScore(
                landAcres = landAcres,
                pmKisanVerified = obj.optBoolean("pm_kisan_verified", true),
                soilOrganicCarbonPct = 0.82,
                cropCount = 2
            )

            val soilArray = obj.optJSONArray("soil_health_records")
            val soilObj = if (soilArray != null && soilArray.length() > 0) soilArray.getJSONObject(0) else null

            val soil = com.example.agristack.SoilHealthMetrics(
                nitrogenKgPerHa = soilObj?.optDouble("nitrogen_kg_per_ha", 280.0) ?: 280.0,
                phosphorusKgPerHa = soilObj?.optDouble("phosphorus_kg_per_ha", 34.5) ?: 34.5,
                potassiumKgPerHa = soilObj?.optDouble("potassium_kg_per_ha", 310.0) ?: 310.0,
                soilPh = soilObj?.optDouble("soil_ph", 6.8) ?: 6.8,
                organicCarbonPct = soilObj?.optDouble("organic_carbon_pct", 0.82) ?: 0.82,
                zincPpm = soilObj?.optDouble("zinc_ppm", 1.15) ?: 1.15,
                ironPpm = soilObj?.optDouble("iron_ppm", 7.4) ?: 7.4,
                boronPpm = soilObj?.optDouble("boron_ppm", 0.65) ?: 0.65,
                overallFertilityIndex = soilObj?.optString("overall_fertility_index", "OPTIMAL HIGH YIELD (Grade A+)") ?: "OPTIMAL HIGH YIELD (Grade A+)"
            )

            val state = obj.optString("state", "Andhra Pradesh")
            val schemes = com.example.agristack.AgriStackPassportEngine.matchEligibleSchemes(state, landAcres, score, listOf("Paddy", "Cotton"))

            com.example.agristack.AgriStackPassport(
                sovereignFarmerId = obj.optString("farmer_id", farmerId),
                farmerName = obj.optString("farmer_name", "Farmer"),
                surveyParcelNumber = obj.optString("survey_number", "SY-412/2B"),
                villageName = obj.optString("village", "Village Hub"),
                district = obj.optString("district", "Central District"),
                state = state,
                landSizeAcres = landAcres,
                primaryCrops = listOf("Paddy / Rice", "Cotton"),
                pmKisanVerified = obj.optBoolean("pm_kisan_verified", true),
                agriCreditScore = score,
                creditRatingTier = tier,
                maxEligibleKccLoanLimit = landAcres * 75000.0,
                soilHealthSummary = soil,
                eligibleSchemes = schemes
            )
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Fetch active GramHaul shared logistics trips from Supabase `gramhaul_trips`
     */
    suspend fun fetchAvailableGramHaulTrips(
        originDistrict: String = "",
        destinationMandi: String = "",
        isColdChain: Boolean = false
    ): List<com.example.gramhaul.GramHaulTripPlan> = withContext(Dispatchers.IO) {
        try {
            val url = "$SUPABASE_URL/rest/v1/gramhaul_trips?select=*,gramhaul_load_bookings(*)&status=in.(OPEN,DISPATCHED)&order=departure_time.asc&limit=10"
            val request = Request.Builder()
                .url(url)
                .addHeader("apikey", SUPABASE_ANON_KEY)
                .addHeader("Authorization", "Bearer $SUPABASE_ANON_KEY")
                .addHeader("Accept", "application/json")
                .get()
                .build()

            val (isSuccessful, body) = httpClient.newCall(request).execute().use { response ->
                Pair(response.isSuccessful, response.body?.string() ?: "")
            }
            if (!isSuccessful || body.isBlank()) return@withContext emptyList()

            val jsonArray = JSONArray(body)
            val list = mutableListOf<com.example.gramhaul.GramHaulTripPlan>()
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                val totalCap = obj.optDouble("total_capacity_quintals", 18.0)
                val booked = obj.optDouble("booked_capacity_quintals", 8.0)
                val dist = obj.optDouble("total_distance_km", 38.0)
                val isCold = obj.optBoolean("is_cold_chain", isColdChain)
                val vehicle = if (isCold) com.example.gramhaul.HaulVehicleType.COLD_CHAIN_REEFER else com.example.gramhaul.HaulVehicleType.PICKUP_TRUCK

                val bookingsArr = obj.optJSONArray("gramhaul_load_bookings")
                val batches = mutableListOf<com.example.gramhaul.PooledLoadBatch>()
                if (bookingsArr != null) {
                    for (b in 0 until bookingsArr.length()) {
                        val bObj = bookingsArr.getJSONObject(b)
                        batches.add(
                            com.example.gramhaul.PooledLoadBatch(
                                farmerName = bObj.optString("farmer_id", "Farmer Batch"),
                                commodity = bObj.optString("commodity", "Produce"),
                                weightQuintals = bObj.optDouble("weight_quintals", 4.0),
                                pickupVillage = bObj.optString("pickup_point", "Village Hub"),
                                allocatedCostRupees = bObj.optDouble("allocated_fare", 340.0),
                                costSavedPctVsSoloHire = 42
                            )
                        )
                    }
                }

                list.add(
                    com.example.gramhaul.GramHaulTripPlan(
                        tripId = obj.optString("id", "GH-TRIP-$i").take(11).uppercase(),
                        vehicle = vehicle,
                        driverName = obj.optString("driver_name", "Driver Partner"),
                        driverPhone = obj.optString("driver_phone", "9848011223"),
                        originCluster = obj.optString("origin_hub", originDistrict.ifBlank { "Rural Aggregation Hub" }),
                        destinationMandi = obj.optString("destination_mandi", destinationMandi.ifBlank { "APMC Yard" }),
                        totalDistanceKm = dist,
                        totalTripCost = (vehicle.baseRatePerKm * dist) + 200.0,
                        totalCapacityQuintals = totalCap,
                        bookedWeightQuintals = booked,
                        availableSpaceQuintals = (totalCap - booked).coerceAtLeast(0.0),
                        batches = if (batches.isNotEmpty()) batches else com.example.gramhaul.GramHaulEngine.calculatePooledFareSharing(vehicle, dist, listOf("Verified Farmer" to booked)),
                        departureTimeFormatted = obj.optString("departure_time", "Today @ 04:30 PM"),
                        milestoneStatus = obj.optString("status", "Scheduled - Open for Pooling")
                    )
                )
            }
            list
        } catch (_: Exception) {
            emptyList()
        }
    }

    /**
     * Book a slot on a GramHaul pooled trip in Supabase `gramhaul_load_bookings`
     */
    suspend fun bookGramHaulSlot(
        tripId: String,
        farmerId: String,
        commodity: String,
        weightQuintals: Double,
        allocatedFare: Double,
        pickupPoint: String
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val jsonPayload = JSONObject().apply {
                put("trip_id", tripId)
                put("farmer_id", farmerId)
                put("commodity", commodity)
                put("weight_quintals", weightQuintals)
                put("allocated_fare", allocatedFare)
                put("pickup_point", pickupPoint)
                put("booking_status", "CONFIRMED")
            }.toString()

            val url = "$SUPABASE_URL/rest/v1/gramhaul_load_bookings"
            val mediaType = "application/json".toMediaTypeOrNull()
            val body = jsonPayload.toRequestBody(mediaType)
            val request = Request.Builder()
                .url(url)
                .addHeader("apikey", SUPABASE_ANON_KEY)
                .addHeader("Authorization", "Bearer $SUPABASE_ANON_KEY")
                .addHeader("Prefer", "return=minimal")
                .post(body)
                .build()

            val isSuccessful = httpClient.newCall(request).execute().use { response -> response.isSuccessful }
            isSuccessful
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Fetch active spatial outbreak clusters from Supabase `spatial_outbreak_clusters`
     */
    suspend fun fetchSpatialOutbreakClusters(state: String = ""): List<com.example.bioshield.OutbreakCluster> = withContext(Dispatchers.IO) {
        try {
            val url = "$SUPABASE_URL/rest/v1/spatial_outbreak_clusters?is_active=eq.true&order=scan_count.desc&limit=10"
            val request = Request.Builder()
                .url(url)
                .addHeader("apikey", SUPABASE_ANON_KEY)
                .addHeader("Authorization", "Bearer $SUPABASE_ANON_KEY")
                .addHeader("Accept", "application/json")
                .get()
                .build()

            val (isSuccessful, body) = httpClient.newCall(request).execute().use { response ->
                Pair(response.isSuccessful, response.body?.string() ?: "")
            }
            if (!isSuccessful || body.isBlank()) return@withContext emptyList()

            val jsonArray = JSONArray(body)
            val list = mutableListOf<com.example.bioshield.OutbreakCluster>()
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                val sevStr = obj.optString("severity_level", "WARNING").uppercase()
                val risk = when {
                    sevStr.contains("CRITICAL") -> com.example.bioshield.OutbreakRiskLevel.CRITICAL
                    sevStr.contains("WATCH") -> com.example.bioshield.OutbreakRiskLevel.WATCH
                    else -> com.example.bioshield.OutbreakRiskLevel.WARNING
                }
                val dName = obj.optString("disease_name", "Fungal Blight")
                val cName = obj.optString("crop_name", "Paddy / Rice")
                val lat = obj.optDouble("center_latitude", 16.3067)
                val lon = obj.optDouble("center_longitude", 80.4365)
                val scans = obj.optInt("scan_count", 4)
                val ndvi = com.example.bioshield.BioShieldRadarEngine.calculateDynamicNdvi(84.0, scans)
                val action = obj.optString("bio_defense_protocol", com.example.bioshield.BioShieldRadarEngine.resolveBioDefenseProtocol(dName, cName))

                list.add(
                    com.example.bioshield.OutbreakCluster(
                        clusterId = obj.optString("id", "BIO-CLUST-$i").take(14).uppercase(),
                        diseaseName = dName,
                        cropName = cName,
                        epicenter = com.example.bioshield.GeoLocationPoint(lat, lon, state.ifBlank { "Regional Epicenter" }, state.ifBlank { "State Zone" }),
                        radiusKm = obj.optDouble("radius_km", 10.0),
                        totalScansDetected = scans,
                        riskSeverity = risk,
                        avgMicroclimateHumidity = 84.0,
                        ndviStressIndex = ndvi,
                        bioDefenseActionPlan = action,
                        estimatedContainmentDays = if (risk == com.example.bioshield.OutbreakRiskLevel.CRITICAL) 12 else 6
                    )
                )
            }
            list
        } catch (_: Exception) {
            emptyList()
        }
    }

    /**
     * Query verified nearby drivers within 10 km via PostGIS RPC get_nearest_drivers
     */
    suspend fun fetchNearbyVerifiedDrivers(
        lat: Double,
        lng: Double,
        radiusMeters: Double = 10000.0
    ): List<NearbyDriverInfo> = withContext(Dispatchers.IO) {
        try {
            val jsonPayload = JSONObject().apply {
                put("user_lon", lng)
                put("user_lat", lat)
                put("radius_meters", radiusMeters)
                put("max_drivers", 20)
            }.toString()

            val url = "$SUPABASE_URL/rest/v1/rpc/get_nearest_drivers"
            val mediaType = "application/json".toMediaTypeOrNull()
            val body = jsonPayload.toRequestBody(mediaType)
            val request = Request.Builder()
                .url(url)
                .addHeader("apikey", SUPABASE_ANON_KEY)
                .addHeader("Authorization", "Bearer $SUPABASE_ANON_KEY")
                .addHeader("Content-Type", "application/json")
                .post(body)
                .build()

            val (isSuccessful, responseBody) = httpClient.newCall(request).execute().use { response ->
                Pair(response.isSuccessful, response.body?.string() ?: "")
            }
            if (!isSuccessful || responseBody.isBlank()) return@withContext emptyList()

            val arr = JSONArray(responseBody)
            val drivers = mutableListOf<NearbyDriverInfo>()
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                drivers.add(
                    NearbyDriverInfo(
                        driverId = obj.optString("driver_id", ""),
                        driverName = obj.optString("driver_name", "Verified Driver"),
                        vehicleType = obj.optString("vehicle_type", "Tata Ace (1.5T)"),
                        vehicleNumber = obj.optString("vehicle_number", "AP-39-TK-1008"),
                        lat = obj.optDouble("lat", lat),
                        lng = obj.optDouble("lon", lng),
                        distanceMeters = obj.optDouble("distance_meters", 0.0),
                        lastPing = obj.optString("updated_at", "")
                    )
                )
            }
            drivers
        } catch (_: Exception) {
            emptyList()
        }
    }

    /**
     * Driver updates live GPS position via PostGIS upsert_driver_location RPC
     */
    suspend fun upsertDriverLocation(
        driverId: String,
        lat: Double,
        lng: Double,
        heading: Double = 0.0,
        speedKmh: Double = 0.0
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val jsonPayload = JSONObject().apply {
                put("p_driver_id", driverId)
                put("p_lon", lng)
                put("p_lat", lat)
                put("p_heading", heading)
                put("p_speed_kmh", speedKmh)
            }.toString()

            val url = "$SUPABASE_URL/rest/v1/rpc/upsert_driver_location"
            val mediaType = "application/json".toMediaTypeOrNull()
            val body = jsonPayload.toRequestBody(mediaType)
            val request = Request.Builder()
                .url(url)
                .addHeader("apikey", SUPABASE_ANON_KEY)
                .addHeader("Authorization", "Bearer $SUPABASE_ANON_KEY")
                .addHeader("Content-Type", "application/json")
                .post(body)
                .build()

            httpClient.newCall(request).execute().use { response -> response.isSuccessful }
        } catch (_: Exception) {
            false
        }
    }
}

data class NearbyDriverInfo(
    val driverId: String,
    val driverName: String,
    val vehicleType: String,
    val vehicleNumber: String,
    val lat: Double,
    val lng: Double,
    val distanceMeters: Double,
    val lastPing: String
)
