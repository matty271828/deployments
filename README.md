___ _______ _   _____   __  ______  ________   
|  \|___|__]|   |  | \_/ |\/||___|\ | | [__ 
|__/|___|   |___|__|  |  |  ||___| \| | ___] 
                                                                              
```

A serverless deployment platform for frontend applications with built-in authentication and database support.

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange?style=flat-square&logo=cloudflare)](https://workers.cloudflare.com/)
[![D1 Database](https://img.shields.io/badge/Cloudflare-D1-blue?style=flat-square&logo=cloudflare)](https://developers.cloudflare.com/d1/)
[![Pages](https://img.shields.io/badge/Cloudflare-Pages-yellow?style=flat-square&logo=cloudflare)](https://pages.cloudflare.com/)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

## 📑 Table of Contents
- [Overview](#-overview)
- [Architecture](#-architecture)
- [Cost & Limitations](#-cost--limitations)
- [Deployment](#-deployment)
- [Customization](#-customization)
- [AI-Powered Development](#-ai-powered-development)

## 📋 Overview

This platform provides a streamlined deployment solution for frontend applications using Cloudflare's infrastructure. Each project gets:
- 🏗️ A Cloudflare Pages deployment
- 💾 A dedicated D1 database
- 🔐 Access to shared authentication services
- 🌐 Automatic DNS configuration

## 🏗️ Architecture

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

## Project Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  Cloudflare Infrastructure               │
│                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│  │  Project 1  │    │  Project 2  │    │  Project N  │   │
│  │  Frontend   │    │  Frontend   │    │  Frontend   │   │
│  │  (Pages)    │    │  (Pages)    │    │  (Pages)    │   │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘   │
│         │                  │                  │          │
│         └──────────────────┼──────────────────┘          │
│                            │                             │
│                    ┌───────▼───────┐    ┌────────────┐   │
│                    │   Shared      │    │   Shared   │   │
│                    │  Auth Service │───►│ Auth D1 DB │   │
│                    │   (Worker)    │    │            │   │
│                    └───────┬───────┘    └────────────┘   │
│                            │                             │
│                            ▼                             │
│          ┌─────────────────────────────────────┐         │
│          │                 │                   │         │
│  ┌───────▼─────┐    ┌──────▼───── ┐    ┌───────▼─────┐   │
│  │  Project 1  │    │  Project 2  │    │  Project N  │   │
│  │    D1 DB    │    │    D1 DB    │    │    D1 DB    │   │
│  └─────────────┘    └─────────────┘    └─────────────┘   │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│           External Backend Services (Optional)           │
│                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│  │  Backend 1  │    │  Backend 2  │    │  Backend N  │   │
│  │  (Custom)   │    │  (Custom)   │    │  (Custom)   │   │
│  └─────────────┘    └─────────────┘    └─────────────┘   │
└──────────────────────────────────────────────────────────┘
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

## 💰 Cost & Limitations

This platform is completely free to use within Cloudflare's generous free tier limits:

- **Pages**: 
  - 📦 Unlimited sites
  - 🔄 500 builds per month
  - 📡 100,000 requests per day
  - 🌐 500GB bandwidth per month

- **Workers**:
  - ⚡ 100,000 requests per day
  - 💾 128MB memory per request
  - ⏱️ 30ms CPU time per request

- **D1 Databases**:
  - 💾 10 databases total
  - 📦 10GB total storage
  - 📖 1,000,000 read operations per day
  - ✍️ 100,000 write operations per day

Note: The auth service uses one D1 database, so the platform can support up to 9 additional projects before requiring a paid plan.

## 🚀 Deployment

1. **Setup Required Accounts**
   - Create a Cloudflare account if you don't have one
   - Note your Account ID from the dashboard
   - Create a Cloudflare API token with:
     - Account Settings: Read
     - Workers: Edit
     - Pages: Edit
     - D1: Edit
     - DNS: Edit
   - Create a GitHub Personal Access Token with:
     - `repo` scope (for private repositories)
     - `workflow` scope (for GitHub Actions)

2. **Fork and Configure**
   - Fork this repository
   - Add required secrets to your fork:
     ```
     CLOUDFLARE_ACCOUNT_ID    # Your Cloudflare account ID
     CLOUDFLARE_API_TOKEN     # Your Cloudflare API token
     GH_PERSONAL_ACCESS_TOKEN # Your GitHub personal access token
     ```

3. **Deploy**
   Run the deployment workflow with:
   - Your frontend repository URL (must be a Vite project)
   - Your acquired domain name

   Note: The platform currently only supports Vite-based frontend projects. 
   Support for other frameworks will be added in future updates.

The system will automatically:
- Configure DNS and SSL for each domain
- Set up Cloudflare Pages
- Provision a D1 database for each project
- Deploy the auth service
- Configure all necessary bindings

## 🛠️ Customization

For projects requiring custom backend services, deploy their backends separately and integrate with the frontend application.

## 🤖 AI-Powered Development

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