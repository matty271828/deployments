# Deployments

A serverless deployment platform for frontend applications with built-in authentication and database support.

## Overview

This platform provides a streamlined deployment solution for frontend applications using Cloudflare's infrastructure. Each project gets:
- A Cloudflare Pages deployment
- A dedicated D1 database
- Access to shared authentication services
- Automatic DNS configuration

## Architecture

- **Frontend**: Deployed to Cloudflare Pages with automatic builds and redeployments on every push to the main branch
- **Database**: Each project gets a dedicated D1 database
- **Authentication**: Centralized auth service running on Cloudflare Workers
- **Infrastructure**: Managed via Terraform and GitHub Actions

## Authentication Service

The platform includes a centralized authentication service built with:
- **Framework**: Lucia Auth running on Cloudflare Workers
- **Database**: D1 SQL database for user management and sessions
- **Routing**: Each project's auth requests are automatically routed to their respective database

### Auth Endpoints

The auth service exposes the following endpoints:

- `GET /auth/health` - Service health check
- `POST /auth/signup` - User registration
- `POST /auth/login` - User authentication
- `POST /auth/logout` - Session termination
- `GET /auth/session` - Session validation
- `POST /auth/refresh` - Session token refresh

Each project can access these endpoints through their custom domain:
```bash
# Example health check
curl https://yourdomain.com/auth/health
```

The auth service automatically routes requests to the correct project's database based on the domain.

## External Backends

Projects can optionally connect to external backend services:

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
│          │                 │                   │                │
│  ┌───────▼─────┐    ┌──────▼───── ┐    ┌───────▼─────┐          │
│  │  Project 1  │    │  Project 2  │    │  Project N  │          │
│  │    D1 DB    │    │    D1 DB    │    │    D1 DB    │          │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ External Backend Services (Optional and outside of this repo)   │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │  Backend 1  │    │  Backend 2  │    │  Backend N  │          │
│  │  (Custom)   │    │  (Custom)   │    │  (Custom)   │          │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

External backends are not part of this platform and should be deployed separately. They can be integrated with your frontend application through environment variables and API calls.

## Future Plans

The platform has several planned enhancements:

1. **Standardized UI Components**
   - Shared component library for consistent user experience
   - Pre-built authentication flows and forms
   - Responsive design templates

2. **Extended Auth Service**
   - Payment processing integration
   - Social login providers
   - Multi-factor authentication
   - Role-based access control

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

## AI-Powered Development

This platform is designed to enable rapid development of full-stack SaaS applications using AI:

1. **Frontend Generation**
   - Generate frontend code using AI
   - Focus on unique business logic and UI
   - Skip boilerplate setup

2. **Instant Backend**
   - Authentication ready to go
   - Payment processing included
   - Database automatically provisioned
   - Global CDN deployment

3. **Development Workflow**
   - Generate frontend with AI
   - Deploy to platform
   - Customize as needed
   - Go live immediately

The platform handles all the complex infrastructure, allowing you to focus on building your unique application features.