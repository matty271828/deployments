```
___ _______ _   _____   __  ______  ________   
|  \|___|__]|   |  | \_/ |\/||___|\ | | [__ 
|__/|___|   |___|__|  |  |  ||___| \| | ___] 
                                                                              
```

A serverless deployment platform for frontend applications with built-in authentication and database support.

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange?style=flat-square&logo=cloudflare)](https://workers.cloudflare.com/)
[![D1 Database](https://img.shields.io/badge/Cloudflare-D1-blue?style=flat-square&logo=cloudflare)](https://developers.cloudflare.com/d1/)
[![R2 Object Storage](https://img.shields.io/badge/Cloudflare-R2-purple?style=flat-square&logo=cloudflare)](https://developers.cloudflare.com/r2/)
[![Pages](https://img.shields.io/badge/Cloudflare-Pages-yellow?style=flat-square&logo=cloudflare)](https://pages.cloudflare.com/)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

## 📑 Table of Contents
- [Overview](#-overview)
- [Quick Start](#-quick-start)
- [Prerequisites](#-prerequisites)
- [Supported Frontend Frameworks](#-supported-frontend-frameworks)
- [Important Notes](#-important-notes)
- [Architecture](#-architecture)
- [Authentication Service](#authentication-service)
- [Future Plans](#future-plans)
- [Cost & Limitations](#-cost--limitations)
- [Disclaimer](#-disclaimer)
- [Customization](#-customization)
- [Contributing](#-contributing)

## 📋 Overview

This platform provides a streamlined deployment solution for frontend applications using Cloudflare's infrastructure. Each project gets:
- 🏗️ A Cloudflare Pages deployment
- 💾 A dedicated D1 database
- 🔐 Access to shared authentication services
- 🌐 Automatic DNS configuration

## 🚀 Quick Start

### 1. Use This Template

Click the **"Use this template"** button at the top of this repository to create a new repository from this template. This will give you your own copy of the deployment platform.

### 2. Setup Required Accounts

#### Cloudflare Account Setup
- Create a [Cloudflare account](https://dash.cloudflare.com/sign-up) if you don't have one
- Note your **Account ID** from the dashboard (found in the right sidebar)
- Enable **R2 Object Storage** in your Cloudflare dashboard:
  - Go to **R2 Object Storage** in the sidebar
  - Click **"Get started with R2"**
  - **Important**: You'll need to add payment information to enable R2, even though we'll stay well within the free tier limits
  - Follow the setup process (this is required for the platform to work)

> **💳 Payment Information Required**: Cloudflare requires payment information to enable R2 Object Storage, even for free tier usage. The platform uses R2 to store Terraform state files (typically <1MB per project) and will never approach the free tier limits (10GB storage, 1M Class A operations, 10M Class B operations per month).

#### Create Cloudflare API Token
Create a Cloudflare API token with the following permissions:
- **Account Settings**: Read
- **Workers**: Edit
- **Pages**: Edit
- **D1**: Edit
- **DNS**: Edit
- **R2**: Edit

1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click **"Create Token"**
3. Use the **"Custom token"** template
4. Add the permissions listed above
5. Set **Account Resources** to "All accounts"
6. Set **Zone Resources** to "All zones"
7. Save the token securely

#### Create GitHub Personal Access Token
Create a GitHub Personal Access Token with:
- `repo` scope (for private repositories)
- `workflow` scope (for GitHub Actions)

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click **"Generate new token (classic)"**
3. Select the required scopes
4. Save the token securely

### 3. Configure Repository Secrets

In your new repository (created from the template), add the following secrets:

1. Go to **Settings** > **Secrets and variables** > **Actions**
2. Click **"New repository secret"**
3. Add each of these secrets:

```
CLOUDFLARE_ACCOUNT_ID    # Your Cloudflare account ID
CLOUDFLARE_API_TOKEN     # Your Cloudflare API token
GH_PERSONAL_ACCESS_TOKEN # Your GitHub personal access token
```

### 4. Deploy Your First Project

Once your secrets are configured, you can deploy your first project:

1. **Prepare Your Frontend**: Ensure your frontend is a Vite-based project in a separate repository
2. **Run the Deployment Workflow**:
   - Go to **Actions** tab in your repository
   - Select **"Deploy New Project"** workflow
   - Click **"Run workflow"**
   - Provide:
     - **Frontend Repository URL**: Your Vite project's GitHub repository URL
     - **Domain Name**: The domain you want to deploy to (e.g., `app.yourdomain.com`)

The system will automatically:
- Configure DNS and SSL for your domain
- Set up Cloudflare Pages deployment
- Provision a D1 database for your project
- Deploy the authentication service
- Configure all necessary bindings and environment variables

### 5. Access Your Deployed Application

After deployment completes (usually 2-3 minutes), your application will be available at your specified domain with:
- ✅ Frontend deployed to Cloudflare Pages
- ✅ Authentication service running
- ✅ Database provisioned and connected
- ✅ SSL certificate automatically configured

## 📋 Prerequisites

Before using this platform, ensure you have:

- ✅ A Cloudflare account with R2 enabled
- ✅ A domain name (can be a subdomain)
- ✅ A Vite-based frontend project in a GitHub repository
- ✅ GitHub Personal Access Token with required permissions
- ✅ Cloudflare API Token with required permissions

## 🔧 Supported Frontend Frameworks

Currently, this platform supports:
- **Vite** projects (React, Vue, Svelte, etc.)
- **Static sites** (HTML/CSS/JS)

Support for other frameworks (Next.js, Nuxt, etc.) will be added in future updates.

## 🚨 Important Notes

- **R2 Requirement**: You must enable R2 Object Storage in your Cloudflare account before deployment
  - R2 is used to store Terraform state files for infrastructure management
  - Payment information is required to enable R2, even for free tier usage
  - Usage is minimal (<1MB per project) and well within free tier limits
- **Domain Ownership**: You must own the domain you're deploying to
- **Vite Projects Only**: Currently only supports Vite-based frontend projects
- **Free Tier Limits**: Be aware of Cloudflare's free tier limitations (see Cost & Limitations section)

## 🏗️ Architecture

- **Frontend**: Deployed to Cloudflare Pages with automatic builds and redeployments on every push to the main branch
- **Database**: Each project gets a dedicated D1 database
- **Authentication**: Centralized auth service running on Cloudflare Workers
- **Infrastructure**: Managed via Terraform and GitHub Actions

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

## Authentication Service

The platform includes a centralized authentication service built with:
- **Framework**: Lucia Auth running on a Cloudflare Worker
- **Database**: D1 SQL database for user management and sessions
- **Routing**: Each project's auth requests are automatically routed to their respective database

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

## ⚠️ Disclaimer

This platform is provided "as is" without any warranties. By using this template and platform:

- **No Guarantees**: We make no guarantees about uptime, performance, or suitability for any purpose.
- **User Responsibility**: You are responsible for your own deployments, data, and compliance with applicable laws.
- **Cloudflare Services**: This platform relies on Cloudflare services which may have their own limitations, downtime, or policy changes.
- **No Liability**: We are not liable for any damages, data loss, or issues arising from the use of this platform.
- **Third-Party Services**: We are not responsible for the actions, policies, or changes made by Cloudflare, GitHub, or other third-party services.
- **Security**: While we strive for security best practices, you are responsible for securing your own applications and data.
- **Costs**: You are responsible for all costs incurred through Cloudflare or other services, including any accidental charges that may occur.

Use this platform at your own risk and ensure you understand the implications of deploying infrastructure and applications.

## 🛠️ Customization

For projects requiring custom backend services, deploy their backends separately and integrate with the frontend application.

## 🤝 Contributing

We welcome contributions to make this platform better! We would like this to become an open-source project, and your help is appreciated.

### How to Contribute

1. **Fork the Repository**: Create your own fork of this template repository.
2. **Make Changes**: Implement your improvements or bug fixes.
3. **Test Your Changes**: Deploy and test your changes.
4. **Submit a Pull Request**: Create a PR with a clear description and evidence of your testing.
