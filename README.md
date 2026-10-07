# Pipeline CI/CD Automatizado para API REST

## Arquitectura
Este proyecto implementa una API REST desarrollada en Node.js (Express) con base de datos SQLite. La infraestructura se apoya en un contenedor Docker desplegado en una instancia AWS EC2 (Ubuntu). La integración y entrega continua (CI/CD) se gestiona a través de GitHub Actions.

## Comandos Locales
1. Instalar dependencias: `pnpm install`
2. Ejecutar servidor local: `pnpm start`
3. Ejecutar pruebas unitarias y cobertura: `pnpm test`

## Pasos de Configuración de CI/CD
El archivo `.github/workflows/main.yml` realiza las siguientes etapas:
1. **Testing:** Ejecuta Jest para validar los 10 endpoints con la BD en memoria.
2. **Build & Push:** Empaqueta la imagen y la envía a Docker Hub usando los tags `latest` y el SHA del commit.
3. **Deploy:** Se conecta mediante SSH a la instancia EC2, detiene la versión anterior y levanta el nuevo contenedor exponiendo los puertos 80 y 6061.3. **Deploy:** Se conecta mediante SSH a la instancia EC2, detiene la versión anterior y levanta el nuevo contenedor exponiendo los puertos 80 y 6061.