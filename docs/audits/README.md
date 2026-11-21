# Audit reports

This directory holds the **unmodified PDFs** exported by the QoreChain dashboard Contract Auditor (<https://dashboard.qorechain.io/audit>).

Expected files after the owner runs both stages:

- `stage-1.pdf` — first QCAI audit, EVM/Solidity setting.
- `stage-2.pdf` — second QCAI audit, same setting, after fixes.

Rules:

1. Do not edit, annotate, redact or regenerate a report. If a finding is a false positive, explain it in `../AUDIT.md`, not in the PDF.
2. Do not place an AI-generated review here as if it were a QCAI report.
3. If a file is missing, the project's status is "audit not yet run". Do not describe it as passed.

The mapping template and the honesty statement live in [`../AUDIT.md`](../AUDIT.md).
