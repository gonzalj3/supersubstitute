"""Run the local demo service. Keys stay in ignored files and never enter arguments."""
import os
import secrets
from pathlib import Path
from dotenv import dotenv_values
import uvicorn

root = Path(__file__).resolve().parent.parent
values = {k: v for k, v in dotenv_values(root / ".dev.vars").items() if v}
os.environ.update(values)
if values.get("PARASAIL_PREP_MODEL"):
    os.environ["PARASAIL_MODEL"] = values["PARASAIL_PREP_MODEL"]
secret_file = root / ".tools" / "orchestrator-secret"
secret_file.parent.mkdir(exist_ok=True)
if not secret_file.exists():
    secret_file.write_text(secrets.token_urlsafe(32))
secret_file.chmod(0o600)
os.environ["ORCHESTRATOR_SECRET"] = secret_file.read_text().strip()
os.environ["OTEL_SDK_DISABLED"] = "true"
os.environ["CREWAI_TELEMETRY_ENABLED"] = "false"
os.environ["CREWAI_DISABLE_TELEMETRY"] = "true"
uvicorn.run("app:app", host="127.0.0.1", port=8000, log_level="warning")
