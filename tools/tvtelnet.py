#!/usr/bin/env python3
"""tvtelnet.py - run a SHORT shell command on the rooted LG TV over telnet.

Designed for short invocations (e.g. "sh /tmp/x.sh") so the tty echo stays on one
line and can be stripped reliably. For anything long, upload a script with tvpush.py.

Usage:
    ./tvtelnet.py 'id; uname -a'
    ./tvtelnet.py --raw 'cat /etc/version'
"""
import sys, time, warnings
warnings.filterwarnings("ignore")
import telnetlib, re

IP = "192.168.1.100"
PORT = 23
MARK = "OC_9f3a_DONE"


def run(snippet: str, timeout: float = 60.0, raw: bool = False) -> str:
    tn = telnetlib.Telnet(IP, PORT, timeout=12)
    time.sleep(0.4)
    try:
        tn.read_very_eager()
    except Exception:
        pass

    # try to stop the pty from echoing our input back
    tn.write(b"stty -echo 2>/dev/null\n")
    time.sleep(0.35)
    try:
        tn.read_very_eager()
    except Exception:
        pass

    cmd = snippet.replace("\n", "; ")
    tn.write((cmd + "; echo " + MARK + '\n').encode())

    buf = b""
    last = time.time()
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            chunk = tn.read_very_eager()
        except EOFError:
            break
        except Exception:
            break
        if chunk:
            buf += chunk
            last = time.time()
            if MARK.encode() in buf:
                break
        else:
            if time.time() - last > 3.0:
                break
            time.sleep(0.1)

    try:
        tn.write(b"stty echo 2>/dev/null\n")
        tn.close()
    except Exception:
        pass

    txt = buf.decode("utf-8", "replace").replace("\r", "")
    if raw:
        return txt
    # everything before the marker
    idx = txt.find(MARK)
    if idx >= 0:
        txt = txt[:idx]
    lines = txt.split("\n")
    out = []
    for ln in lines:
        s = ln.strip()
        if not s:
            continue
        if s == cmd.strip():            # echoed command
            continue
        if s in ("stty -echo 2>/dev/null", "stty echo 2>/dev/null", "~ #", "#"):
            continue
        if s.endswith("~ #"):
            s = s[:-3].rstrip()
            if not s:
                continue
        out.append(ln)
    return "\n".join(out)


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--raw"]
    raw = "--raw" in sys.argv[1:]
    snip = " ".join(args) if args else sys.stdin.read().strip()
    if not snip:
        print("no command given", file=sys.stderr)
        sys.exit(2)
    print(run(snip, raw=raw))
