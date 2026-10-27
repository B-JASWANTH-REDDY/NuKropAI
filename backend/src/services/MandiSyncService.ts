import axios from 'axios';
import { redisClient } from '../config/redis';

export class MandiSyncService {
    private keyIndex = 0;
    private readonly BASE_URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070";

    private getApiKeys(): string[] {
        const raw = process.env.DATA_GOV_IN_API_KEY || process.env.GOVT_API_KEYS || process.env.GOVT_API_KEY || '';
        return raw.split(',').map(k => k.trim()).filter(Boolean);
    }


    /**
     * Fetches Mandi Rates from Redis (Instant). If missing, queries Gov API and caches.
     */
    async getMandiRates(state: string, commodity: string): Promise<any[]> {
        const cacheKey = `mandi_rates:${state.toLowerCase()}:${commodity.toLowerCase()}`;
        
        // 1. Check Redis Cache
        try {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                console.log(`[MandiSyncService] ⚡ CACHE HIT: Served ${state}-${commodity} instantly from Redis.`);
                return JSON.parse(cachedData);
            }
        } catch (e) {
            console.warn('[MandiSyncService] Redis cache lookup failed, falling back to provider:', e);
        }

        console.log(`[MandiSyncService] 🐌 CACHE MISS: Fetching ${state}-${commodity} from Gov API...`);

        const apiKeys = this.getApiKeys();
        if (apiKeys.length === 0) {
            throw new Error('GOVT_API_KEY is not configured on server.');
        }

        // 2. Fetch from Government API
        let attempt = 0;
        let lastError = "";

        while (attempt < apiKeys.length) {
            const apiKey = apiKeys[(this.keyIndex + attempt) % apiKeys.length];
            
            try {
                const response = await axios.get(this.BASE_URL, {
                    params: {
                        'api-key': apiKey,
                        'format': 'json',
                        'limit': 50,
                        'filters[state]': state,
                        'filters[commodity]': commodity
                    },
                    timeout: 10000
                });

                if (response.data && response.data.records) {
                    const parsedRecords = response.data.records.map((r: any) => ({
                        state: r.state || "",
                        district: r.district || "",
                        market: r.market || "",
                        commodity: r.commodity || "",
                        variety: r.variety || "",
                        minPrice: r.min_price ? parseFloat(r.min_price) : parseFloat(r.modal_price || "0"),
                        maxPrice: r.max_price ? parseFloat(r.max_price) : parseFloat(r.modal_price || "0"),
                        modalPrice: parseFloat(r.modal_price || "0"),
                        arrivalDate: r.arrival_date || ""
                    }));

                    // 3. Save to Redis with a 15-minute expiration
                    try {
                        await redisClient.set(cacheKey, JSON.stringify(parsedRecords), 'EX', 900);
                    } catch (cacheErr) {
                        console.warn('[MandiSyncService] Redis cache write failed:', cacheErr);
                    }

                    // Update rolling key index on success
                    this.keyIndex = (this.keyIndex + attempt) % apiKeys.length;
                    return parsedRecords;
                }

            } catch (error: any) {
                lastError = error.message;
                if (error.response?.status === 429) {
                    this.keyIndex = (this.keyIndex + 1) % apiKeys.length;
                }
                attempt++;
            }
        }

        throw new Error(`Failed to fetch Mandi rates after trying all keys. Last error: ${lastError}`);
    }
}

export const mandiSyncService = new MandiSyncService();
