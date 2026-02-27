# Build stage
FROM rust:1.83-slim AS builder

WORKDIR /app

# Copy workspace files
COPY Cargo.toml Cargo.lock ./
COPY shared/ shared/
COPY server/ server/

# Create a dummy client member to satisfy workspace resolver
# (root Cargo.toml lists client/src-tauri as a workspace member)
RUN mkdir -p client/src-tauri/src && \
    printf '[package]\nname = "gotion-client"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n' > client/src-tauri/Cargo.toml && \
    echo 'fn main() {}' > client/src-tauri/src/main.rs

# Build server in release mode
RUN cargo build --release -p gotion-server

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/gotion-server /usr/local/bin/gotion-server

ENV RUST_LOG=info

EXPOSE 3001

CMD ["gotion-server"]
