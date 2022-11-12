FROM debian:11 AS chromium-build

WORKDIR /app

ENV PATH="${PATH}:/app/depot_tools"
ENV CCACHE_DIR=/app/.ccache
ENV GIT_CACHE_PATH=/app/.git_cache
ENV DEBIAN_FRONTEND=noninteractive
ENV CHROMIUM_BUILDTOOLS_PATH=/app/electron/src/buildtools
RUN apt-get update && \
        apt-get install -y git sudo curl ccache python3 bzip2 xz-utils && \
    curl -fsSL https://deb.nodesource.com/setup_16.x | bash - && \
    apt-get install -y nodejs && \
    git clone --depth 1 --single-branch https://chromium.googlesource.com/chromium/tools/depot_tools.git

COPY electron/.gclient electron/
COPY scripts/gclient.sh scripts/
RUN --mount=type=cache,target=/app/.git_cache scripts/gclient.sh --revision "src/electron@cb22573c3e76e09df9fbad36dc372080c04d349e"

RUN electron/src/build/install-build-deps.sh

COPY scripts/patch.sh /app/scripts/
COPY src/chromium.patch /app/src/
COPY src/skia.patch /app/src/
RUN scripts/patch.sh && ccache --max-size=0

ENV CCACHE_DIR=/app/.ccache
ENV CCACHE_CPP2=yes
ENV CCACHE_SLOPPINESS=time_macros

FROM chromium-build AS chromium-arm64

RUN electron/src/build/linux/sysroot_scripts/install-sysroot.py --arch=arm64

COPY scripts/gn.sh /app/scripts/
RUN GN_ARGS='cc_wrapper="ccache" target_cpu="arm64"' \
        scripts/gn.sh release

COPY scripts/ninja.sh /app/scripts/
RUN --mount=type=cache,target=/app/.ccache \
    --mount=type=cache,target=/app/.git_cache \
    scripts/ninja.sh release -j200

FROM chromium-build AS chromium-amd64

RUN electron/src/build/linux/sysroot_scripts/install-sysroot.py --arch=amd64

COPY scripts/gn.sh /app/scripts/
RUN GN_ARGS='cc_wrapper="ccache"' \
        scripts/gn.sh release

COPY scripts/ninja.sh /app/scripts/
RUN --mount=type=cache,target=/app/.ccache \
    --mount=type=cache,target=/app/.git_cache \
    scripts/ninja.sh release -j200


FROM debian:11 

COPY --from=chromium-arm64 /app/electron/src/out /app/electron/src/out
COPY --from=chromium-amd64 /app/electron/src/out /app/electron/src/out
