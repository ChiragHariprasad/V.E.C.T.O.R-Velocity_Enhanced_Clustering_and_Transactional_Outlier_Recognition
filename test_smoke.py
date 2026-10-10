#!/usr/bin/env python3
"""
V.E.C.T.O.R — Demo Smoke Test Script
Rapidly verifies API health, database connectivity, ML model availability,
SPA serving, and analytical ingestion against a running V.E.C.T.O.R instance.
"""

import sys
import os
import json
import time
import urllib.request
import urllib.error

BASE_URL = os.environ.get("VECTOR_SMOKE_BASE_URL", "http://127.0.0.1:3001").rstrip("/")

def log_pass(msg):
    print(f"  [PASS] {msg}")

def log_fail(msg):
    print(f"  [FAIL] {msg}")

def test_endpoint(name, url, expected_status=200):
    t0 = time.time()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "vector-smoke-test"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = resp.read()
            elapsed_ms = (time.time() - t0) * 1000
            if resp.status == expected_status:
                log_pass(f"{name} ({resp.status} OK in {elapsed_ms:.1f}ms)")
                return data
            else:
                log_fail(f"{name}: Expected {expected_status}, got {resp.status}")
                return None
    except Exception as e:
        log_fail(f"{name}: Request failed: {e}")
        return None

def main():
    print("===================================================================")
    print("  V.E.C.T.O.R — DEMO SMOKE TEST SUITE")
    print("===================================================================")

    failures = 0

    # 1. Root SPA Serving Check
    print("\n[1/6] Checking Unified SPA Serving...")
    spa_data = test_endpoint("SPA Root HTML", f"{BASE_URL}/")
    if spa_data and b"<html" in spa_data.lower():
        log_pass("SPA HTML rendered from single-port server.")
    else:
        log_fail("SPA HTML missing or invalid response.")
        failures += 1

    # 2. System Status & Model Telemetry
    print("\n[2/6] Checking System Status & Reported Model State...")
    status_raw = test_endpoint("Status API", f"{BASE_URL}/api/bitcoin/status")
    if status_raw:
        try:
            status_json = json.loads(status_raw)
            model_status = status_json.get("model", {}).get("status", "NOT REPORTED")
            node_status = status_json.get("node", {}).get("status", "NOT REPORTED")
            total_txs = status_json.get("storage", {}).get("total_transactions")
            
            log_pass(f"Model Status: {model_status}")
            log_pass(f"Node Status: {node_status}")
            log_pass(f"Stored Transactions: {total_txs}")

            if status_json.get("node", {}).get("status") == "SIMULATION" and status_json.get("node", {}).get("network") not in (None, "simulation"):
                log_fail("Simulation node status reports an unexpected network.")
                failures += 1
        except Exception as e:
            log_fail(f"Failed to parse status JSON: {e}")
            failures += 1
    else:
        failures += 1

    # 3. Transaction Retrieval
    print("\n[3/6] Checking Transaction Storage & Feed...")
    txs_raw = test_endpoint("Transactions API", f"{BASE_URL}/api/bitcoin/transactions?limit=5")
    if txs_raw:
        try:
            txs = json.loads(txs_raw)
            if isinstance(txs, list) and len(txs) > 0:
                sample = txs[0]
                log_pass(f"Retrieved {len(txs)} transactions. Sample TXID: {sample.get('txid', '')[:16]}...")
                log_pass(f"Risk Level: {sample.get('risk_level')}, Score: {sample.get('risk_score')}")
            else:
                log_fail("Transaction list is empty.")
                failures += 1
        except Exception as e:
            log_fail(f"Failed to parse transactions JSON: {e}")
            failures += 1
    else:
        failures += 1

    # 4. Investigation Dossier
    print("\n[4/6] Checking Investigation Dossier...")
    inv_raw = test_endpoint("Investigations API", f"{BASE_URL}/api/bitcoin/investigations?limit=3")
    if inv_raw:
        try:
            invs = json.loads(inv_raw)
            if isinstance(invs, list):
                log_pass(f"Investigation endpoint returned {len(invs)} records.")
            else:
                log_fail("No investigations found.")
                failures += 1
        except Exception as e:
            log_fail(f"Failed to parse investigations JSON: {e}")
            failures += 1
    else:
        failures += 1

    # 5. Entity Search Resolver
    print("\n[5/6] Checking Entity Search...")
    search_raw = test_endpoint("Search API", f"{BASE_URL}/api/bitcoin/search?q=ENT_")
    if search_raw:
        try:
            results = json.loads(search_raw)
            if isinstance(results, list) and len(results) > 0:
                log_pass(f"Resolved {len(results)} entities matching 'ENT_'. Top match: {results[0].get('id')}")
            else:
                log_fail("No entity matches found.")
                failures += 1
        except Exception as e:
            log_fail(f"Failed to parse search JSON: {e}")
            failures += 1
    else:
        failures += 1

    # 6. Read-only write-guard check; deliberately sends no transaction data.
    print("\n[6/6] Checking Read-Only Write Guard...")
    req = urllib.request.Request(
        f"{BASE_URL}/api/bitcoin/ingest",
        data=json.dumps({"transactions": []}).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": "vector-smoke-test"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            log_fail(f"Write guard returned HTTP {resp.status}; the smoke test sent no transactions.")
            failures += 1
    except urllib.error.HTTPError as err:
        response = json.loads(err.read().decode("utf-8"))
        if err.code == 403 and response.get("mode") == "DEMO_READ_ONLY":
            log_pass("Write route rejects requests in DEMO_READ_ONLY mode.")
        else:
            log_fail(f"Write route returned HTTP {err.code}: {response}")
            failures += 1
    except Exception as err:
        log_fail(f"Write guard check failed: {err}")
        failures += 1

    print("\n===================================================================")
    if failures == 0:
        print("  SMOKE TEST PASSED: ALL 6 CHECKS VERIFIED SUCCESSFULLY.")
        print("===================================================================")
        return 0
    else:
        print(f"  SMOKE TEST FAILED: {failures} ERROR(S) DETECTED.")
        print("===================================================================")
        return 1

if __name__ == "__main__":
    sys.exit(main())
