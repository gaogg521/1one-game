"""Run the opt-in benchmark without changing any production route."""
import shlex
from pathlib import Path
from prod_ssh import connect, deploy_repo, run_output

client = connect()
repo = deploy_repo()
try:
    sftp = client.open_sftp()
    remote = f"{repo}/scripts/qa-production-model-latency.ts"
    sftp.put(str(Path(__file__).with_name("qa-production-model-latency.ts")), remote)
    sftp.close()
    script = f"cd {shlex.quote(repo)} && set -a && source .env && set +a && QA_PRODUCTION_MODEL_LATENCY=1 npx tsx scripts/qa-production-model-latency.ts"
    code, output = run_output(client, "setsid bash -lc " + shlex.quote(script) + " </dev/null >/tmp/operone-model-latency.log 2>&1 &")
    print(output)
    if code: raise RuntimeError("Benchmark start failed")
finally:
    client.close()
