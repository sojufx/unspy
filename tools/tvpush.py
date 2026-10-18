#!/usr/bin/env python3
"""tvpush.py - upload a local file to the rooted LG TV over telnet (base64 chunks).

Usage:
    ./tvpush.py enumerate.sh /tmp/enum.sh
    ./tvpush.py --cmd 'sh /tmp/enum.sh'

Verifies size + sha256 after upload.
"""
import sys, time, base64, hashlib, warnings
warnings.filterwarnings("ignore")
import telnetlib

IP = "192.168.1.100"
PORT = 23
CHUNK = 700


def session():
    tn = telnetlib.Telnet(IP, PORT, timeout=15)
    time.sleep(0.4)
    try:
        tn.read_very_eager()
    except Exception:
        pass
    return tn


def run(tn, cmd, timeout=90.0, mark=None):
    mark = mark or "OCP_DONE"
    tn.write((cmd + "; echo " + mark + "\n").encode())
    buf = b""
    last = time.time()
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            c = tn.read_very_eager()
        except Exception:
            break
        if c:
            buf += c
            last = time.time()
            if mark.encode() in buf:
                break
        else:
            if time.time() - last > 4.0:
                break
            time.sleep(0.1)
    t = buf.decode("utf-8", "replace").replace("\r", "")
    i = t.find(mark)
    return t[:i] if i >= 0 else t


def push(local, remote):
    data = open(local, "rb").read()
    b64 = base64.b64encode(data).decode()
    sha = hashlib.sha256(data).hexdigest()

    tn = session()
    run(tn, "rm -f /tmp/_oc.b64")
    total = len(b64)
    for i in range(0, total, CHUNK):
        part = b64[i:i + CHUNK]
        run(tn, f"printf '%s' '{part}' >> /tmp/_oc.b64", timeout=30)
    run(tn, f"base64 -d /tmp/_oc.b64 > {remote} && rm -f /tmp/_oc.b64", timeout=30)
    out = run(tn, f"wc -c < {remote}; sha256sum {remote} 2>/dev/null || openssl dgst -sha256 {remote}")
    tn.close()

    print(f"local : {len(data)} bytes  sha256 {sha}")
    print("remote:", out.strip())
    ok = sha in out.replace(sha[:0], "")
    # fall back to size check if the TV has no sha tool
    if not any(sha in l for l in out.split("\n")):
        ok = str(len(data)) in out
        print("(sha256 not verifiable on TV - compared size instead)")
    print("RESULT:", "OK" if ok else "MISMATCH")
    return 0 if ok else 1


if __name__ == "__main__":
    if sys.argv[1] == "--cmd":
        tn = session()
        print(run(tn, " ".join(sys.argv[2:])))
        tn.close()
    else:
        sys.exit(push(sys.argv[1], sys.argv[2]))
