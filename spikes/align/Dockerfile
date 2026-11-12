# M0 spike T009: whisper.cpp word timestamps for Vietnamese (CPU only).
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential cmake git ca-certificates curl ffmpeg espeak-ng \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /opt
RUN git clone --depth 1 --branch v1.9.5 https://github.com/ggml-org/whisper.cpp.git \
 && cmake -S whisper.cpp -B whisper.cpp/build -DCMAKE_BUILD_TYPE=Release -DWHISPER_BUILD_TESTS=OFF \
 && cmake --build whisper.cpp/build -j --config Release --target whisper-cli \
 && sh whisper.cpp/models/download-ggml-model.sh small \
 && sh whisper.cpp/models/download-ggml-model.sh medium
WORKDIR /spike
COPY *.mjs ./
ENTRYPOINT ["node"]
