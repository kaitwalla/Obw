# Attribution and licensing

OBW is a modified/extended distribution built on top of **Functious** by ForGetFulSkyBro / forgetfulskybro:

- Upstream source: https://github.com/forgetfulskybro/Fluxer-Functious
- Upstream revision currently pinned by OBW: `5672a5bc7dc361df8e85b01e0aca515da821099d`
- Upstream license: GNU Affero General Public License v3.0

OBW adds its own source files and automatically patches a small number of upstream files during the Docker build. The build process retains the upstream Git checkout inside the image, and this public repository contains the OBW modifications and the exact patching script used to create the running version.

OBW's additions and modifications are intended to be licensed under the same GNU Affero General Public License v3.0.

This project is not an official Functious release and is not endorsed by the Functious maintainers.

## Modifications

OBW currently adds or modifies behavior for:

- managed text conversations
- private support tickets
- starboard / quote collection
- anonymous confessions
- automated Docker-based integration with Functious

For the exact transformations applied to upstream source, see `scripts/apply-obw.js`.
