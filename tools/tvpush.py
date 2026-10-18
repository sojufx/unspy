#!/usr/bin/env python3
"""tvpush.py - copy files to a rooted LG webOS TV over its root shell.

Rooted webOS TVs (dejavuln / Homebrew Channel) give you a *telnet* root shell,
not SSH, and macOS no longer ships a telnet client - so this is a tiny,
stdlib-only replacement for scp. Nothing to install.

Usage:
    ./tvpush.py scripts/install.sh /tmp/install.sh     # one file
    ./tvpush.py -r scripts /tmp/unspy                  # a whole directory
    ./tvpush.py --cmd 'sh /tmp/unspy/scripts/install.sh'
    ./tvpush.py --cmd 'uname -a'

Set the TV's address once:
    export TV_IP=192.168.1.100

How it works: the payload is base64'd and written to the TV in small chunks
(the shell drops a line if you paste something enormous), then decoded. Size
and, where the firmware has a hashing tool, sha256 are compared after upload.
"""
import sys, os, re, time, random, base64, hashlib, tarfile, tempfile, warnings

warnings.filterwarnings("ignore")
import telnetlib

IP = os.environ.get("TV_IP", "192.168.1.100")   # export TV_IP=<your-tv>
PORT = int(os.environ.get("TV_TELNET_PORT", "23"))
CHUNK = 700


def session():
    tn = telnetlib.Telnet(IP, PORT, timeout=15)
    time.sleep(0.4)
    try:
        tn.read_very_eager()
    except Exception:
        pass
    # ask the pty to stop echoing our input; if it refuses, run() filters the
    # echo out, but a quiet session makes the output readable
    tn.write(b"stty -echo 2>/dev/null\n")
    time.sleep(0.35)
    try:
        tn.read_very_eager()
    except Exception:
        pass
    return tn


def run(tn, cmd, timeout=90.0):
    """Run cmd and return what it printed.

    The completion sentinel is randomised AND emitted with its two halves
    written separately, so the command *text* never contains the marker. That
    matters: the TV's shell echoes our input back, so a literal `echo MARK`
    would match the echo instantly and return the previous command's output.
    """
    tok = "%06x" % random.getrandbits(24)
    mark = "OC_%s_DONE" % tok
    tn.write(("%s; printf 'OC_%%s_DONE' %s\n" % (cmd, tok)).encode())

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
    if i >= 0:
        t = t[:i]
    # drop the echoed command line / sentinel emitter if echoing was on
    out = [ln for ln in t.split("\n")
           if "printf 'OC_%s_DONE'" not in ln and ln.strip() != cmd.strip()]
    return "\n".join(out).strip("\n")


def remote_digest(tn, remote):
    """Return (size, sha256-or-None) for a file on the TV."""
    out = run(tn, "wc -c < %s; { sha256sum %s || openssl dgst -sha256 %s; } 2>/dev/null"
                  % (remote, remote, remote))
    size = None
    digest = None
    for line in out.splitlines():
        line = line.strip()
        if size is None and line.isdigit():
            size = int(line)
        m = re.search(r"\b([0-9a-f]{64})\b", line)
        if m:
            digest = m.group(1)
    return size, digest


def upload(tn, local_bytes, remote):
    """Write bytes to the TV's filesystem over the telnet shell."""
    b64 = base64.b64encode(local_bytes).decode()
    run(tn, "rm -f /tmp/_oc.b64", timeout=20)
    for i in range(0, len(b64), CHUNK):
        run(tn, "printf '%s' '%s' >> /tmp/_oc.b64" % ("%s", b64[i:i + CHUNK]), timeout=30)
    run(tn, "base64 -d /tmp/_oc.b64 > %s && rm -f /tmp/_oc.b64" % remote, timeout=30)


def report(name, local_bytes, size, digest):
    lsha = hashlib.sha256(local_bytes).hexdigest()
    print("  local : %d bytes  sha256 %s" % (len(local_bytes), lsha))
    print("  remote: %s bytes%s" % (size if size is not None else "?",
                                    "  sha256 " + digest if digest else ""))
    if digest:
        ok = digest == lsha
        print("  RESULT: %s (sha256)" % ("OK - byte-identical" if ok else "MISMATCH"))
        return ok
    if size is not None:
        ok = size == len(local_bytes)
        print("  RESULT: %s (size only - this firmware has no sha256 tool)"
              % ("OK - same length" if ok else "MISMATCH"))
        return ok
    print("  RESULT: UNVERIFIED - could not read the file back (is the TV reachable?)")
    return False


def push_file(tn, local, remote):
    data = open(local, "rb").read()
    print("push %s -> %s" % (local, remote))
    upload(tn, data, remote)
    size, digest = remote_digest(tn, remote)
    return report(local, data, size, digest)


def push_dir(tn, local_dir, remote_dir):
    """Tar the directory locally (with tarfile, so no macOS xattr junk) and unpack on the TV."""
    local_dir = local_dir.rstrip("/")
    arcname = os.path.basename(local_dir) or "root"
    tmp = tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False)
    tmp.close()
    try:
        with tarfile.open(tmp.name, "w:gz") as tf:
            for entry in sorted(os.listdir(local_dir)):
                tf.add(os.path.join(local_dir, entry), arcname=os.path.join(arcname, entry))
        data = open(tmp.name, "rb").read()
    finally:
        os.unlink(tmp.name)

    print("push %s/ -> %s/%s (%d files packed)" % (local_dir, remote_dir, arcname,
                                                   len(os.listdir(local_dir))))
    remote_tar = "/tmp/_oc_push.tar.gz"
    upload(tn, data, remote_tar)
    size, digest = remote_digest(tn, remote_tar)
    ok = report("tarball", data, size, digest)
    if not ok and size is not None and size != len(data):
        return False
    out = run(tn, "mkdir -p %s && tar xzf %s -C %s && rm -f %s && ls %s/%s"
                  % (remote_dir, remote_tar, remote_dir, remote_tar, remote_dir, arcname),
              timeout=60)
    print("  unpacked: %s" % " ".join(out.split()))
    return True


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    mode = sys.argv[1]
    tn = session()
    try:
        if mode == "--cmd":
            print(run(tn, " ".join(sys.argv[2:])))
            sys.exit(0)
        if mode == "-r":
            if len(sys.argv) != 4:
                print(__doc__)
                sys.exit(2)
            sys.exit(0 if push_dir(tn, sys.argv[2], sys.argv[3]) else 1)
        if len(sys.argv) != 3:
            print(__doc__)
            sys.exit(2)
        sys.exit(0 if push_file(tn, sys.argv[1], sys.argv[2]) else 1)
    finally:
        tn.close()
