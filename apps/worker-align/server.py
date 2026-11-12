"""worker-align: internal HTTP service running Montreal Forced Aligner (ADR 0006).

POST /align  {"utterances": [{"id": "u1", "wav_base64": "...", "text": "lời đọc"}]}
  -> {"utterances": [{"id": "u1", "words": [{"text": "lời", "startMs": 120, "endMs": 310}, ...]}], "seconds": 31.2}
GET  /health -> {"ok": true}

Python stdlib only (runs inside the MFA conda env). Not exposed outside the internal network.
"""
import base64
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
import unicodedata
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("PORT", "8090"))
JOBS = os.environ.get("MFA_JOBS", "4")
MAX_BODY = 200 * 1024 * 1024
ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFC", text).lower()
    return re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE).strip()


def align(utterances):
    work = tempfile.mkdtemp(prefix="mfa-")
    try:
        corpus = os.path.join(work, "corpus")
        out = os.path.join(work, "out")
        os.makedirs(corpus)
        for u in utterances:
            if not ID_RE.match(u["id"]):
                raise ValueError("invalid utterance id")
            with open(os.path.join(corpus, u["id"] + ".wav"), "wb") as f:
                f.write(base64.b64decode(u["wav_base64"]))
            with open(os.path.join(corpus, u["id"] + ".lab"), "w", encoding="utf-8") as f:
                f.write(normalize(u["text"]))
        cmd = [
            "mfa", "align", corpus, "vietnamese_mfa", "vietnamese_mfa", out,
            "--clean", "--single_speaker", "--output_format", "json",
            "--g2p_model_path", "vietnamese_hanoi_mfa", "-j", JOBS,
            "--temporary_directory", os.path.join(work, "tmp"),
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
        if proc.returncode != 0:
            raise RuntimeError("mfa align failed: " + proc.stderr[-800:])
        result = []
        for u in utterances:
            path = os.path.join(out, u["id"] + ".json")
            words = []
            if os.path.exists(path):
                with open(path, encoding="utf-8") as f:
                    data = json.load(f)
                for start, end, label in data["tiers"]["words"]["entries"]:
                    if label and label not in ("<eps>", "spn", "sil"):
                        words.append({"text": label, "startMs": round(start * 1000), "endMs": round(end * 1000)})
            result.append({"id": u["id"], "words": words})
        return result
    finally:
        shutil.rmtree(work, ignore_errors=True)


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._send(200, {"ok": True})
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/align":
            return self._send(404, {"error": "not found"})
        n = int(self.headers.get("content-length", "0"))
        if n <= 0 or n > MAX_BODY:
            return self._send(413, {"error": "bad size"})
        try:
            req = json.loads(self.rfile.read(n))
            t0 = time.time()
            res = align(req["utterances"])
            self._send(200, {"utterances": res, "seconds": round(time.time() - t0, 2)})
        except (ValueError, KeyError) as e:
            self._send(400, {"error": str(e)})
        except Exception as e:  # noqa: BLE001 - report to the caller, which logs it internally
            self._send(500, {"error": str(e)[-500:]})

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
