# worker-align (ADR 0006, ADR 0010):
#   - Montreal Forced Aligner 3.4.3 (MIT) + Vietnamese MFA models v3.0.0 (CC BY 4.0): word timing.
#   - whisper.cpp v1.9.5 (MIT) + ggml model (OpenAI Whisper weights, MIT): speech-to-text for uploaded
#     audio/video (US4). Recognition only; timings always come from MFA.
# Build: docker build -f docker/worker-align.Dockerfile -t makvid-align .
FROM debian:bookworm-slim AS whisper
RUN apt-get update && apt-get install -y --no-install-recommends build-essential cmake git ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /opt
ARG WHISPER_MODEL=small
RUN git clone --depth 1 --branch v1.9.5 https://github.com/ggml-org/whisper.cpp.git \
 && cmake -S whisper.cpp -B whisper.cpp/build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF \
      -DWHISPER_BUILD_TESTS=OFF -DGGML_NATIVE=OFF \
 && cmake --build whisper.cpp/build -j --config Release --target whisper-cli \
 && sh whisper.cpp/models/download-ggml-model.sh ${WHISPER_MODEL} \
 && mkdir -p /out && cp whisper.cpp/build/bin/whisper-cli /out/ \
 && cp whisper.cpp/models/ggml-${WHISPER_MODEL}.bin /out/model.bin \
 && cp whisper.cpp/LICENSE /out/WHISPER_CPP_LICENSE

FROM mambaorg/micromamba:2.10.0
RUN micromamba install -y -n base -c conda-forge python=3.11 montreal-forced-aligner=3.4.3 \
 && micromamba clean -a -y
ARG MAMBA_DOCKERFILE_ACTIVATE=1
RUN mfa model download acoustic vietnamese_mfa \
 && mfa model download dictionary vietnamese_mfa \
 && mfa model download g2p vietnamese_hanoi_mfa
COPY --from=whisper /out/ /opt/whisper/
WORKDIR /app
COPY apps/worker-align/server.py ./server.py
ENV PORT=8090 MFA_JOBS=4 WHISPER_BIN=/opt/whisper/whisper-cli WHISPER_MODEL_PATH=/opt/whisper/model.bin \
    WHISPER_THREADS=4
EXPOSE 8090
CMD ["python", "/app/server.py"]
