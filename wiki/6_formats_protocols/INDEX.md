# 📡 음원 포맷 및 네트워크 규격 (Formats & Protocols)

디지털 오디오 데이터의 수치 표기법, 무손실 압축 포맷, 유/무선 공유 프로토콜 및 비트퍼펙트 시그널 컨버팅의 인덱스입니다.

---

## 🗂️ 세부 항목 목차

### 1. 데이터 포맷 및 메타데이터 (Formats & Tags)
* [32-bit Float (부동소수점)](audio_formats_metadata/32-bit_Float.md) - 정수값 오버플로우 한계를 없애, 큰 소리가 나도 디지털 파형이 찢어지는 클리핑(Clipping)이 전혀 발생하지 않는 무한대 레코딩 오디오 포맷.
* [PCM (WAV)](audio_formats_metadata/PCM.md) - 시간축(Sample Rate)과 높이(Bit)로 파형을 격자 변조하여 기록하는 디지털 작곡/사운드 편집의 기본 비압축 오디오 표준.
* [DSD (Direct Stream Digital)](audio_formats_metadata/DSD.md) - 1비트 신호를 메가헤르츠(MHz) 단위의 고속 펄스 밀도 변조로 다이렉트 변환하여 아날로그 음원에 가까운 포근함과 배음을 내는 SACD용 하이엔드 규격.
* [무손실 압축 포맷 (FLAC / ALAC)](audio_formats_metadata/FLAC_ALAC.md) - 음질 변형이 0%인 무손실 비트를 보장하면서 WAV 용량을 절반으로 압축하는 FLAC(범용) 및 ALAC(애플 생태계 최적) 코덱 비교.
* [메타데이터 태그 규격 (ID3 / Vorbis Comment)](audio_formats_metadata/Metadata_Tags.md) - 음악 정보와 자켓 아트를 오디오 헤더에 탑재하는 ID3(MP3용) 및 Vorbis Comment(FLAC용) 텍스트 태그 규격.
* [DDEX (디지털음악 교환 표준)](audio_formats_metadata/DDEX.md) - 음반 유통사와 배급사 간 메타데이터와 권리 정보 소통 오차를 방지하기 위해 마련된 글로벌 XML 데이터 교환 규약.
* [ALBUMARTIST 태그 (라이브러리 통합)](audio_formats_metadata/AlbumArtist.md) - 컴필레이션이나 피쳐링 참여가 많은 음원에서 앨범 리스트가 여러 개로 조각나는 불량을 막기 위해 대표 가수로 묶는 메타데이터 관리의 핵심 요건.

### 2. 네트워크 및 전송 프로토콜 (Protocols)
* [USB Audio Class (UAC 2.0 / UAC 1.0)](network_transmission/UAC2.md) - 호환성 위주의 UAC 1.0(최대 24비트/96kHz)과 하이파이 고해상도 DSD 전송을 지원하는 UAC 2.0(32비트/768kHz 지원) 전송 대역의 규격적 특징.
* [에어플레이 (AirPlay)](network_transmission/AirPlay.md) - 와이파이 망을 타는 애플의 무선 전송 방식으로, 에어플레이 1세대가 16-bit/44.1kHz(CD 화질) 무손실 ALAC 비트 퍼펙트 전송을 보증하는 음질적 특성.
* [SMB (Samba v2 & v3)](network_transmission/SMB.md) - 랜섬웨어 위협이 심각한 SMB v1을 버리고 보안 암호화가 강화되어 로컬 기기간 고속 무손실 파일 스트리밍 공유를 제공하는 표준 공유 프로토콜.
* [SFTP 암호화 파일전송](network_transmission/SFTP.md) - 보안 SSH(Secure Shell) 터널 내부에서 암호 파일 전송과 음악 원격 재생 패킷을 안전하게 호송하는 전송 규격.
* [WebDAV 원격 웹폴더](network_transmission/WebDAV.md) - HTTP/HTTPS 웹 통신망을 사용하여 외부 방화벽에 막힘 없이 맥북 홈서버 폴더를 스마트폰/DAP의 외장 드라이브로 직접 마운트해 재생하도록 돕는 규격.
* [NTLM 해시 (보안 주의)](network_transmission/NTLM_Hash.md) - 구형 윈도우 네트워크 공유에서 비밀번호 인증에 사용했으나 암호 분석 취약점이 높아 홈서버 구축 시 비활성화해야 하는 보안 규격.

### 3. 데이터 처리 기술 (Processing)
* [비트 퍼펙트 (Bit-Perfect)](audio_processing/Bit-Perfect.md) - 음원의 원래 바이너리 데이터 값이 기기 OS의 드라이버 믹싱 필터를 전혀 타지 않고 그대로 물리 DAC 회로에 도달하여 마스터링 스튜디오 품질 100%를 재생하는 상태.
* [다운샘플링 & 리샘플링](audio_processing/Resampling.md) - 기기 호환을 위해 주파수 대역 정보를 축소하는 다운샘플링과, 서로 다른 오디오 소스를 동시 출력하기 위해 주파수를 강제 변환하는 리샘플링의 기술적 특징.
* [SRC (Sample Rate Conversion)](audio_processing/SRC.md) - 안드로이드/iOS 시스템 믹서가 다중 알림음을 처리하기 위해 강제로 48kHz 등으로 리샘플링하여 미세 지터 잡음 및 음색 일그러짐을 만드는 과정과 우회법.
* [트랜스코딩 (실시간 변환)](audio_processing/Transcoding.md) - 모바일 야외망 대역폭이 좁아 음악이 끊길 시 서버가 실시간으로 무거운 원본 FLAC을 MP3/AAC/OPUS 등으로 인코딩하여 전송해주는 변환 처리 기법.
