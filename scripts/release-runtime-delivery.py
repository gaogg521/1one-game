"""Deploy the committed runtime delivery fix. Fail closed on build/start/health."""
import shlex
import subprocess
from prod_ssh import connect, deploy_repo, local_health_check_command

commit = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
client = connect()
try:
    script = r'''set -euo pipefail
cd REPO_PATH
python3 - <<'PY'
import json, subprocess, pathlib, datetime
changed = subprocess.check_output(['git','diff','HEAD','--name-only'], text=True).splitlines()
if set(changed) - {'package-lock.json','scripts/run-generation-worker-once.sh'}:
    raise SystemExit('Unreviewed production changes; refusing to overwrite')
def clean(value):
    if isinstance(value, dict): return {k: clean(v) for k,v in value.items() if k != 'peer'}
    if isinstance(value, list): return [clean(v) for v in value]
    return value
for name in changed:
    old = subprocess.check_output(['git','show','HEAD:'+name])
    current = pathlib.Path(name).read_bytes()
    if name == 'package-lock.json': assert clean(json.loads(old)) == clean(json.loads(current))
    else: assert old == current
if changed:
    target = pathlib.Path('/root/operone-before-runtime-delivery-'+datetime.datetime.now().strftime('%Y%m%d%H%M%S')+'.patch')
    target.write_bytes(subprocess.check_output(['git','diff','HEAD','--binary']))
    print('Backed up reviewed npm metadata/executable-bit drift:', target)
PY
git fetch origin
test "$(git rev-parse origin/main)" = RELEASE_COMMIT
trap 'if systemctl is-active --quiet operone; then systemctl start operone-generation-worker.timer; fi' EXIT
systemctl stop operone-generation-worker.timer
for slot in 2 3 4; do
  if systemctl cat operone-generation-worker-$slot.timer >/dev/null 2>&1; then systemctl stop operone-generation-worker-$slot.timer; fi
done
set -a
source .env
set +a
node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.generationJob.count({where:{status:"running",leaseExpiresAt:{gt:new Date()}}}).then(async n=>{await p.$disconnect();if(n)throw Error("active jobs: wait before deploy")})'
systemctl stop operone
git reset --hard RELEASE_COMMIT
npx prisma migrate deploy
npx prisma generate
npm run build
test -s .next/BUILD_ID
chown -R www-data:www-data .next
systemctl start operone
sleep 5
systemctl is-active --quiet operone
HEALTH_COMMAND
bash scripts/deploy/install-generation-worker-timer.sh
runuser -u www-data -- npx tsx scripts/qa-runtime-delivery-gate.ts
echo RUNTIME_DELIVERY_RELEASE_OK
'''.replace("REPO_PATH", shlex.quote(deploy_repo())).replace("RELEASE_COMMIT", shlex.quote(commit)).replace("HEALTH_COMMAND", local_health_check_command())
    command = "setsid bash -lc " + shlex.quote(script) + " </dev/null >/tmp/operone-runtime-delivery-release.log 2>&1 &"
    _, stdout, stderr = client.exec_command(command)
    if stdout.channel.recv_exit_status(): raise RuntimeError(stderr.read().decode())
    print(f"Release dispatched for {commit}; log /tmp/operone-runtime-delivery-release.log")
finally:
    client.close()
