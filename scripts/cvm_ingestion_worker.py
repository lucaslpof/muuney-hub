#!/usr/bin/env python3
"""
CVM Dados Abertos — Ingestion Worker
=====================================
Handles large ZIP files from CVM that exceed Edge Function memory limits.

Endpoints used:
  - CAD/DADOS/cad_fi.csv          → fund catalog (metadata)
  - DOC/INF_DIARIO/DADOS/*.zip    → daily fund data (quota, PL, flows)

Strategy:
  1. Download inf_diario ZIP for recent month → extract top N funds by PL
  2. Cross-reference with cad_fi for metadata
  3. Upsert into hub_fundos_meta + hub_fundos_diario

Usage:
  python3 cvm_ingestion_worker.py --top 500 --months 3
  python3 cvm_ingestion_worker.py --catalog-only --top 500
  python3 cvm_ingestion_worker.py --daily-only --months 1
"""

import argparse
import csv
import io
import json
import os
import sys
import time
import zipfile
from datetime import datetime, timedelta
from typing import Optional

import requests
from supabase import create_client

# ─── Config ───
CVM_BASE = "https://dados.cvm.gov.br/dados/FI"
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://yheopprbuimsunqfaqbp.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

BATCH_SIZE = 500  # upsert chunk size


def get_supabase():
    if not SUPABASE_KEY:
        raise ValueError(
            "SUPABASE_SERVICE_ROLE_KEY not set. "
            "Export it: export SUPABASE_SERVICE_ROLE_KEY='your-key'"
        )
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def log(msg: str):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")


def parse_numeric(val: str) -> Optional[float]:
    if not val or not val.strip():
        return None
    try:
        return float(val.replace(",", "."))
    except ValueError:
        return None


def parse_date(val: str) -> Optional[str]:
    if not val or not val.strip():
        return None
    if "/" in val:
        parts = val.split("/")
        if len(parts) == 3:
            return f"{parts[2]}-{parts[1]}-{parts[0]}"
    return val


# ─── Download helpers ───

def download_csv(path: str) -> list[dict]:
    """Download CSV from CVM (tries .csv then .zip)."""
    csv_url = f"{CVM_BASE}/{path}"
    zip_url = csv_url.replace(".csv", ".zip")

    # Try CSV first
    log(f"Trying CSV: {csv_url}")
    resp = requests.get(csv_url, timeout=120)
    if resp.status_code == 200:
        text = resp.content.decode("iso-8859-1")
        return parse_csv_text(text)

    # Fallback to ZIP
    log(f"CSV not available ({resp.status_code}), trying ZIP: {zip_url}")
    resp = requests.get(zip_url, timeout=300, stream=True)
    if resp.status_code != 200:
        raise RuntimeError(f"CVM fetch failed: {resp.status_code} for {zip_url}")

    # Download ZIP to memory
    zip_bytes = io.BytesIO(resp.content)
    log(f"Downloaded ZIP: {len(resp.content) / 1024 / 1024:.1f} MB")

    with zipfile.ZipFile(zip_bytes) as zf:
        csv_names = [n for n in zf.namelist() if n.endswith(".csv")]
        if not csv_names:
            raise RuntimeError("No CSV found inside ZIP")
        log(f"Extracting: {csv_names[0]}")
        with zf.open(csv_names[0]) as f:
            text = f.read().decode("iso-8859-1")

    return parse_csv_text(text)


def parse_csv_text(text: str) -> list[dict]:
    """Parse CVM CSV (semicolon-separated, potentially malformed)."""
    lines = text.split("\n")
    if len(lines) < 2:
        return []

    # Remove BOM
    lines[0] = lines[0].lstrip("\ufeff")

    reader = csv.DictReader(lines, delimiter=";")
    rows = []
    for i, row in enumerate(reader):
        if row:
            rows.append(row)
    return rows


# ─── Step 1: Get top N funds by PL from inf_diario ───

def get_top_funds_from_diario(year_month: str, top_n: int = 500) -> dict[str, float]:
    """
    Download inf_diario for a month, find the last date's data,
    and return top N CNPJs by PL.
    """
    log(f"Downloading inf_diario for {year_month}...")
    rows = download_csv(f"DOC/INF_DIARIO/DADOS/inf_diario_fi_{year_month}.csv")
    log(f"Parsed {len(rows):,} rows from inf_diario_{year_month}")

    # Group by CNPJ, keep latest date's PL
    fund_pl: dict[str, tuple[str, float]] = {}  # cnpj -> (date, pl)
    for row in rows:
        cnpj = (row.get("CNPJ_FUNDO") or "").strip()
        date = (row.get("DT_COMPTC") or "").strip()
        pl = parse_numeric(row.get("VL_PATRIM_LIQ", ""))

        if not cnpj or not date or pl is None:
            continue

        existing = fund_pl.get(cnpj)
        if existing is None or date > existing[0]:
            fund_pl[cnpj] = (date, pl)

    log(f"Found {len(fund_pl):,} unique funds with PL data")

    # Sort by PL descending, take top N
    sorted_funds = sorted(fund_pl.items(), key=lambda x: x[1][1], reverse=True)
    top = sorted_funds[:top_n]

    log(f"Top {len(top)} funds: PL range {top[0][1][1]/1e9:.1f}B ~ {top[-1][1][1]/1e6:.1f}M")

    return {cnpj: pl for cnpj, (_, pl) in top}


# ─── Step 2: Cross-reference with cad_fi ───

def get_catalog_metadata(cnpjs: set[str]) -> dict[str, dict]:
    """Download cad_fi and extract metadata for given CNPJs."""
    log("Downloading cad_fi.csv (fund catalog)...")
    rows = download_csv("CAD/DADOS/cad_fi.csv")
    log(f"Parsed {len(rows):,} funds from cad_fi")

    metadata = {}
    for row in rows:
        cnpj = (row.get("CNPJ_FUNDO") or "").strip()
        if cnpj in cnpjs:
            metadata[cnpj] = {
                "denom_social": (row.get("DENOM_SOCIAL") or "").strip(),
                "cd_cvm": int(row["CD_CVM"]) if row.get("CD_CVM", "").strip() else None,
                "tp_fundo": (row.get("TP_FUNDO") or "").strip() or None,
                "classe": (row.get("CLASSE") or "").strip() or None,
                "classe_anbima": (row.get("CLASSE_ANBIMA") or "").strip() or None,
                "condom": (row.get("CONDOM") or "").strip() or None,
                "fundo_cotas": (row.get("FUNDO_COTAS") or "").strip() or None,
                "fundo_exclusivo": (row.get("FUNDO_EXCLUSIVO") or "").strip() or None,
                "invest_qualif": (row.get("INVEST_QUALIF") or "").strip() or None,
                "taxa_adm": parse_numeric(row.get("TAXA_ADM", "")),
                "taxa_perfm": parse_numeric(row.get("TAXA_PERFM", "")),
                "benchmark": (row.get("BENCHMARK") or "").strip() or None,
                "cnpj_admin": (row.get("CNPJ_ADMIN") or "").strip() or None,
                "admin_nome": (row.get("ADMIN") or "").strip() or None,
                "cnpj_gestor": (row.get("CPF_CNPJ_GESTOR") or "").strip() or None,
                "gestor_nome": (row.get("GESTOR") or "").strip() or None,
                "sit": (row.get("SIT") or "").strip() or None,
                "dt_reg": parse_date(row.get("DT_REG", "")),
                "dt_const": parse_date(row.get("DT_CONST", "")),
                "dt_cancel": parse_date(row.get("DT_CANCEL", "")),
            }

    log(f"Matched {len(metadata):,}/{len(cnpjs)} CNPJs in cad_fi")
    return metadata


# ─── Step 3: Upsert into Supabase ───

def upsert_catalog(supabase, top_funds: dict[str, float], metadata: dict[str, dict]):
    """Upsert fund catalog into hub_fundos_meta."""
    log(f"Upserting {len(top_funds)} funds into hub_fundos_meta...")

    records = []
    now = datetime.utcnow().isoformat()

    for cnpj, pl in top_funds.items():
        meta = metadata.get(cnpj, {})
        record = {
            "cnpj_fundo": cnpj,
            "denom_social": meta.get("denom_social") or f"Fundo {cnpj}",
            "cd_cvm": meta.get("cd_cvm"),
            "tp_fundo": meta.get("tp_fundo"),
            "classe": meta.get("classe"),
            "classe_anbima": meta.get("classe_anbima"),
            "condom": meta.get("condom"),
            "fundo_cotas": meta.get("fundo_cotas"),
            "fundo_exclusivo": meta.get("fundo_exclusivo"),
            "invest_qualif": meta.get("invest_qualif"),
            "taxa_adm": meta.get("taxa_adm"),
            "taxa_perfm": meta.get("taxa_perfm"),
            "benchmark": meta.get("benchmark"),
            "vl_patrim_liq": pl,
            "dt_patrim_liq": datetime.utcnow().strftime("%Y-%m-%d"),
            "cnpj_admin": meta.get("cnpj_admin"),
            "admin_nome": meta.get("admin_nome"),
            "cnpj_gestor": meta.get("cnpj_gestor"),
            "gestor_nome": meta.get("gestor_nome"),
            "sit": meta.get("sit"),
            "dt_reg": meta.get("dt_reg"),
            "dt_const": meta.get("dt_const"),
            "dt_cancel": meta.get("dt_cancel"),
            "is_active": True,
            "last_fetched_at": now,
            "updated_at": now,
        }
        records.append(record)

    # Batch upsert
    for i in range(0, len(records), BATCH_SIZE):
        chunk = records[i : i + BATCH_SIZE]
        result = supabase.table("hub_fundos_meta").upsert(
            chunk, on_conflict="cnpj_fundo"
        ).execute()
        log(f"  Upserted batch {i // BATCH_SIZE + 1}: {len(chunk)} records")

    return len(records)


def upsert_daily(supabase, year_month: str, cnpjs: set[str]):
    """Download and upsert daily data for given CNPJs."""
    log(f"Downloading inf_diario for {year_month} (daily upsert)...")
    rows = download_csv(f"DOC/INF_DIARIO/DADOS/inf_diario_fi_{year_month}.csv")
    log(f"Parsed {len(rows):,} total rows")

    # Filter to our funds
    records = []
    for row in rows:
        cnpj = (row.get("CNPJ_FUNDO") or "").strip()
        if cnpj not in cnpjs:
            continue

        dt = (row.get("DT_COMPTC") or "").strip()
        if not dt:
            continue

        records.append({
            "cnpj_fundo": cnpj,
            "dt_comptc": dt,
            "vl_total": parse_numeric(row.get("VL_TOTAL", "")),
            "vl_quota": parse_numeric(row.get("VL_QUOTA", "")),
            "vl_patrim_liq": parse_numeric(row.get("VL_PATRIM_LIQ", "")),
            "captc_dia": parse_numeric(row.get("CAPTC_DIA", "")),
            "resg_dia": parse_numeric(row.get("RESG_DIA", "")),
            "nr_cotst": int(row["NR_COTST"]) if row.get("NR_COTST", "").strip() else None,
        })

    log(f"Filtered {len(records):,} rows for {len(cnpjs)} funds")

    # Batch upsert
    inserted = 0
    for i in range(0, len(records), BATCH_SIZE):
        chunk = records[i : i + BATCH_SIZE]
        supabase.table("hub_fundos_diario").upsert(
            chunk, on_conflict="cnpj_fundo,dt_comptc"
        ).execute()
        inserted += len(chunk)
        if (i // BATCH_SIZE + 1) % 10 == 0:
            log(f"  Progress: {inserted:,}/{len(records):,} rows")

    log(f"  Upserted {inserted:,} daily records for {year_month}")
    return inserted


def log_ingestion(supabase, source: str, ref_date: str, fetched: int, inserted: int, status: str, error: str = None):
    """Log ingestion to hub_cvm_ingestion_log."""
    supabase.table("hub_cvm_ingestion_log").insert({
        "source": source,
        "reference_date": ref_date,
        "records_fetched": fetched,
        "records_inserted": inserted,
        "status": status,
        "error_message": error,
        "started_at": datetime.utcnow().isoformat(),
        "finished_at": datetime.utcnow().isoformat(),
    }).execute()


def get_available_months(n_months: int = 3) -> list[str]:
    """Get list of YYYYMM strings for the last N months."""
    months = []
    now = datetime.utcnow()
    # Start from previous month (current month may be incomplete)
    for i in range(1, n_months + 1):
        dt = now - timedelta(days=30 * i)
        months.append(dt.strftime("%Y%m"))
    return sorted(months)


# ─── Main ───

def main():
    parser = argparse.ArgumentParser(description="CVM Dados Abertos Ingestion Worker")
    parser.add_argument("--top", type=int, default=500, help="Top N funds by PL (default: 500)")
    parser.add_argument("--months", type=int, default=3, help="Number of months of daily data (default: 3)")
    parser.add_argument("--catalog-only", action="store_true", help="Only update catalog, skip daily")
    parser.add_argument("--daily-only", action="store_true", help="Only update daily, skip catalog")
    parser.add_argument("--month", type=str, help="Specific month YYYYMM (overrides --months)")
    args = parser.parse_args()

    log("=" * 60)
    log("CVM Ingestion Worker — Muuney.hub")
    log(f"Config: top={args.top}, months={args.months}")
    log("=" * 60)

    supabase = get_supabase()

    # Determine which months to process
    if args.month:
        months = [args.month]
    else:
        months = get_available_months(args.months)
    log(f"Target months: {', '.join(months)}")

    # Step 1: Find top funds from the most recent month's inf_diario
    if not args.daily_only:
        log("\n── Step 1: Identify top funds from inf_diario ──")
        try:
            top_funds = get_top_funds_from_diario(months[-1], args.top)
        except Exception as e:
            log(f"Failed with latest month {months[-1]}, trying {months[-2] if len(months) > 1 else 'N/A'}")
            if len(months) > 1:
                top_funds = get_top_funds_from_diario(months[-2], args.top)
            else:
                raise

        # Step 2: Get metadata from cad_fi
        log("\n── Step 2: Cross-reference with cad_fi ──")
        cnpj_set = set(top_funds.keys())
        metadata = get_catalog_metadata(cnpj_set)

        # Step 3: Upsert catalog
        log("\n── Step 3: Upsert catalog ──")
        n_catalog = upsert_catalog(supabase, top_funds, metadata)
        log_ingestion(supabase, "cad_fi_worker", months[-1], len(top_funds), n_catalog, "success")
        log(f"✅ Catalog: {n_catalog} funds upserted")
    else:
        # Load existing CNPJs from DB
        log("Loading existing fund CNPJs from database...")
        result = supabase.table("hub_fundos_meta").select("cnpj_fundo").eq("is_active", True).execute()
        cnpj_set = {r["cnpj_fundo"] for r in result.data}
        log(f"Found {len(cnpj_set)} funds in database")

    if args.catalog_only:
        log("\n✅ Catalog-only mode. Done.")
        return

    # Step 4: Ingest daily data for each month
    log("\n── Step 4: Ingest daily data ──")
    total_daily = 0
    for ym in months:
        try:
            n = upsert_daily(supabase, ym, cnpj_set)
            log_ingestion(supabase, "inf_diario_worker", ym, 0, n, "success")
            total_daily += n
        except Exception as e:
            log(f"⚠️ Failed for {ym}: {e}")
            log_ingestion(supabase, "inf_diario_worker", ym, 0, 0, "error", str(e))

    log(f"\n{'=' * 60}")
    log(f"✅ Done! Catalog: {len(cnpj_set)} funds | Daily: {total_daily:,} records")
    log(f"{'=' * 60}")


if __name__ == "__main__":
    main()
