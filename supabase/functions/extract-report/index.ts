import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: corsHeaders,
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Get auth token from request header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return errorResponse('No auth header', 401)
    }

    // 2. Create admin client using service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      return errorResponse('Missing Supabase env vars', 500)
    }
    if (!anthropicKey) {
      return errorResponse('Missing ANTHROPIC_API_KEY', 500)
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    // 3. Get user from JWT
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } =
      await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return errorResponse(`Invalid token: ${userError?.message ?? 'no user'}`, 401)
    }

    // 4. Parse body
    const body = await req.json()
    const report_id = body?.report_id
    if (!report_id) {
      return errorResponse('report_id required', 400)
    }

    // 5. Fetch report — verify it belongs to this user
    const { data: report, error: reportError } = await supabaseAdmin
      .from('reports')
      .select('*')
      .eq('id', report_id)
      .eq('owner_id', user.id)
      .single()

    if (reportError || !report) {
      return errorResponse(`Report not found: ${reportError?.message ?? 'no data'}`, 404)
    }

    if (report.extraction_status !== 'pending') {
      return errorResponse(`Already processed (status: ${report.extraction_status})`, 400)
    }

    // 6. Mark as processing
    await supabaseAdmin
      .from('reports')
      .update({ extraction_status: 'processing' })
      .eq('id', report_id)

    // 7. Download file from storage
    const { data: fileData, error: fileError } =
      await supabaseAdmin.storage
        .from('reports')
        .download(report.file_path)

    if (fileError || !fileData) {
      await supabaseAdmin.from('reports').update({
        extraction_status: 'failed',
        extraction_error: `Could not download file: ${fileError?.message ?? 'no data'}`
      }).eq('id', report_id)

      return errorResponse(`File download failed: ${fileError?.message ?? 'no data'}`, 500)
    }

    // 8. Convert file to base64
    const arrayBuffer = await fileData.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < uint8Array.byteLength; i++) {
      binary += String.fromCharCode(uint8Array[i])
    }
    const base64File = btoa(binary)

    // 9. Build content blocks for Claude
    const fileBlock = report.file_type === 'pdf'
      ? {
          type: 'document' as const,
          source: {
            type: 'base64' as const,
            media_type: 'application/pdf' as const,
            data: base64File
          }
        }
      : {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: 'image/jpeg' as const,
            data: base64File
          }
        }

    const extractionPrompt = `You are a medical data extraction assistant specialising in Indian laboratory reports. This document may have multiple pages. You MUST scan every single page completely before responding.

Extract ALL biomarkers from ALL pages and return ONLY a valid JSON object — no markdown, no explanation, no preamble, no code blocks, nothing outside the JSON.

A comprehensive Indian blood panel has 50-100+ biomarkers across CBC, WBC differential, lipid panel, liver function, kidney function, thyroid, diabetes, iron studies, vitamins, minerals, electrolytes, hormones, inflammation markers, cardiac markers, coagulation, urinalysis, and more. Extract every single one without exception.

{
  "lab_name": "string or null",
  "report_date": "YYYY-MM-DD or null",
  "biomarkers": [
    {
      "raw_name": "exact name as printed",
      "canonical_name": "standard medical name e.g. Hemoglobin, White Blood Cell Count, Platelet Count, Mean Corpuscular Volume, Neutrophils, Lymphocytes, HbA1c, Fasting Blood Glucose, Total Cholesterol, LDL Cholesterol, HDL Cholesterol, Triglycerides, Alanine Aminotransferase, Aspartate Aminotransferase, Total Bilirubin, Creatinine, Blood Urea Nitrogen, eGFR, Uric Acid, Thyroid Stimulating Hormone, Free T3, Free T4, Vitamin D (25-OH), Vitamin B12, Ferritin, Serum Iron, Calcium, Sodium, Potassium, etc. Use the most common standard name for the test.",
      "value": 0.0,
      "unit": "string",
      "reference_min": 0.0 or null,
      "reference_max": 0.0 or null,
      "status": "normal or low or high or critical_low or critical_high"
    }
  ]
}

Rules:
- Scan every page without exception
- value always a number never a string
- reference_min and reference_max numbers or null never strings
- Range 13.0-17.0 means reference_min 13.0 reference_max 17.0
- Less than 200 means reference_min null reference_max 200
- status from value vs reference range, if no range use normal
- critical only for severely abnormal values
- Extract every test result on every page no exceptions
- Return ONLY the JSON, zero characters outside it`

    // 10. Call Claude API
    const claudeResponse = await fetch(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 16000,
          messages: [
            {
              role: 'user',
              content: [fileBlock, { type: 'text', text: extractionPrompt }]
            }
          ]
        })
      }
    )

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text()
      await supabaseAdmin.from('reports').update({
        extraction_status: 'failed',
        extraction_error: `Claude API error (${claudeResponse.status}): ${errText.slice(0, 500)}`
      }).eq('id', report_id)

      return errorResponse(`AI extraction failed (${claudeResponse.status}): ${errText.slice(0, 200)}`, 500)
    }

    const claudeData = await claudeResponse.json()
    let rawText = claudeData.content?.[0]?.text ?? ''

    // 11. Strip markdown code blocks if present
    rawText = rawText.trim()
    // Use greedy match to capture everything between first ``` and last ```
    const codeBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*)```/)
    if (codeBlockMatch) {
      rawText = codeBlockMatch[1].trim()
    }
    // Also try extracting just the JSON object if there's surrounding text
    if (!rawText.startsWith('{')) {
      const jsonStart = rawText.indexOf('{')
      const jsonEnd = rawText.lastIndexOf('}')
      if (jsonStart !== -1 && jsonEnd !== -1) {
        rawText = rawText.slice(jsonStart, jsonEnd + 1)
      }
    }

    // 12. Parse JSON response
    let extracted: { lab_name?: string; report_date?: string; biomarkers?: any[] }
    try {
      extracted = JSON.parse(rawText)
    } catch (parseErr: unknown) {
      const parseMessage = parseErr instanceof Error ? parseErr.message : String(parseErr)

      // If Claude couldn't find biomarkers (e.g. not a medical report),
      // mark as failed with a user-friendly message
      const lower = rawText.toLowerCase()
      const isNotMedical = lower.includes('not a') ||
        lower.includes('cannot') ||
        lower.includes('no biomarker') ||
        lower.includes('not a blood') ||
        lower.includes('unable to')

      const userMessage = isNotMedical
        ? 'This does not appear to be a blood test report.'
        : 'Could not read the report contents.'

      await supabaseAdmin.from('reports').update({
        extraction_status: 'failed',
        extraction_error: `${userMessage} Parse: ${parseMessage}. Raw (first 400): ${rawText.slice(0, 400)}`
      }).eq('id', report_id)

      return errorResponse(userMessage, 422)
    }

    // 13. Fetch canonical names + aliases for fuzzy matching
    const { data: canonicalRows } = await supabaseAdmin
      .from('canonical_biomarkers')
      .select('canonical_name, aliases')

    const validNames = new Set(
      (canonicalRows ?? []).map((r: any) => r.canonical_name)
    )

    // Build alias → canonical_name lookup (case-insensitive)
    const aliasMap = new Map<string, string>()
    for (const row of (canonicalRows ?? [])) {
      const cn = row.canonical_name
      aliasMap.set(cn.toLowerCase(), cn)
      for (const alias of (row.aliases ?? [])) {
        aliasMap.set(alias.toLowerCase(), cn)
      }
    }

    // Resolve each biomarker: try exact match, then alias lookup
    function resolveCanonical(name: string): string | null {
      if (validNames.has(name)) return name
      return aliasMap.get(name.toLowerCase()) ?? null
    }

    // 14. Map and filter biomarkers
    const allBiomarkers = extracted.biomarkers ?? []
    const biomarkers = allBiomarkers
      .filter((b: any) => b && typeof b.value === 'number' && b.unit && b.raw_name)
      .map((b: any) => ({
        ...b,
        canonical_name: resolveCanonical(b.canonical_name) ?? resolveCanonical(b.raw_name)
      }))
      .filter((b: any) => b.canonical_name !== null)

    if (biomarkers.length > 0) {
      const biomarkerRows = biomarkers.map((b: any) => ({
        owner_id: user.id,
        report_id: report_id,
        family_member_id: report.family_member_id,
        canonical_name: b.canonical_name,
        raw_name: b.raw_name,
        value: Number(b.value),
        unit: b.unit,
        reference_min: b.reference_min != null ? Number(b.reference_min) : null,
        reference_max: b.reference_max != null ? Number(b.reference_max) : null,
        status: ['normal', 'low', 'high', 'critical_low', 'critical_high'].includes(b.status)
          ? b.status
          : 'normal',
        report_date: extracted.report_date || report.report_date
      }))

      const { error: insertError } = await supabaseAdmin
        .from('biomarkers')
        .insert(biomarkerRows)

      if (insertError) {
        await supabaseAdmin.from('reports').update({
          extraction_status: 'failed',
          extraction_error: `Biomarker insert error: ${insertError.message}`
        }).eq('id', report_id)

        return errorResponse(`Could not save biomarkers: ${insertError.message}`, 500)
      }
    }

    // 13. Update report to complete
    await supabaseAdmin.from('reports').update({
      extraction_status: 'complete',
      lab_name: report.lab_name || extracted.lab_name,
      biomarker_count: biomarkers.length,
      extraction_model: 'claude-sonnet-4-5',
      updated_at: new Date().toISOString()
    }).eq('id', report_id)

    // 14. Refresh biomarker summaries
    await supabaseAdmin.rpc('refresh_biomarker_summaries', {
      p_family_member_id: report.family_member_id
    })

    return new Response(
      JSON.stringify({
        success: true,
        biomarker_count: biomarkers.length
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
