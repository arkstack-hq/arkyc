# @arkyc/network

Driver-based IP intelligence for [Arkyc](https://github.com/arkstack-hq/arkyc), an
open-source, multi-tenant identity-verification platform. Resolves the country
behind an address and flags VPN, Tor, proxy and hosting networks; the active
driver (`mock` or `maxmind`) is chosen by config behind a stable result contract.

## Install

```bash
npm install @arkyc/network maxmind
```

The `maxmind` driver reads local MaxMind databases. GeoLite2 Country and ASN are
free with a MaxMind account; VPN and proxy flags need the commercial GeoIP2
Anonymous IP database. Tor exits can come from the Tor Project's bulk exit list.

Docs: <https://docs.arkyc.toneflix.net/guide/fraud-signals>
