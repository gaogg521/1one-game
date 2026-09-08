"""Read-only production evidence. No credentials or user prompts are printed."""
import json
import shlex
from pathlib import Path
from prod_ssh import connect, deploy_repo, run_output, local_health_check_command

repo = deploy_repo()
client = connect()
try:
    for command in [f"cd {shlex.quote(repo)} && git rev-parse HEAD && test -s .next/BUILD_ID && cat .next/BUILD_ID", "systemctl is-active operone operone-generation-worker.timer", local_health_check_command()]:
        code, out = run_output(client, command)
        print(out)
        if code: raise RuntimeError("Production inspection failed")
    js = """const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{console.log(JSON.stringify({jobs:await p.generationJob.findMany({where:{status:{in:['running','queued','retrying']}},select:{id:true,type:true,status:true,attempts:true,maxAttempts:true,leaseExpiresAt:true}}),project:await p.project.findUnique({where:{id:'cmtrfa1rp0005tpj8kcm795a3'},select:{id:true,specJson:true}})}));await p.$disconnect()})()"""
    code, out = run_output(client, f"cd {shlex.quote(repo)} && set -a && source .env && set +a && node -e {shlex.quote(js)}")
    if code: raise RuntimeError("Read-only fixture export failed")
    data = json.loads(out)
    target = Path("qa-output/runtime-delivery")
    target.mkdir(parents=True, exist_ok=True)
    (target / "prod-before.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"jobs": data["jobs"], "fixtureSaved": bool(data["project"])}, ensure_ascii=False))
finally:
    client.close()
