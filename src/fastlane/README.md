fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios check_app

```sh
[bundle exec] fastlane ios check_app
```

Check bundle ID and app record

### ios setup_certs

```sh
[bundle exec] fastlane ios setup_certs
```

Setup certificates and profiles (readonly)

### ios sync_certs

```sh
[bundle exec] fastlane ios sync_certs
```

Create/sync certificates and profiles (writes to match repo)

### ios next_build_number

```sh
[bundle exec] fastlane ios next_build_number
```

Query TestFlight for the next build number (latest + 1)

### ios build

```sh
[bundle exec] fastlane ios build
```

Archive iOS app (App Store signing)

### ios beta

```sh
[bundle exec] fastlane ios beta
```

Build and upload to TestFlight

### ios upload

```sh
[bundle exec] fastlane ios upload
```

Upload an already-built ipa to TestFlight (after a --skip-upload build)

----


## Android

### android next_version_code

```sh
[bundle exec] fastlane android next_version_code
```

Query Play for the next version code (max across tracks + 1)

### android build

```sh
[bundle exec] fastlane android build
```

Build release AAB

### android beta

```sh
[bundle exec] fastlane android beta
```

Build and upload to Play Console

### android upload

```sh
[bundle exec] fastlane android upload
```

Upload an already-built aab to Play Console (after a --skip-upload build)

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
