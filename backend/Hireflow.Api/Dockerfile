FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src

COPY backend/Hireflow.slnx backend/Directory.Build.props backend/
COPY backend/Hireflow.Api/Hireflow.Api.csproj backend/Hireflow.Api/
COPY backend/Hireflow.Application/Hireflow.Application.csproj backend/Hireflow.Application/
COPY backend/Hireflow.Domain/Hireflow.Domain.csproj backend/Hireflow.Domain/
COPY backend/Hireflow.Infrastructure/Hireflow.Infrastructure.csproj backend/Hireflow.Infrastructure/
COPY backend/Hireflow.Tests/Hireflow.Tests.csproj backend/Hireflow.Tests/
RUN dotnet restore backend/Hireflow.Api/Hireflow.Api.csproj

COPY backend/ backend/
RUN dotnet publish backend/Hireflow.Api/Hireflow.Api.csproj \
    --configuration Release \
    --no-restore \
    --output /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS final
WORKDIR /app
COPY --from=build /app/publish .
USER $APP_UID
EXPOSE 8080

# wget ships with the Alpine base image's busybox already, so no extra package is
# installed just for this. Checks readiness (not liveness): a container that can't reach
# PostgreSQL should stop receiving new traffic even though the process itself is fine.
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/api/health/ready || exit 1

ENTRYPOINT ["dotnet", "Hireflow.Api.dll"]
