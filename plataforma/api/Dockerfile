FROM python:3.14-slim

ARG TERRAFORM_VERSION=1.16.6
ARG PULUMI_VERSION=3.272.0
ARG GITLEAKS_VERSION=8.30.1
ARG CHECKOV_VERSION=3.4.4

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl unzip git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSLo /tmp/terraform.zip "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip" \
    && unzip -q /tmp/terraform.zip terraform -d /usr/local/bin \
    && rm /tmp/terraform.zip \
    && curl -fsSL "https://get.pulumi.com/releases/sdk/pulumi-v${PULUMI_VERSION}-linux-x64.tar.gz" | tar -xz -C /opt \
    && curl -fsSL "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz" \
       | tar -xz -C /usr/local/bin gitleaks

COPY --from=ghcr.io/astral-sh/uv:0.12.18 /uv /uvx /usr/local/bin/

ENV UV_TOOL_DIR=/opt/uv-tools \
    UV_TOOL_BIN_DIR=/usr/local/bin \
    UV_PYTHON_INSTALL_DIR=/opt/uv-python \
    UV_LINK_MODE=copy

RUN uv tool install --python 3.12 "checkov==${CHECKOV_VERSION}"

WORKDIR /app

COPY plataforma/api/pyproject.toml plataforma/api/uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

COPY infraestructure/tenant/pulumi/pyproject.toml infraestructure/tenant/pulumi/uv.lock repo/infraestructure/tenant/pulumi/
RUN cd repo/infraestructure/tenant/pulumi && uv sync --locked

COPY plataforma/planes.yaml repo/plataforma/planes.yaml
COPY infraestructure/modules repo/infraestructure/modules
COPY infraestructure/tenant repo/infraestructure/tenant
COPY plataforma/api/plataforma ./plataforma

ARG VERSION=dev
ENV PLATAFORMA_VERSION=${VERSION} \
    PATH="/app/.venv/bin:/opt/pulumi:${PATH}" \
    PULUMI_SKIP_UPDATE_CHECK=true \
    PYTHONUNBUFFERED=1

EXPOSE 8000
CMD ["uvicorn", "plataforma.main:app", "--host", "0.0.0.0", "--port", "8000"]
