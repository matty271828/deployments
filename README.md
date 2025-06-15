# Deployments

A serverless deployment platform for frontend applications with built-in authentication and database support.

## Overview

This platform provides a streamlined deployment solution for frontend applications using Cloudflare's infrastructure. Each project gets:
- A Cloudflare Pages deployment
- A dedicated D1 database
- Access to shared authentication services
- Automatic DNS configuration

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cloudflare Infrastructure                │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │  Project 1  │    │  Project 2  │    │  Project N  │          │
│  │  Frontend   │    │  Frontend   │    │  Frontend   │          │
│  │  (Pages)    │    │  (Pages)    │    │  (Pages)    │          │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘          │
│         │                  │                  │                 │
│         └──────────────────┼──────────────────┘                 │
│                            │                                    │
│                    ┌───────▼───────┐                            │
│                    │   Shared      │                            │
│                    │  Auth Service │                            │
│                    │   (Worker)    │                            │
│                    └───────┬───────┘                            │
│                            │                                    │
│                    ┌───────▼───────┐                            │
│                    │   Shared      │                            │
│                    │  Auth D1 DB   │                            │
│                    └───────┬───────┘                            │
│                            │                                    │
│                            │                                    │
│                            │                                    │
│                            ▼                                    │
│          ┌─────────────────────────────────────┐                │
│          │                  │                  │                │
│  ┌───────▼─────┐    ┌───────▼─────┐    ┌───────▼─────┐          │
│  │  Project 1  │    │  Project 2  │    │  Project N  │          │
│  │    D1 DB    │    │    D1 DB    │    │    D1 DB    │          │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Architecture

- **Frontend**: Deployed to Cloudflare Pages with automatic builds and redeployments on every push to the main branch
- **Database**: Each project gets a dedicated D1 database
- **Authentication**: Centralized auth service running on Cloudflare Workers
- **Infrastructure**: Managed via Terraform and GitHub Actions

## Cost & Limitations

This platform is completely free to use within Cloudflare's generous free tier limits:

- **Pages**: 
  - Unlimited sites
  - 500 builds per month
  - 100,000 requests per day
  - 500GB bandwidth per month

- **Workers**:
  - 100,000 requests per day
  - 128MB memory per request
  - 30ms CPU time per request

- **D1 Databases**:
  - 10 databases total
  - 10GB total storage
  - 1,000,000 read operations per day
  - 100,000 write operations per day

Note: The auth service uses one D1 database, so the platform can support up to 9 additional projects before requiring a paid plan.

## Deployment

1. Fork this repository
2. Add required secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `GH_PERSONAL_ACCESS_TOKEN`
3. Run the deployment workflow with:
   - Your frontend repository URL
   - Your acquired domain name

The system will automatically:
- Configure DNS and SSL for each domain
- Set up Cloudflare Pages
- Provision a D1 database for each project
- Deploy the auth service
- Configure all necessary bindings

## Customization

For projects requiring custom backend services, deploy their backends separately and integrate with the frontend application.