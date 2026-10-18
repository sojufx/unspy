#!/usr/bin/env python3
"""tvtelnet.py - run a SHORT shell command on the rooted LG TV over telnet.

Designed for short invocations (e.g. "sh /tmp/x.sh") so the tty echo stays on one
line and can be stripped reliably. For anything long, upload a script with tvpush.py.

Usage:
    export TV_IP=192.168.1.100
    ./tvtelnet.py 'id; uname -a'
    ./tvtelnet.py --raw 'cat /etc/version'

Why this exists: a rooted webOS TV gives you a telnet root shell, not SSH, and
macOS no longer ships a telnet client. Nothing to install - this is stdlib only.

Python 3.13 removed the `telnetlib` module, so this carries a small fallback
client. Both paths are exercised by the test in the repo's docs.
"""
import sys, os, time, random, re, socket, warnings

warnings.filterwarnings("ignore")

try:                        # removed from the stdlib in Python 3.13
    import telnetlib
except ImportError:
    telnetlib = None

IP = os.environ.get("TV_IP", "192.168.1.100")   # export TV_IP=<your-tv>
PORT = int(os.environ.get("TV_TELNET_PORT", "23"))
FORCE_RAW = os.environ.get("TV_RAW_TELNET") == "1"


class RawTelnet:
    """Just enough telnet for a pty: negotiate nothing, strip the IAC escapes.

    Used on Python 3.13+, where telnetlib no longer exists.
    """

    IAC, DONT, DO, WONT, WILL, SB, SE = 255, 254, 253, 252, 251, 250, 240

    def __init__(self, host, port, timeout=15.0):
        self.sock = socket.create_connection((host, port), timeout)
        self.sock.settimeout(0.25)

    def write(self, data):
        self.sock.sendall(data)

    def _negotiate(self, data):
        out = bytearray()
        i, n = 0, len(data)
        while i < n:
            b = data[i]
            if b != self.IAC:
                out.append(b)
                i += 1
                continue
            if i + 1 >= n:
                break
            cmd = data[i + 1]
            if cmd in (self.DO, self.DONT, self.WILL, self.WONT):
                if i + 2 >= n:
                    break
                opt = data[i + 2]
                # we want no options: refuse anything asked of us, and decline
                # anything offered
                reply = {self.DO: self.WONT, self.WILL: self.DONT}.get(cmd)
                if reply is not None:
                    try:
                        self.sock.sendall(bytes([self.IAC, reply, opt]))
                    except OSError:
                        pass
                i += 3
            elif cmd == self.IAC:                    # escaped 0xFF
                out.append(self.IAC)
                i += 2
            elif cmd == self.SB:                     # subnegotiation, skip it
                j = data.find(bytes([self.IAC, self.SE]), i + 2)
                i = n if j < 0 else j + 2
            else:
                i += 2
        return bytes(out)

    def read_very_eager(self):
        data = b""
        try:
            while len(data) < 262144:
                chunk = self.sock.recv(4096)
                if not chunk:
                    raise EOFError
                data += chunk
        except socket.timeout:
            pass
        except OSError:
            pass
        return self._negotiate(data)

    def close(self):
        try:
            self.sock.close()
        except OSError:
            pass


def connect(timeout=15.0):
    """Open a session, or exit with a message a human can act on."""
    raw = RawTelnet if (telnetlib is None or FORCE_RAW) else telnetlib.Telnet
    try:
        tn = (raw(IP, PORT, timeout) if raw is RawTelnet
              else raw(IP, PORT, timeout=timeout))
    except OSError as e:
        sys.exit("cannot reach %s:%s over telnet (%s).\n"
                 "Set TV_IP to your TV's address and try again, for example:\n"
                 "    export TV_IP=192.168.1.100\n"
                 "Is the TV on, rooted, and on the same network?" % (IP, PORT, e))
    time.sleep(0.4)
    try:
        tn.read_very_eager()
    except Exception:
        pass
    return tn


def run(snippet: str, timeout: float = 60.0, raw: bool = False) -> str:
    tn = connect()
    # try to stop the pty from echoing our input back
    tn.write(b"stty -echo 2>/dev/null\n")
    time.sleep(0.35)
    try:
        tn.read_very_eager()
    except Exception:
        pass

    cmd = snippet.replace("\n", "; ")
    # The completion marker is randomised and emitted with its two halves
    # written separately, so the command text we send can never contain it.
    # Otherwise, when the pty does echo (stty -echo is best-effort), the echo of
    # the marker would match instantly and we would return the previous
    # command's output instead.
    tok = "%06x" % random.getrandbits(24)
    mark = "OC_%s_DONE" % tok
    tn.write(("%s; printf 'OC_%%s_DONE' %s\n" % (cmd, tok)).encode())

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
            if mark.encode() in buf:
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
    idx = txt.find(mark)
    if idx >= 0:
        txt = txt[:idx]
    lines = txt.split("\n")
    out = []
    for ln in lines:
        s = ln.strip()
        if not s:
            continue
        if s == cmd.strip():             # echoed command
            continue
        if "printf 'OC_%s_DONE'" in s:   # echoed marker emitter
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
    if "-h" in sys.argv[1:] or "--help" in sys.argv[1:]:
        print(__doc__)
        sys.exit(0)
    args = [a for a in sys.argv[1:] if a != "--raw"]
    raw = "--raw" in sys.argv[1:]
    snip = " ".join(args) if args else sys.stdin.read().strip()
    if not snip:
        print("no command given", file=sys.stderr)
        sys.exit(2)
    print(run(snip, raw=raw))
