# M2 spike: Montreal Forced Aligner (MIT) + Vietnamese MFA models v3.0.0 (CC BY 4.0, attribution required).
FROM mambaorg/micromamba:2.10.0
RUN micromamba install -y -n base -c conda-forge python=3.11 montreal-forced-aligner=3.4.3 \
 && micromamba clean -a -y
ARG MAMBA_DOCKERFILE_ACTIVATE=1
RUN mfa model download acoustic vietnamese_mfa \
 && mfa model download dictionary vietnamese_mfa \
 && mfa model download g2p vietnamese_hanoi_mfa \
 && mfa model list acoustic && mfa model list dictionary
WORKDIR /work
ENTRYPOINT ["/usr/local/bin/_entrypoint.sh"]
