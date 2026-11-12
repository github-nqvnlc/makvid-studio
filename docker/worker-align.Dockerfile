# worker-align (ADR 0006): Montreal Forced Aligner 3.4.3 (MIT) + Vietnamese MFA models v3.0.0 (CC BY 4.0).
# Build: docker build -f docker/worker-align.Dockerfile -t makvid-align .
FROM mambaorg/micromamba:2.10.0
RUN micromamba install -y -n base -c conda-forge python=3.11 montreal-forced-aligner=3.4.3 \
 && micromamba clean -a -y
ARG MAMBA_DOCKERFILE_ACTIVATE=1
RUN mfa model download acoustic vietnamese_mfa \
 && mfa model download dictionary vietnamese_mfa \
 && mfa model download g2p vietnamese_hanoi_mfa
WORKDIR /app
COPY apps/worker-align/server.py ./server.py
ENV PORT=8090 MFA_JOBS=4
EXPOSE 8090
CMD ["python", "/app/server.py"]
