package com.example

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.concurrent.ConcurrentHashMap

data class MandiRecord(
    val state: String,
    val district: String,
    val market: String,
    val commodity: String,
    val variety: String,
    val minPrice: Double,
    val maxPrice: Double,
    val modalPrice: Double,
    val arrivalDate: String
)

sealed class MandiState {
    object Loading : MandiState()
    data class Success(
        val records: List<MandiRecord>,
        val totalFetched: Int,
        val isLive: Boolean = true,
        val source: String = "Supabase APMC / Agmarknet",
        val fetchedAtMillis: Long = System.currentTimeMillis()
    ) : MandiState()
    data class Error(
        val message: String,
        val staleData: List<MandiRecord>? = null,
        val isStale: Boolean = false,
        val lastUpdatedMillis: Long = 0L
    ) : MandiState()
}

object MandiApiService {

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private const val POLL_INTERVAL_MS = 3 * 60 * 1000L // 3 minutes

    private val activeFlows = ConcurrentHashMap<String, MutableStateFlow<MandiState>>()
    private val activeJobs = ConcurrentHashMap<String, Job>()
    private val lastGoodData = ConcurrentHashMap<String, List<MandiRecord>>()
    private val lastFetchTimes = ConcurrentHashMap<String, Long>()

    fun watchLiveMandiPrices(state: String, commodity: String): StateFlow<MandiState> {
        if (state.isBlank() || commodity.isBlank()) {
            return MutableStateFlow(MandiState.Error("State and commodity must not be empty")).asStateFlow()
        }

        val key = "${state.trim().lowercase()}_${commodity.trim().lowercase()}"
        activeFlows[key]?.let { return it.asStateFlow() }

        val flow = MutableStateFlow<MandiState>(MandiState.Loading)
        activeFlows[key] = flow

        val job = serviceScope.launch {
            while (isActive) {
                val result = fetchFromSupabase(state, commodity)
                result.fold(
                    onSuccess = { records ->
                        val now = System.currentTimeMillis()
                        lastGoodData[key] = records
                        lastFetchTimes[key] = now
                        flow.value = MandiState.Success(
                            records = records,
                            totalFetched = records.size,
                            isLive = true,
                            source = "Supabase Verified Mandi Rates",
                            fetchedAtMillis = now
                        )
                    },
                    onFailure = { error ->
                        val cached = lastGoodData[key]
                        val cachedTime = lastFetchTimes[key] ?: 0L
                        flow.value = MandiState.Error(
                            message = error.message ?: "Live Mandi database connection unavailable",
                            staleData = cached,
                            isStale = !cached.isNullOrEmpty(),
                            lastUpdatedMillis = cachedTime
                        )
                    }
                )
                delay(POLL_INTERVAL_MS)
            }
        }

        activeJobs[key] = job
        return flow.asStateFlow()
    }

    fun stopWatching(state: String, commodity: String) {
        val key = "${state.trim().lowercase()}_${commodity.trim().lowercase()}"
        activeJobs[key]?.cancel()
        activeJobs.remove(key)
        activeFlows.remove(key)
        lastGoodData.remove(key)
        lastFetchTimes.remove(key)
    }

    fun forceRefresh(state: String, commodity: String) {
        val key = "${state.trim().lowercase()}_${commodity.trim().lowercase()}"
        activeJobs[key]?.cancel()
        activeJobs.remove(key)
        activeFlows.remove(key)
        watchLiveMandiPrices(state, commodity)
    }

    /**
     * Authenticated backend fetch:
     * Queries authoritative APMC records stored in Supabase `mandi_live_rates`.
     * Private credentials remain strictly server-side.
     */
    private suspend fun fetchFromSupabase(
        state: String,
        commodity: String
    ): Result<List<MandiRecord>> = withContext(Dispatchers.IO) {
        try {
            val records = SupabaseApi.fetchMandiRates(state, commodity)
            if (records.isNotEmpty()) {
                Result.success(records)
            } else {
                val cached = lastGoodData["${state.trim().lowercase()}_${commodity.trim().lowercase()}"]
                if (!cached.isNullOrEmpty()) {
                    Result.success(cached)
                } else {
                    Result.failure(Exception("No current mandi rates found for $commodity in $state"))
                }
            }
        } catch (e: Exception) {
            val cached = lastGoodData["${state.trim().lowercase()}_${commodity.trim().lowercase()}"]
            if (!cached.isNullOrEmpty()) {
                Result.success(cached)
            } else {
                Result.failure(Exception("Failed to fetch mandi rates: ${e.message}"))
            }
        }
    }
}
