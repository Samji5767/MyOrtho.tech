#!/usr/bin/env bash
# Phase 15A — API validation examples
# Usage: TOKEN=<your_jwt> CASE_ID=<uuid> bash test/curl-examples.sh
# All calls target localhost:4000 (override with BASE=https://api.myortho.tech)

BASE="${BASE:-http://localhost:4000}"
TOKEN="${TOKEN:-replace_with_real_jwt}"
CASE_ID="${CASE_ID:-replace_with_real_case_uuid}"
PLAN_ID="${PLAN_ID:-replace_with_real_plan_uuid}"
SCAN_ID="${SCAN_ID:-replace_with_real_scan_uuid}"
JOB_ID="${JOB_ID:-replace_with_real_job_uuid}"
AUTH="Authorization: Bearer $TOKEN"

echo "=== Health ==="
curl -s "$BASE/health" | python3 -m json.tool
curl -s "$BASE/health/ready" | python3 -m json.tool

echo ""
echo "=== Scans — list ==="
curl -s -H "$AUTH" "$BASE/api/cases/$CASE_ID/scans" | python3 -m json.tool

echo ""
echo "=== Scans — upload (requires a real .stl file) ==="
# curl -s -H "$AUTH" \
#   -F "file=@/tmp/upper.stl" \
#   -F "jawType=maxillary" \
#   "$BASE/api/cases/$CASE_ID/scans" | python3 -m json.tool

echo "=== Scans — trigger segmentation ==="
echo "(requires a real scan_id obtained from upload)"
# curl -s -X POST -H "$AUTH" \
#   "$BASE/api/cases/$CASE_ID/scans/$SCAN_ID/segment" | python3 -m json.tool

echo ""
echo "=== Segment job — poll status ==="
# curl -s -H "$AUTH" "$BASE/api/segment-jobs/$JOB_ID" | python3 -m json.tool

echo ""
echo "=== Treatment plans — list ==="
curl -s -H "$AUTH" "$BASE/api/cases/$CASE_ID/plans" | python3 -m json.tool

echo ""
echo "=== Treatment plans — create ==="
curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"estimatedStages": 24, "aiRecommendationNotes": "Manual review required"}' \
  "$BASE/api/cases/$CASE_ID/plans" | python3 -m json.tool

echo ""
echo "=== Treatment plans — list stages ==="
# curl -s -H "$AUTH" "$BASE/api/cases/$CASE_ID/plans/$PLAN_ID/stages" | python3 -m json.tool

echo ""
echo "=== Treatment plans — create stage ==="
# curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" \
#   -d '{"stageNumber": 1, "movements": {"tooth_11": {"tx": 0.5, "ty": 0.0, "tz": 0.0}}}' \
#   "$BASE/api/cases/$CASE_ID/plans/$PLAN_ID/stages" | python3 -m json.tool

echo ""
echo "=== Manufacturing — list jobs ==="
curl -s -H "$AUTH" "$BASE/api/manufacturing/jobs" | python3 -m json.tool

echo ""
echo "=== Manufacturing — create job ==="
curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"qcNotes": "Batch 1"}' \
  "$BASE/api/manufacturing/jobs" | python3 -m json.tool

echo ""
echo "=== Printers — list (DB registry) ==="
curl -s -H "$AUTH" "$BASE/api/printers" | python3 -m json.tool

echo ""
echo "=== AI models status ==="
curl -s "http://localhost:8000/ai/models" | python3 -m json.tool

echo ""
echo "Done."
