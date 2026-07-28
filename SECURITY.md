# Security Policy

## Supported versions

| Version | Security updates |
| --- | --- |
| `0.1.x` | Supported |
| Older versions | Not supported |

## Report a vulnerability

Do not open a public issue for suspected vulnerabilities. Use
[GitHub private vulnerability reporting](https://github.com/tentenco/ai-website-clone/security/advisories/new)
and include:

- the affected commit or version;
- the vulnerable component or workflow stage;
- reproduction steps or a minimal proof of concept;
- likely impact and affected users;
- any suggested mitigation.

Remove credentials, client data, private URLs, and unrelated personal information
before submitting evidence.

We will acknowledge a complete report as soon as practical, investigate it,
coordinate remediation, and publish an advisory when disclosure is appropriate.
Please allow maintainers a reasonable remediation window before public disclosure.

## Security boundaries

This repository can automate browsers, inspect third-party sites, process media,
and execute generated project code. Contributors and users should:

- run untrusted targets and generated code in isolated environments;
- never commit browser profiles, cookies, secrets, or `.env` files;
- review downloaded assets and their licenses;
- keep browser, Node.js, FFmpeg, and dependencies patched;
- treat inferred source behavior as untrusted input;
- avoid capturing form values or personal data in evidence artifacts.
