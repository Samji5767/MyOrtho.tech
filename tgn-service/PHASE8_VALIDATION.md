# Phase 8 — End-to-End System Validation Framework

**Status:** Framework defined. Requires running MyOrtho + TGN stack with real data.

> This document defines the complete validation procedure for the integrated
> MyOrtho + ToothGroupNetwork workflow. Actual measurements must be collected
> on a live deployment. No results are fabricated here.

---

## 1. Prerequisites

| Requirement | Check |
|-------------|-------|
| MyOrtho stack running (`docker compose up`) | `curl -s http://localhost:4000/health` |
| TGN API running (`docker compose -f … -f docker-compose.tgn.yml up`) | `curl -s http://localhost:8001/health` |
| Redis healthy | `docker exec myortho-redis redis-cli ping` |
| TGN checkpoints present | `ls -lh /opt/toothgroupnetwork/ckpts/tgnet_fps.h5` |
| ≥ 2 test STL files (upper + lower, same patient) | Manual check |
| Test doctor account with known credentials | Seeded in DB |

---

## 2. End-to-End Workflow Steps

### Step 1 — Doctor Login

```bash
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"doctor@test.local","password":"TestPassword123!"}' \
  | jq -r .accessToken)

[ -n "$TOKEN" ] && echo "PASS: login" || echo "FAIL: login"
```

**Pass criteria:** HTTP 200, `accessToken` in response body.

---

### Step 2 — Patient Creation

```bash
PATIENT_ID=$(curl -s -X POST http://localhost:4000/api/patients \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"firstName":"E2E","lastName":"TestPatient","dateOfBirth":"1990-01-15"}' \
  | jq -r .id)

[ -n "$PATIENT_ID" ] && echo "PASS: patient created ($PATIENT_ID)" || echo "FAIL: patient create"
```

---

### Step 3 — Case Creation

```bash
CASE_ID=$(curl -s -X POST http://localhost:4000/api/cases \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"patientId\":\"$PATIENT_ID\",\"chiefComplaint\":\"E2E validation crowding\"}" \
  | jq -r .id)

[ -n "$CASE_ID" ] && echo "PASS: case created ($CASE_ID)" || echo "FAIL: case create"
```

---

### Step 4 — Upper STL Upload

```bash
UPPER_JOB=$(curl -s -X POST http://localhost:4000/api/cases/$CASE_ID/scans \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/test_upper.stl" \
  -F "jaw=upper" \
  | jq -r .jobId)

[ -n "$UPPER_JOB" ] && echo "PASS: upper scan uploaded (job $UPPER_JOB)" || echo "FAIL: upper upload"
```

---

### Step 5 — Lower STL Upload

```bash
LOWER_JOB=$(curl -s -X POST http://localhost:4000/api/cases/$CASE_ID/scans \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/test_lower.stl" \
  -F "jaw=lower" \
  | jq -r .jobId)

[ -n "$LOWER_JOB" ] && echo "PASS: lower scan uploaded (job $LOWER_JOB)" || echo "FAIL: lower upload"
```

---

### Step 6 — Poll AI Engine (STL → OBJ → TGN Segmentation)

```bash
poll_job() {
  local JOB=$1
  local MAX=180  # 3 min timeout
  local ELAPSED=0
  while [ $ELAPSED -lt $MAX ]; do
    STATUS=$(curl -s http://localhost:4000/api/jobs/$JOB \
      -H "Authorization: Bearer $TOKEN" | jq -r .status)
    echo "  [${ELAPSED}s] job=$JOB status=$STATUS"
    [ "$STATUS" = "completed" ] && return 0
    [ "$STATUS" = "failed" ] && return 1
    sleep 5
    ELAPSED=$((ELAPSED + 5))
  done
  return 2
}

poll_job "$UPPER_JOB" && echo "PASS: upper segmentation" || echo "FAIL: upper segmentation"
poll_job "$LOWER_JOB" && echo "PASS: lower segmentation" || echo "FAIL: lower segmentation"
```

**Pass criteria:** Both jobs reach `completed` within 180 s (CPU) or 30 s (GPU).

---

### Step 7 — Inspect Segmentation Results

```bash
UPPER_RESULT=$(curl -s http://localhost:4000/api/jobs/$UPPER_JOB \
  -H "Authorization: Bearer $TOKEN")

echo "$UPPER_RESULT" | jq '{
  status: .status,
  tooth_count: (.tooth_ids | length),
  fdi_valid: .fdi_valid,
  requires_review: .requires_manual_review,
  disclaimer_present: (.disclaimer != null)
}'
```

**Pass criteria:**
- `status = "completed"`
- `tooth_ids` contains at least 10 FDI codes
- All codes in range 11–28 (upper) or 31–48 (lower)
- `fdi_valid = true`
- `disclaimer` field present with clinical disclaimer text

---

### Step 8 — Automatic FDI Numbering Validation

```bash
# Verify all returned tooth_ids are valid FDI codes for the jaw
python3 - <<'EOF'
import json, sys

upper_ids = [11,12,13,14,15,16,17,21,22,23,24,25,26,27]  # expected range
result = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {"tooth_ids": []}
# Replace with actual result from step 7
tooth_ids = result.get("tooth_ids", [])
invalid = [t for t in tooth_ids if t not in range(11,29)]
print(f"Detected: {sorted(tooth_ids)}")
print(f"Invalid FDI codes: {invalid}")
print("PASS" if not invalid else "FAIL")
EOF
```

---

### Step 9 — Treatment Planning

```bash
PLAN=$(curl -s -X POST http://localhost:4000/api/cases/$CASE_ID/treatment-plans \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"planName":"E2E Test Plan","notes":"Automated validation plan"}' \
  | jq .)

echo "$PLAN" | jq '.id' | grep -q '"' && echo "PASS: treatment plan created" || echo "FAIL: treatment plan"
PLAN_ID=$(echo "$PLAN" | jq -r .id)
```

---

### Step 10 — STL Export

```bash
EXPORT=$(curl -s -X POST http://localhost:4000/api/cases/$CASE_ID/export \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"format":"stl","include_attachments":false}' \
  | jq .)

echo "$EXPORT" | jq '.download_url' | grep -q '"' && echo "PASS: STL export" || echo "FAIL: STL export"
```

---

### Step 11 — Printer Compatibility Validation

| Printer | Format | Validation |
|---------|--------|-----------|
| Formlabs Form 3B | STL binary | Verify downloaded STL opens without error in PreForm |
| SprintRay Pro55S | STL / 3MF | Verify `file` command shows valid binary STL |
| Asiga MAX | STL | Verify triangle count > 0 in exported file |
| NextDent 5100 | STL | Same as above |
| Ackuretta DENTIQ | STL | Same as above |

```bash
DOWNLOAD_URL=$(echo "$EXPORT" | jq -r .download_url)
curl -s -o /tmp/exported.stl "$DOWNLOAD_URL" -H "Authorization: Bearer $TOKEN"
file /tmp/exported.stl
python3 -c "
import struct, sys
with open('/tmp/exported.stl','rb') as f:
    f.seek(80); count = struct.unpack('<I', f.read(4))[0]
print(f'Triangle count: {count}')
print('PASS' if count > 0 else 'FAIL')
"
```

---

### Step 12 — Case Archive

```bash
ARCHIVE=$(curl -s -X POST http://localhost:4000/api/cases/$CASE_ID/transition \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"toStatus":"archived"}' \
  | jq .)

echo "$ARCHIVE" | jq '.status' | grep -q 'archived' && echo "PASS: case archived" || echo "FAIL: archive"
```

---

## 3. Acceptance Criteria

| Step | Metric | Pass Threshold |
|------|--------|---------------|
| Login | HTTP 200 + token | Required |
| Patient/Case creation | HTTP 201, ID returned | Required |
| STL upload | HTTP 202, jobId returned | Required |
| AI segmentation (CPU) | Completes < 180 s | Required |
| AI segmentation (GPU) | Completes < 30 s | When GPU available |
| FDI codes correct | All codes in valid jaw range | Required |
| FDI code count | ≥ 10 per jaw | Required |
| `fdi_valid` flag | `true` | Required |
| `disclaimer` field | Present in all AI responses | Required |
| STL export | Valid binary STL, triangle count > 0 | Required |
| Printer compatibility | Passes `file` check for each printer format | Required |
| Case archive | Status transitions to `archived` | Required |

---

## 4. Performance Benchmarks to Record

```
Date of validation:         _______________
Hardware:                   _______________  (CPU: ___, RAM: ___, GPU: ___)
TGN API version:            _______________
MyOrtho version:            _______________

STEP TIMINGS (wall clock)
  Login:                    ___ ms
  Patient create:           ___ ms
  Case create:              ___ ms
  STL upload (upper):       ___ ms
  STL upload (lower):       ___ ms
  AI segmentation (upper):  ___ s
  AI segmentation (lower):  ___ s
  STL export:               ___ ms
  Total E2E time:           ___ s

AI RESULTS
  Upper tooth count:        ___  (expected: 14 for full arch)
  Lower tooth count:        ___  (expected: 14 for full arch)
  FDI accuracy:             ___% (if ground truth available)
  fdi_valid=true rate:      ___% over test cases
  requires_manual_review:   ___% of cases

PRINTER EXPORT
  Formlabs:                 PASS / FAIL
  SprintRay:                PASS / FAIL
  Asiga:                    PASS / FAIL
  NextDent:                 PASS / FAIL
  Ackuretta:                PASS / FAIL

E2E OUTCOME:    [ ] PASS    [ ] PARTIAL    [ ] FAIL
Signed by:      _______________
Date:           _______________
```

---

## 5. Automated Test Harness (To Be Implemented)

```python
# tests/e2e/test_full_workflow.py
# Run with: pytest tests/e2e/ --base-url http://localhost:4000

import pytest, httpx, time

BASE = "http://localhost:4000"
TGN  = "http://localhost:8001"

@pytest.fixture(scope="session")
def token():
    r = httpx.post(f"{BASE}/api/auth/login",
                   json={"email":"doctor@test.local","password":"TestPassword123!"})
    assert r.status_code == 200
    return r.json()["accessToken"]

def test_tgn_health():
    r = httpx.get(f"{TGN}/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

def test_tgn_ready():
    r = httpx.get(f"{TGN}/ready")
    assert r.status_code == 200
    data = r.json()
    assert data["model_loaded"] is True

def test_full_workflow(token, test_stl_upper, test_stl_lower):
    headers = {"Authorization": f"Bearer {token}"}
    # Patient
    p = httpx.post(f"{BASE}/api/patients", headers=headers,
                   json={"firstName":"E2E","lastName":"Test"})
    assert p.status_code in (200, 201)
    patient_id = p.json()["id"]
    # Case
    c = httpx.post(f"{BASE}/api/cases", headers=headers,
                   json={"patientId": patient_id, "chiefComplaint": "e2e test"})
    assert c.status_code in (200, 201)
    case_id = c.json()["id"]
    # Upload upper
    with open(test_stl_upper, "rb") as f:
        r = httpx.post(f"{BASE}/api/cases/{case_id}/scans", headers=headers,
                       files={"file": f}, data={"jaw": "upper"})
    assert r.status_code in (200, 202)
    job_id = r.json()["jobId"]
    # Poll
    deadline = time.time() + 180
    while time.time() < deadline:
        s = httpx.get(f"{BASE}/api/jobs/{job_id}", headers=headers).json()
        if s["status"] == "completed":
            break
        time.sleep(5)
    assert s["status"] == "completed"
    assert len(s["tooth_ids"]) >= 10
    assert all(11 <= t <= 28 for t in s["tooth_ids"])
    assert "disclaimer" in s
```

---

## 6. Clinical Disclaimer

> **AI-assisted recommendation only. Final treatment decisions remain the responsibility of the licensed orthodontist.**
>
> This validation framework does not constitute regulatory clearance. All AI outputs must be reviewed by a licensed clinician before clinical use.
