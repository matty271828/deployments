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