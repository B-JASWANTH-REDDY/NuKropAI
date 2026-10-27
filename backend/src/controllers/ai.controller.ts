import { FastifyRequest, FastifyReply } from 'fastify';
import { pool } from '../config/db';
import axios from 'axios';

export async function processSoilHealthCard(request: FastifyRequest, reply: FastifyReply) {
    const { zoneId, rawOcrText, extractedData } = request.body as any;
    
    // In a real implementation, this would call Gemini API:
    // const aiResponse = await gemini.generateContent(`Analyze this soil data: ${rawOcrText}`);
    // Here we simulate the AI Orchestration layer's response for the digital twin
    
    const aiRecommendation = `Based on pH ${extractedData.ph} and Nitrogen ${extractedData.nitrogen} levels, the soil is moderately acidic and nitrogen-deficient. Recommendation: Apply 50kg/acre of Urea and 2 tons/acre of agricultural lime before planting.`;

    const client = await pool.connect();
    try {
        const result = await client.query(`
            INSERT INTO soil_reports (zone_id, report_date, ph, nitrogen, phosphorus, potassium, organic_matter, raw_ocr_text, ai_recommendation)
            VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [
            zoneId, 
            extractedData.ph, 
            extractedData.nitrogen, 
            extractedData.phosphorus, 
            extractedData.potassium, 
            extractedData.organicMatter,
            rawOcrText,
            aiRecommendation
        ]);

        return reply.status(200).send({ status: 'success', data: result.rows[0] });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to process soil health card' });
    } finally {
        client.release();
    }
}

export async function triggerCropLifecycleEngine(request: FastifyRequest, reply: FastifyReply) {
    // This represents a cron-triggered endpoint that advances crop timelines
    const client = await pool.connect();
    
    try {
        // Find all active zones
        const activeZones = await client.query(`SELECT * FROM zones WHERE planting_date IS NOT NULL`);
        
        const updates = activeZones.rows.map(zone => {
            // Complex AI logic for Growing Degree Days (GDD) would go here.
            // For now, we return a simple projection status.
            const daysSincePlanting = Math.floor((new Date().getTime() - new Date(zone.planting_date).getTime()) / (1000 * 3600 * 24));
            
            return {
                zoneId: zone.id,
                crop: zone.crop_type,
                daysSincePlanting,
                currentStage: daysSincePlanting > 40 ? 'Vegetative' : 'Seedling',
                aiAdjustment: 'Weather has been 2°C hotter than average. Harvest timeline accelerated by 4 days.'
            };
        });
        
        return reply.status(200).send({ status: 'success', engine_run: true, active_zones_processed: updates.length, diagnostics: updates });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Lifecycle engine failed' });
    } finally {
        client.release();
    }
}

export async function diagnoseCropFoliar(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user || !user.id) {
        return reply.status(401).send({ error: 'Unauthorized: Authentication token required' });
    }

    const { imageBase64, cropName, language } = (request.body || {}) as any;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
        return reply.status(400).send({
            error: 'INVALID_INPUT',
            message: 'Image payload is required and must be a base64 encoded string'
        });
    }

    const groqApiKey = process.env.GROQ_API_KEY || process.env.GROQ_FALLBACK_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!groqApiKey && !geminiApiKey) {
        return reply.status(503).send({
            status: 'error',
            code: 'PROVIDER_NOT_CONFIGURED',
            message: 'No AI Vision provider is configured on the backend server. Please configure GROQ_API_KEY or GEMINI_API_KEY.'
        });
    }

    try {
        const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
        const targetCrop = cropName || 'cotton';
        const langName = language === 'te' ? 'Telugu' : (language === 'hi' ? 'Hindi' : 'English');

        let prediction: any = null;
        let providerProvenance = '';

        const systemPrompt = `You are an expert ICAR agricultural pathologist. Analyze this crop foliar specimen (${targetCrop}). Diagnose the disease or deficiency, severity (None, Low, Medium, High, or Critical), confidence score percentage (0-100), biological pathogen, organic bio-formulation remedy, precise chemical tank mix dosage in ml/L or g/L, and safety advisory. Language: ${langName}. Respond strictly in valid JSON matching this schema:
{
  "crop": "${targetCrop}",
  "diseaseName": "Disease or Healthy Foliar Tissue",
  "severity": "Low",
  "confidence": 88,
  "pathogen": "Identified biological pathogen or None",
  "symptoms": "Detailed foliar symptoms observed",
  "organicSolution": "ICAR verified organic remedy",
  "chemicalSolution": "Chemical tank mix dosage",
  "sprayAdvisory": "Safe application window"
}`;

        // Strategy 1: Groq Cloud API (High-Speed Multimodal Vision)
        if (groqApiKey) {
            try {
                const groqModel = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b';
                const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
                
                // Try primary or fallback key if first fails
                const keysToTry = [groqApiKey];
                if (process.env.GROQ_FALLBACK_API_KEY && process.env.GROQ_FALLBACK_API_KEY !== groqApiKey) {
                    keysToTry.push(process.env.GROQ_FALLBACK_API_KEY);
                }

                for (const currentKey of keysToTry) {
                    try {
                        const groqRes = await axios.post(groqUrl, {
                            model: groqModel,
                            messages: [
                                { role: 'system', content: systemPrompt },
                                {
                                    role: 'user',
                                    content: [
                                        { type: 'text', text: `Analyze this ${targetCrop} foliar sample:` },
                                        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${cleanBase64}` } }
                                    ]
                                }
                            ],
                            response_format: { type: 'json_object' },
                            max_tokens: 450,
                            temperature: 0.1
                        }, {
                            headers: {
                                'Authorization': `Bearer ${currentKey}`,
                                'Content-Type': 'application/json'
                            },
                            timeout: 25000
                        });

                        const rawText = groqRes.data?.choices?.[0]?.message?.content;
                        if (rawText) {
                            prediction = JSON.parse(rawText);
                            providerProvenance = `Groq AI Cloud (${groqModel} Multimodal Vision)`;
                            break;
                        }
                    } catch (keyErr: any) {
                        request.log.warn(`Groq key attempt failed (${keyErr.response?.status || keyErr.message}). Checking next fallback...`);
                    }
                }
            } catch (groqErr) {
                request.log.warn({ err: groqErr }, 'Groq vision execution failed, checking Gemini fallback');
            }
        }

        // Strategy 2: Google Gemini Vision API (Fallback)
        if (!prediction && geminiApiKey) {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
            const geminiRes = await axios.post(geminiUrl, {
                contents: [{
                    parts: [
                        { text: systemPrompt },
                        { inline_data: { mime_type: "image/jpeg", data: cleanBase64 } }
                    ]
                }],
                generationConfig: { response_mime_type: "application/json" }
            }, { timeout: 30000 });

            const rawText = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawText) {
                prediction = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());
                providerProvenance = 'Google Gemini 1.5 Flash Vision (Server-Side Ingestion)';
            }
        }

        if (!prediction) {
            return reply.status(502).send({
                status: 'error',
                code: 'INVALID_PROVIDER_RESPONSE',
                message: 'All configured AI vision models returned empty or unparseable candidate responses.'
            });
        }

        // Persist confirmed scan to database under authenticated user
        const client = await pool.connect();
        let persistedScan = null;
        try {
            const dbResult = await client.query(`
                INSERT INTO disease_scans (user_id, crop_type, disease_detected, confidence_score, severity, treatment_recommendation, status)
                VALUES ($1, $2, $3, $4, $5, $6, 'CONFIRMED')
                RETURNING id, created_at
            `, [
                user.id,
                targetCrop,
                prediction.diseaseName || 'Foliar Anomaly',
                parseFloat(prediction.confidence) || 85.0,
                prediction.severity || 'Medium',
                prediction.chemicalSolution || prediction.organicSolution || 'Apply ICAR advisory'
            ]);
            persistedScan = dbResult.rows[0];
        } catch (dbErr) {
            request.log.warn({ err: dbErr }, 'Failed to persist scan to PostgreSQL (continuing with diagnosis)');
        } finally {
            client.release();
        }

        return reply.status(200).send({
            status: 'success',
            ai_prediction: prediction,
            persisted_scan_id: persistedScan?.id || null,
            provenance: providerProvenance,
            disclaimer: 'AI-generated optical prediction. Not a certified laboratory chemical or pathological diagnosis.',
            timestamp: new Date().toISOString()
        });

    } catch (err: any) {
        request.log.error(err);
        const statusCode = err.response?.status || 500;
        const msg = err.response?.data?.error?.message || err.message || 'Error communicating with vision inference provider';
        return reply.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).send({
            status: 'error',
            code: 'INFERENCE_FAILED',
            message: msg
        });
    }
}

export async function chatAgronomist(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user || !user.id) {
        return reply.status(401).send({ error: 'Unauthorized: Authentication token required' });
    }

    const { prompt, systemInstruction, language } = (request.body || {}) as any;
    if (!prompt || typeof prompt !== 'string') {
        return reply.status(400).send({
            error: 'INVALID_INPUT',
            message: 'Prompt query is required and must be a string'
        });
    }

    const groqApiKey = process.env.GROQ_API_KEY || process.env.GROQ_FALLBACK_API_KEY;
    if (!groqApiKey) {
        return reply.status(503).send({
            status: 'error',
            code: 'PROVIDER_NOT_CONFIGURED',
            message: 'Groq AI provider is not configured on the backend server'
        });
    }

    const targetLang = language === 'te' ? 'Telugu' : (language === 'hi' ? 'Hindi' : 'English');
    const defaultSys = systemInstruction || `You are NuKropAI, an elite ICAR Indian agricultural scientist. Answer practical farming queries strictly in ${targetLang}. Provide accurate chemical tank dosages (ml/L or g/L) and organic remedies.`;

    const groqModel = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b';
    const keysToTry = [groqApiKey];
    if (process.env.GROQ_FALLBACK_API_KEY && process.env.GROQ_FALLBACK_API_KEY !== groqApiKey) {
        keysToTry.push(process.env.GROQ_FALLBACK_API_KEY);
    }

    for (const key of keysToTry) {
        try {
            const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: groqModel,
                messages: [
                    { role: 'system', content: defaultSys },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 500,
                temperature: 0.2
            }, {
                headers: {
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            });

            const text = res.data?.choices?.[0]?.message?.content?.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
            if (text) {
                return reply.status(200).send({
                    status: 'success',
                    response: text,
                    text: text,
                    model: groqModel,
                    provider: 'Groq AI Cloud'
                });
            }
        } catch (keyErr: any) {
            request.log.warn({ err: keyErr.message }, 'Groq chat request attempt failed');
        }
    }

    return reply.status(502).send({
        status: 'error',
        code: 'UPSTREAM_FAILURE',
        message: 'Groq AI provider failed to process agricultural query'
    });
}


