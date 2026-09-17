# Pi 5 / Cortex-A76 (ARMv8.2-A). MongoDB does not publish a Debian arm64 build of
# mongodb-database-tools, so we take the Ubuntu 22.04 arm64 tarball instead — its
# glibc-linked binaries run fine on Debian 12 given the same runtime libs.
FROM debian:bookworm-slim

ARG DB_TOOLS_VERSION=100.17.0

RUN apt-get update && apt-get install -y --no-install-recommends \
      wget ca-certificates curl rclone \
      libgssapi-krb5-2 libssl3 libsasl2-2 && \
    wget -q "https://fastdl.mongodb.org/tools/db/mongodb-database-tools-ubuntu2204-arm64-${DB_TOOLS_VERSION}.tgz" \
      -O /tmp/tools.tgz && \
    tar -xzf /tmp/tools.tgz -C /tmp && \
    mv /tmp/mongodb-database-tools-ubuntu2204-arm64-${DB_TOOLS_VERSION}/bin/* /usr/local/bin/ && \
    rm -rf /tmp/tools.tgz /tmp/mongodb-database-tools-ubuntu2204-arm64-${DB_TOOLS_VERSION} && \
    rm -rf /var/lib/apt/lists/*

COPY backup-to-atlas.sh /usr/local/bin/backup-to-atlas.sh
RUN chmod +x /usr/local/bin/backup-to-atlas.sh
ENTRYPOINT ["/usr/local/bin/backup-to-atlas.sh"]
