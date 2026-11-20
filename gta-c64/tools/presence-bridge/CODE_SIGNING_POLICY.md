# Code signing policy

This policy covers the Windows releases of the Sleazeburg 64 presence bridge, published on the
[releases page](https://github.com/mselin/mselin.github.io/releases) of this repository.

## Current state

Releases are **not signed yet**. Each release publishes a `SHA256SUMS` file, and every binary can be rebuilt
byte for byte from its tag with `build.sh`; the release workflow checks that on a second machine before
publishing.

Once a signing service has accepted the project, Windows binaries will be signed as part of the release
workflow. The checksum of the unsigned build will keep being published next to the signed file, so that
anyone can still compare it with their own build.

## Team roles

| Role | Who |
|---|---|
| Author | [mselin](https://github.com/mselin) |
| Reviewer | [mselin](https://github.com/mselin) |
| Approver of each release and signing request | [mselin](https://github.com/mselin) |

Changes reach the `main` branch only through pull requests that pass the repository's automated checks.
Every account in these roles uses multi-factor authentication.

## How releases are built

Only the release workflow, running on GitHub-hosted runners from a tagged commit, builds the binaries that are
published. No binary built on a personal machine is ever uploaded.

## Privacy

The program transfers no information to any networked system other than the Discord client on the same
computer, and only when the user runs it and turns the feature on in the game. See the
[privacy page](https://mselin.github.io/gta-c64/privacy.html).
