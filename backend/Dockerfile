#====================================
# build stage
#======================================
FROM golang:1.22-alpine AS builder

RUN apk update && apk add -no-cache ca-certificates tzdata

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLE=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o server main.go

#=================================================
#Run Stage
#================================================
FROM scratch AS runner

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=builder /app/server /server

ENV TZ=Asia/Tokyo

EXPOSE 8080

ENTRYPOINT ["/server"]