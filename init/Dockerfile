FROM alpine:3.20

RUN apk add --no-cache ca-certificates coreutils curl jq

COPY participant-init.sh /usr/local/bin/participant-init
RUN chmod +x /usr/local/bin/participant-init

ENTRYPOINT ["/usr/local/bin/participant-init"]
