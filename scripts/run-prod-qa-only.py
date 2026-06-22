#!/usr/bin/env python3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, deploy_app_port, deploy_repo, run_output

REPO_ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    repo = deploy_repo()
    port = deploy_app_port()
    client = connect()
    sftp = client.open_sftp()
    sftp.put(str(REPO_ROOT / "scripts/qa-username-auth.ts"), f"{repo}/scripts/qa-username-auth.ts")
    sftp.close()
    cmd = (
        f"cd {repo} && AUTH_TEST_BASE_URL=http://127.0.0.1:{port} runuser -u www-data -- bash -lc "
        f"'export PATH=/usr/local/bin:/usr/bin:$PATH; npx tsx scripts/qa-username-auth.ts'"
    )
    _, out = run_output(client, cmd, timeout=120)
    print(out)
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
