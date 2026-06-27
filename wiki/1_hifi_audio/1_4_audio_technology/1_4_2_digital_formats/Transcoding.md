---
title_ko: "트랜스코딩"
title_en: "Transcoding"
status: "draft"
tags: [디지털 포맷, HiFi]
---
# 트랜스코딩 (Transcoding)

## 개요
네트워크 스트리밍 서버(Navidrome, Plex 등)가 음원 라이브러리를 보관하는 스토리지의 소스 파일 원본 포맷(예: 매우 무겁고 용량이 큰 24-bit/192kHz WAV 또는 FLAC)을 클라이언트 수신기(모바일 폰, DAP)로 보낼 때, 수신 기기가 해당 포맷을 지원하지 못하거나 무선 통신망(5G/LTE) 상태가 나빠 끊길 우려가 있을 시, 서버 내부 CPU 연산을 통해 실시간으로 하위 포맷(예: AAC 256kbps 또는 MP3 320kbps)으로 인코딩 변환하여 패킷 전송을 처리해주는 데이터 변환 메커니즘입니다.
