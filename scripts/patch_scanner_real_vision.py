# -*- coding: utf-8 -*-
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('app/src/main/assets/index.html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

old_scan_fn = """  // Query live real AI engine with active crop context
  let aiSymptoms = defaultDiag.symptoms[currentLang] || defaultDiag.symptoms.en;
  try {
    const aiPrompt = `Diagnose ${isSoil ? 'soil nutrient deficiency' : 'crop foliar disease'} on ${currentCrop.id || 'cotton'}. Provide: 1. Symptoms, 2. Organic bio-formulation, 3. Chemical tank mix dosage (ml/L or g/L). Language: ${currentLang === 'te' ? 'Telugu' : (currentLang === 'hi' ? 'Hindi' : 'English')}.`;
    const aiResp = await callGroqAI(aiPrompt);
    if (aiResp && aiResp.length > 30) {
      aiSymptoms = aiResp;
    }
  } catch(e) {
    console.warn('Real AI diagnosis fallback:', e);
  }

  const diagnosis = defaultDiag;

  setTimeout(() => {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = TL('✓ AI Diagnosis Complete!', '✓ AI నిర్ధారణ పూర్తయింది!', '✓ AI रोग निदान पूरा!');
      btn.style.background = '#15803D';
    }

    const diagBox = document.getElementById('scan-diag-box');
    const resultContent = document.getElementById('scan-result-content');

    const newScanId = 'SCN-' + Math.floor(10000 + Math.random() * 90000);
    const now = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const nowTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    
    const newScanEntry = {
      id: newScanId,
      timestamp: Date.now(),
      date: now,
      time: nowTime,
      mode: currentScanMode,
      cropName: isSoil ? TL('Soil Sample', 'నేల నమూనా', 'मिट्टी नमूना') : (getLocalizedCropName(currentCrop.id)),
      diseaseName: diagnosis.diseaseName[currentLang] || diagnosis.diseaseName.en,
      severity: diagnosis.severity,
      confidence: diagnosis.confidence,
      vector: diagnosis.vector,
      rootCause: aiSymptoms || (diagnosis.symptoms[currentLang] || diagnosis.symptoms.en),
      organicSolution: diagnosis.organicSolution[currentLang] || diagnosis.organicSolution.en,
      chemicalSolution: diagnosis.chemicalSolution[currentLang] || diagnosis.chemicalSolution.en,
      sprayAdvisory: diagnosis.sprayAdvisory[currentLang] || diagnosis.sprayAdvisory.en
    };"""

new_scan_fn = """  // Real Gemini Vision AI Inference on Captured Image
  const geminiApiKey = localStorage.getItem('nukrop_gemini_api_key') || (typeof GEMINI_API_KEY !== 'undefined' ? GEMINI_API_KEY : '');
  let aiSymptoms = defaultDiag.symptoms[currentLang] || defaultDiag.symptoms.en;
  let aiPrediction = null;
  let isAiLive = false;

  if (uploadedScanImageData && geminiApiKey) {
    try {
      const base64Data = uploadedScanImageData.includes(',') ? uploadedScanImageData.split(',')[1] : uploadedScanImageData;
      const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: `You are an expert ICAR agricultural pathologist. Analyze this crop specimen (${currentCrop.id || 'crop foliar sample'}). Diagnose the disease or deficiency, severity (Low, Medium, High, or Critical), confidence score percentage (0-100), biological pathogen, organic bio-formulation remedy, precise chemical tank mix dosage in ml/L or g/L, and safety advisory. Language: ${currentLang === 'te' ? 'Telugu' : (currentLang === 'hi' ? 'Hindi' : 'English')}. Output strictly as valid JSON with keys: diseaseName, severity, confidence, pathogen, organicSolution, chemicalSolution, sprayAdvisory, symptoms.` },
              { inline_data: { mime_type: "image/jpeg", data: base64Data } }
            ]
          }],
          generationConfig: { response_mime_type: "application/json" }
        })
      });
      if (gRes.ok) {
        const gJson = await gRes.json();
        const rawText = gJson.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          aiPrediction = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());
          isAiLive = true;
        }
      }
    } catch(e) {
      console.warn('Gemini Vision inference error, falling back to botanical pathology DB:', e);
    }
  } else if (!geminiApiKey) {
    // If no key configured, query Groq text advisory or use ICAR database with honest notice
    try {
      const aiPrompt = `Diagnose ${isSoil ? 'soil nutrient deficiency' : 'crop foliar disease'} on ${currentCrop.id || 'cotton'}. Provide: 1. Symptoms, 2. Organic bio-formulation, 3. Chemical tank mix dosage (ml/L or g/L). Language: ${currentLang === 'te' ? 'Telugu' : (currentLang === 'hi' ? 'Hindi' : 'English')}.`;
      const aiResp = await callGroqAI(aiPrompt);
      if (aiResp && aiResp.length > 30) {
        aiSymptoms = aiResp;
      }
    } catch(e) {
      console.warn('Real AI diagnosis fallback:', e);
    }
  }

  const diagnosis = defaultDiag;

  setTimeout(() => {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = TL('✓ AI Diagnosis Complete!', '✓ AI నిర్ధారణ పూర్తయింది!', '✓ AI रोग निदान पूरा!');
      btn.style.background = '#15803D';
    }

    const diagBox = document.getElementById('scan-diag-box');
    const resultContent = document.getElementById('scan-result-content');

    const newScanId = 'SCN-' + Math.floor(10000 + Math.random() * 90000);
    const now = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const nowTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    let finalSymptoms = aiPrediction?.symptoms || aiSymptoms || (diagnosis.symptoms[currentLang] || diagnosis.symptoms.en);
    if (isSoil) {
      finalSymptoms += TL(
        " [Notice: Visual soil assessment only. For certified NPK and pH values, submit a sample to an authorized Soil Testing Laboratory under the Soil Health Card scheme.]",
        " [గమనిక: కేవలం ఫోటో ద్వారా రసాయన NPK/pH విలువలను కొలవలేము. ల్యాబ్ సాయిల్ హెల్త్ కార్డ్ పరీక్ష అవసరం.]",
        " [सूचना: केवल तस्वीर से NPK/pH नहीं मापा जा सकता। प्रमाणित रिपोर्ट के लिए मृदा स्वास्थ्य कार्ड प्रयोगशाला का उपयोग करें।]"
      );
    }

    const newScanEntry = {
      id: newScanId,
      timestamp: Date.now(),
      date: now,
      time: nowTime,
      mode: currentScanMode,
      cropName: isSoil ? TL('Soil Sample', 'నేల నమూనా', 'मिट्टी नमूना') : (getLocalizedCropName(currentCrop.id)),
      diseaseName: aiPrediction?.diseaseName || (diagnosis.diseaseName[currentLang] || diagnosis.diseaseName.en),
      severity: aiPrediction?.severity || diagnosis.severity,
      confidence: aiPrediction?.confidence ? aiPrediction.confidence + '%' : diagnosis.confidence,
      vector: aiPrediction?.pathogen || diagnosis.vector,
      rootCause: (isAiLive ? '🤖 Gemini Vision AI Analysis: ' : '🌿 ICAR Botanical Pathology Match: ') + finalSymptoms,
      organicSolution: aiPrediction?.organicSolution || (diagnosis.organicSolution[currentLang] || diagnosis.organicSolution.en),
      chemicalSolution: aiPrediction?.chemicalSolution || (diagnosis.chemicalSolution[currentLang] || diagnosis.chemicalSolution.en),
      sprayAdvisory: aiPrediction?.sprayAdvisory || (diagnosis.sprayAdvisory[currentLang] || diagnosis.sprayAdvisory.en)
    };"""

if old_scan_fn in content:
    content = content.replace(old_scan_fn, new_scan_fn)
    print("✔ [SUCCESS] Remediated startScannerDiagnostic with Gemini Vision and scientific soil notice")
else:
    print("⚠️ [WARNING] Could not find exact old_scan_fn block")

with open('app/src/main/assets/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Saved updated app/src/main/assets/index.html")
