FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN addgroup --system farah && adduser --system --ingroup farah farah
COPY pyproject.toml requirements.txt ./
RUN --mount=type=cache,target=/root/.cache/pip python -c "import subprocess,tomllib; dependencies=tomllib.load(open('pyproject.toml','rb'))['project']['dependencies']; subprocess.check_call(['pip','install',*dependencies])"
COPY . .
USER farah
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
