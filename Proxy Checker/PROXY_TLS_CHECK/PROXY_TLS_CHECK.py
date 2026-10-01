#!/usr/bin/env python3
"""Probe a single host:port and determine which proxy protocol variants it accepts.

The script tests these transports on the same endpoint:
- Plain HTTP proxy over TCP.
- HTTP proxy over TLS (often referred to as HTTPS proxy).
- SOCKS5 with username/password authentication.

Classification rules:
- HTTP_ONLY: plain HTTP works, TLS-wrapped HTTP does not.
- HTTP_PLUS_TLS: both plain HTTP and TLS-wrapped HTTP work on the same port.
- HTTPS_ONLY: only TLS-wrapped HTTP works.
- SOCKS5_ONLY: only SOCKS5 works.
- MIXED_WITH_SOCKS5: at least one HTTP mode and SOCKS5 work on the same port.
- UNKNOWN: none of the tested protocols completed successfully.

The script does not try to hide protocol mismatches. It reports transport errors,
first response bytes, TLS handshake details, HTTP status lines, and SOCKS5 replies
so you can see exactly how the endpoint behaves.
"""

from __future__ import annotations

import argparse
import base64
import json
import socket
import ssl
import struct
import sys
import time
from dataclasses import asdict, dataclass, field
from typing import Optional


DEFAULT_TARGET_HOST = "example.com"
DEFAULT_TARGET_PORT = 443
DEFAULT_TIMEOUT = 8.0
DEFAULT_READ_LIMIT = 8192


@dataclass
class ProbeResult:
    """Store the outcome of one protocol probe.

    Attributes:
        name: Probe name shown in the final report.
        ok: True when the protocol completed a meaningful success path.
        protocol_detected: True when the endpoint clearly spoke the expected protocol,
            even if the final request was rejected by policy or credentials.
        transport: Transport label used for the probe.
        latency_ms: Elapsed time for the probe in milliseconds.
        error: Final error string when the probe failed.
        details: Structured details collected during the probe.
    """

    name: str
    ok: bool = False
    protocol_detected: bool = False
    transport: str = ""
    latency_ms: float = 0.0
    error: Optional[str] = None
    details: dict = field(default_factory=dict)


@dataclass
class Classification:
    """Summarize the endpoint behavior across all probes."""

    label: str
    http_plain_ok: bool
    http_tls_ok: bool
    socks5_ok: bool
    notes: list[str] = field(default_factory=list)


class ProxyProbe:
    """Run protocol probes against a single endpoint.

    The class uses raw sockets instead of higher-level HTTP client libraries so the
    output reflects the endpoint protocol directly: TCP reply bytes, TLS handshake,
    HTTP status line, and SOCKS5 negotiation frames.
    """

    def __init__(
            self,
            host: str,
            port: int,
            username: str,
            password: str,
            target_host: str,
            target_port: int,
            timeout: float,
            read_limit: int,
    ) -> None:
        """Initialize probe settings for one endpoint."""
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.target_host = target_host
        self.target_port = target_port
        self.timeout = timeout
        self.read_limit = read_limit

    def run(self) -> dict:
        """Execute all probes and return a structured report."""
        plain_http = self.probe_http_plain()
        tls_http = self.probe_http_tls()
        socks5 = self.probe_socks5()
        classification = self.classify(plain_http, tls_http, socks5)

        return {
            "endpoint": {
                "host": self.host,
                "port": self.port,
                "username": self.username,
                "password_length": len(self.password),
            },
            "target": {
                "host": self.target_host,
                "port": self.target_port,
            },
            "classification": asdict(classification),
            "probes": {
                "http_plain": asdict(plain_http),
                "http_tls": asdict(tls_http),
                "socks5": asdict(socks5),
            },
        }

    def probe_http_plain(self) -> ProbeResult:
        """Probe plain HTTP proxy on a raw TCP socket.

        The probe sends an authenticated CONNECT request and inspects the first
        response line. A valid HTTP status line marks the protocol as detected.
        A 2xx response marks the probe as successful.
        """
        result = ProbeResult(name="http_plain", transport="tcp")
        started = time.perf_counter()
        sock: Optional[socket.socket] = None

        try:
            sock = self._open_tcp_socket()
            request = self._build_connect_request()
            sock.sendall(request)
            raw = self._recv_http_response(sock)

            result.details["request_preview"] = request.decode("iso-8859-1", errors="replace")
            result.details["raw_response_preview"] = self._safe_bytes(raw)

            parsed = self._parse_http_response(raw)
            result.details.update(parsed)
            result.protocol_detected = parsed["is_http_response"]
            result.ok = parsed["is_http_response"] and parsed["status_code"] is not None and 200 <= parsed["status_code"] < 300

            if not result.protocol_detected:
                result.error = "endpoint did not return an HTTP response"
            elif not result.ok:
                result.error = f"HTTP proxy responded with status {parsed['status_code']}"
        except Exception as exc:
            result.error = f"{type(exc).__name__}: {exc}"
        finally:
            if sock is not None:
                self._close_quietly(sock)
            result.latency_ms = self._elapsed_ms(started)

        return result

    def probe_http_tls(self) -> ProbeResult:
        """Probe HTTP proxy over TLS.

        The probe first establishes a TLS session to the endpoint. After the
        handshake completes it sends the same authenticated CONNECT request and
        parses the HTTP response.
        """
        result = ProbeResult(name="http_tls", transport="tls")
        started = time.perf_counter()
        raw_sock: Optional[socket.socket] = None
        tls_sock: Optional[ssl.SSLSocket] = None

        try:
            raw_sock = self._open_tcp_socket()
            context = self._build_tls_context()
            server_hostname = None if self._looks_like_ip(self.host) else self.host
            tls_sock = context.wrap_socket(raw_sock, server_hostname=server_hostname)
            tls_sock.settimeout(self.timeout)

            result.details["tls"] = {
                "server_hostname": server_hostname,
                "version": tls_sock.version(),
                "cipher": tls_sock.cipher(),
            }

            request = self._build_connect_request()
            tls_sock.sendall(request)
            raw = self._recv_http_response(tls_sock)

            result.details["request_preview"] = request.decode("iso-8859-1", errors="replace")
            result.details["raw_response_preview"] = self._safe_bytes(raw)

            parsed = self._parse_http_response(raw)
            result.details.update(parsed)
            result.protocol_detected = parsed["is_http_response"]
            result.ok = parsed["is_http_response"] and parsed["status_code"] is not None and 200 <= parsed["status_code"] < 300

            if not result.protocol_detected:
                result.error = "TLS handshake succeeded, but endpoint did not return an HTTP response"
            elif not result.ok:
                result.error = f"TLS HTTP proxy responded with status {parsed['status_code']}"
        except ssl.SSLError as exc:
            result.error = f"SSLError: {exc}"
        except Exception as exc:
            result.error = f"{type(exc).__name__}: {exc}"
        finally:
            if tls_sock is not None:
                self._close_quietly(tls_sock)
                raw_sock = None
            if raw_sock is not None:
                self._close_quietly(raw_sock)
            result.latency_ms = self._elapsed_ms(started)

        return result

    def probe_socks5(self) -> ProbeResult:
        """Probe SOCKS5 with username/password authentication.

        The probe performs the SOCKS5 greeting, username/password sub-negotiation,
        and a CONNECT request to the configured target. A successful CONNECT reply
        marks the probe as successful.
        """
        result = ProbeResult(name="socks5", transport="tcp")
        started = time.perf_counter()
        sock: Optional[socket.socket] = None

        try:
            sock = self._open_tcp_socket()

            greeting = b"\x05\x01\x02"
            sock.sendall(greeting)
            method_reply = self._recv_exact(sock, 2)
            result.details["greeting_reply_hex"] = method_reply.hex()

            if len(method_reply) != 2 or method_reply[0] != 0x05:
                result.error = "endpoint did not return a SOCKS5 greeting reply"
                return result

            result.protocol_detected = True
            selected_method = method_reply[1]
            result.details["selected_method"] = selected_method

            if selected_method == 0xFF:
                result.error = "SOCKS5 endpoint rejected all authentication methods"
                return result

            if selected_method != 0x02:
                result.error = f"SOCKS5 endpoint selected unsupported auth method 0x{selected_method:02x}"
                return result

            auth_packet = self._build_socks5_auth_packet()
            sock.sendall(auth_packet)
            auth_reply = self._recv_exact(sock, 2)
            result.details["auth_reply_hex"] = auth_reply.hex()

            if len(auth_reply) != 2 or auth_reply[0] != 0x01:
                result.error = "endpoint did not return a SOCKS5 auth reply"
                return result

            if auth_reply[1] != 0x00:
                result.error = f"SOCKS5 username/password auth failed with code 0x{auth_reply[1]:02x}"
                return result

            connect_packet = self._build_socks5_connect_packet()
            sock.sendall(connect_packet)

            connect_head = self._recv_exact(sock, 4)
            result.details["connect_reply_head_hex"] = connect_head.hex()

            if len(connect_head) != 4 or connect_head[0] != 0x05:
                result.error = "endpoint did not return a SOCKS5 connect reply"
                return result

            reply_code = connect_head[1]
            atyp = connect_head[3]
            bound_addr = self._recv_socks5_bound_addr(sock, atyp)
            bound_port = self._recv_exact(sock, 2)

            result.details["reply_code"] = reply_code
            result.details["bound_addr_hex"] = bound_addr.hex()
            result.details["bound_port"] = struct.unpack("!H", bound_port)[0]

            result.ok = reply_code == 0x00
            if not result.ok:
                result.error = f"SOCKS5 CONNECT failed with code 0x{reply_code:02x}"
        except Exception as exc:
            result.error = f"{type(exc).__name__}: {exc}"
        finally:
            if sock is not None:
                self._close_quietly(sock)
            result.latency_ms = self._elapsed_ms(started)

        return result

    def classify(
            self,
            plain_http: ProbeResult,
            tls_http: ProbeResult,
            socks5: ProbeResult,
    ) -> Classification:
        """Map probe outcomes to a compact endpoint classification."""
        http_plain_ok = plain_http.ok
        http_tls_ok = tls_http.ok
        socks5_ok = socks5.ok
        notes: list[str] = []

        if http_plain_ok and http_tls_ok and socks5_ok:
            label = "MIXED_WITH_SOCKS5"
            notes.append("Plain HTTP proxy, HTTP over TLS, and SOCKS5 all completed successfully.")
        elif http_plain_ok and http_tls_ok:
            label = "HTTP_PLUS_TLS"
            notes.append("The same port accepted plain HTTP proxy and HTTP proxy over TLS.")
        elif http_plain_ok and not http_tls_ok and not socks5_ok:
            label = "HTTP_ONLY"
            notes.append("The endpoint accepted only plain HTTP proxy on this port.")
        elif http_tls_ok and not http_plain_ok and not socks5_ok:
            label = "HTTPS_ONLY"
            notes.append("The endpoint accepted only HTTP proxy over TLS on this port.")
        elif socks5_ok and not http_plain_ok and not http_tls_ok:
            label = "SOCKS5_ONLY"
            notes.append("The endpoint accepted only SOCKS5 on this port.")
        elif socks5_ok and (http_plain_ok or http_tls_ok):
            label = "MIXED_WITH_SOCKS5"
            notes.append("The endpoint accepted SOCKS5 and at least one HTTP proxy mode on the same port.")
        else:
            label = "UNKNOWN"
            notes.append("None of the tested protocols completed successfully.")

        if plain_http.protocol_detected and not plain_http.ok:
            notes.append("Plain HTTP probe reached an HTTP-speaking endpoint, but CONNECT did not succeed.")
        if tls_http.protocol_detected and not tls_http.ok:
            notes.append("TLS HTTP probe completed the TLS handshake and reached an HTTP-speaking endpoint, but CONNECT did not succeed.")
        if socks5.protocol_detected and not socks5.ok:
            notes.append("SOCKS5 probe reached a SOCKS5-speaking endpoint, but authentication or CONNECT did not succeed.")

        return Classification(
            label=label,
            http_plain_ok=http_plain_ok,
            http_tls_ok=http_tls_ok,
            socks5_ok=socks5_ok,
            notes=notes,
        )

    def _open_tcp_socket(self) -> socket.socket:
        """Open a TCP connection to the configured endpoint."""
        sock = socket.create_connection((self.host, self.port), timeout=self.timeout)
        sock.settimeout(self.timeout)
        return sock

    def _build_tls_context(self) -> ssl.SSLContext:
        """Create a TLS context for protocol detection.

        Certificate validation is disabled so the probe can distinguish
        transport/protocol mismatches from certificate trust issues.
        """
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        return context

    def _build_connect_request(self) -> bytes:
        """Build an authenticated HTTP CONNECT request."""
        token = base64.b64encode(f"{self.username}:{self.password}".encode("utf-8")).decode("ascii")
        lines = [
            f"CONNECT {self.target_host}:{self.target_port} HTTP/1.1",
            f"Host: {self.target_host}:{self.target_port}",
            f"Proxy-Authorization: Basic {token}",
            "Proxy-Connection: Keep-Alive",
            "User-Agent: proxy-probe/1.0",
            "",
            "",
        ]
        return "\r\n".join(lines).encode("iso-8859-1")

    def _recv_http_response(self, sock: socket.socket | ssl.SSLSocket) -> bytes:
        """Read an HTTP response head from the socket."""
        chunks = bytearray()
        while len(chunks) < self.read_limit:
            data = sock.recv(4096)
            if not data:
                break
            chunks.extend(data)
            if b"\r\n\r\n" in chunks:
                break
        return bytes(chunks)

    def _parse_http_response(self, raw: bytes) -> dict:
        """Parse the HTTP status line and headers from a raw response buffer."""
        if not raw:
            return {
                "is_http_response": False,
                "status_line": None,
                "status_code": None,
                "headers": {},
            }

        text = raw.decode("iso-8859-1", errors="replace")
        head = text.split("\r\n\r\n", 1)[0]
        lines = head.split("\r\n")
        status_line = lines[0] if lines else ""
        is_http = status_line.startswith("HTTP/")
        status_code = None

        if is_http:
            parts = status_line.split(" ", 2)
            if len(parts) >= 2 and parts[1].isdigit():
                status_code = int(parts[1])

        headers = {}
        for line in lines[1:]:
            if ":" not in line:
                continue
            name, value = line.split(":", 1)
            headers[name.strip()] = value.strip()

        return {
            "is_http_response": is_http,
            "status_line": status_line or None,
            "status_code": status_code,
            "headers": headers,
        }

    def _build_socks5_auth_packet(self) -> bytes:
        """Build the SOCKS5 username/password authentication packet."""
        user_bytes = self.username.encode("utf-8")
        pass_bytes = self.password.encode("utf-8")
        if len(user_bytes) > 255 or len(pass_bytes) > 255:
            raise ValueError("SOCKS5 username/password length must be <= 255 bytes")
        return b"\x01" + bytes([len(user_bytes)]) + user_bytes + bytes([len(pass_bytes)]) + pass_bytes

    def _build_socks5_connect_packet(self) -> bytes:
        """Build a SOCKS5 CONNECT packet using a domain target."""
        host_bytes = self.target_host.encode("idna")
        if len(host_bytes) > 255:
            raise ValueError("SOCKS5 target host length must be <= 255 bytes")
        return b"\x05\x01\x00\x03" + bytes([len(host_bytes)]) + host_bytes + struct.pack("!H", self.target_port)

    def _recv_socks5_bound_addr(self, sock: socket.socket, atyp: int) -> bytes:
        """Read the bound-address portion of a SOCKS5 CONNECT reply."""
        if atyp == 0x01:
            return self._recv_exact(sock, 4)
        if atyp == 0x03:
            length = self._recv_exact(sock, 1)[0]
            return self._recv_exact(sock, length)
        if atyp == 0x04:
            return self._recv_exact(sock, 16)
        raise ValueError(f"Unsupported SOCKS5 address type 0x{atyp:02x}")

    def _recv_exact(self, sock: socket.socket, size: int) -> bytes:
        """Read exactly the requested number of bytes or fail."""
        data = bytearray()
        while len(data) < size:
            chunk = sock.recv(size - len(data))
            if not chunk:
                raise ConnectionError(f"expected {size} bytes, received {len(data)} bytes before EOF")
            data.extend(chunk)
        return bytes(data)

    def _close_quietly(self, sock: socket.socket | ssl.SSLSocket) -> None:
        """Close a socket and ignore close-time errors."""
        try:
            sock.close()
        except Exception:
            pass

    def _elapsed_ms(self, started: float) -> float:
        """Convert a monotonic start timestamp to elapsed milliseconds."""
        return round((time.perf_counter() - started) * 1000.0, 2)

    def _safe_bytes(self, data: bytes, limit: int = 256) -> str:
        """Convert a byte buffer to a printable preview string."""
        return data[:limit].decode("iso-8859-1", errors="replace")

    def _looks_like_ip(self, value: str) -> bool:
        """Return True when the value parses as IPv4 or IPv6."""
        for family in (socket.AF_INET, socket.AF_INET6):
            try:
                socket.inet_pton(family, value)
                return True
            except OSError:
                continue
        return False


def build_arg_parser() -> argparse.ArgumentParser:
    """Create the CLI argument parser.

    The proxy endpoint and credentials are required explicit inputs so the script
    can be published or shared without embedded secrets.
    """
    parser = argparse.ArgumentParser(description="Probe a proxy endpoint and classify supported protocols.")
    parser.add_argument("--host", required=True, help="Proxy host or IP address.")
    parser.add_argument("--port", type=int, required=True, help="Proxy port.")
    parser.add_argument("--username", required=True, help="Proxy username.")
    parser.add_argument("--password", required=True, help="Proxy password.")
    parser.add_argument("--target-host", default=DEFAULT_TARGET_HOST, help="Destination host used for CONNECT tests.")
    parser.add_argument("--target-port", type=int, default=DEFAULT_TARGET_PORT, help="Destination port used for CONNECT tests.")
    parser.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT, help="Socket timeout in seconds.")
    parser.add_argument("--read-limit", type=int, default=DEFAULT_READ_LIMIT, help="Maximum number of response bytes to read per HTTP probe.")
    parser.add_argument("--pretty", action="store_true", help="Print formatted JSON.")
    return parser


def main() -> int:
    """Parse arguments, run probes, and print the report."""
    parser = build_arg_parser()
    args = parser.parse_args()

    probe = ProxyProbe(
        host=args.host,
        port=args.port,
        username=args.username,
        password=args.password,
        target_host=args.target_host,
        target_port=args.target_port,
        timeout=args.timeout,
        read_limit=args.read_limit,
    )

    report = probe.run()
    if args.pretty:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print(json.dumps(report, ensure_ascii=False))

    return 0


if __name__ == "__main__":
    sys.exit(main())
