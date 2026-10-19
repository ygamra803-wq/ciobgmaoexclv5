# Deployment Guide - CIOB GMAO Light UI

## Production Build

To build the application for production:
```bash
npm run build
```

This bundles the application into static HTML/JS/CSS assets ready for deployment on any static hosting provider or container service running behind an HTTPS reverse proxy (Port 3000).

## Environment Variables
Ensure `.env` contains all necessary variables as defined in `.env.example`.
