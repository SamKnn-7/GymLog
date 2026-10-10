"""Serve GymLog locally: python serve.py, then open http://localhost:5173

Same as `python -m http.server`, but always serves the folder this file is
in, and tells the browser not to cache, so edits show up on a normal refresh.
"""
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    print(f"GymLog is running at http://localhost:{port}")
    ThreadingHTTPServer(("127.0.0.1", port), NoCacheHandler).serve_forever()
