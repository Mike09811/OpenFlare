FROM golang:1.25-alpine AS builder

WORKDIR /build

COPY go.mod go.sum ./
# Note: In a real monorepo build, openflare and openflare_server need to be available. 
# For now, we assume this is built from the root of the project where both are present.
COPY openflare_server /openflare_server
COPY openflare_relay /openflare_relay

WORKDIR /openflare_relay
RUN go build -o openflare-relay ./cmd/relay

FROM alpine:latest

# Install frps
RUN apk add --no-cache curl \
    && curl -fSL https://github.com/fatedier/frp/releases/download/v0.61.1/frp_0.61.1_linux_amd64.tar.gz -o frp.tar.gz \
    && tar -zxvf frp.tar.gz \
    && mv frp_0.61.1_linux_amd64/frps /usr/local/bin/ \
    && rm -rf frp_0.61.1_linux_amd64 frp.tar.gz \
    && chmod +x /usr/local/bin/frps

COPY --from=builder /openflare_relay/openflare-relay /usr/local/bin/openflare-relay

VOLUME ["/var/lib/openflare-relay"]

CMD ["openflare-relay", "-config", "/etc/openflare-relay/relay.json"]
