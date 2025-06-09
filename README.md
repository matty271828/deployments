# Deployments

A scalable and cost-effective deployment solution for managing multiple projects on shared infrastructure using Terraform and GitHub Actions.

## Overview

This repository provides an automated deployment pipeline that enables multiple projects to be deployed to shared infrastructure resources, optimizing costs while maintaining isolation and security. The solution uses Terraform for infrastructure provisioning and GitHub Actions for automated deployments.

## How It Works

1. **Project Setup**:
   - Users create their own repositories containing their application code (frontend and/or backend)
   - No special configuration is required in the user's repository
   - The deployment process is handled entirely by this repository

2. **Deployment Process**:
   - Users provide their repository name and desired domain name
   - This repository handles all infrastructure provisioning and deployment
   - Applications are automatically deployed to shared infrastructure
   - Each project is isolated within the shared infrastructure
   - Repository contents are accessed directly via GitHub's API

## Key Features

- **Multi-tenant Infrastructure**: Multiple projects can be deployed to the same DigitalOcean droplet, reducing infrastructure costs
- **Idempotent Deployments**: Safe and reliable deployments that can be run multiple times without side effects
- **Infrastructure as Code**: All infrastructure is managed through Terraform, ensuring consistency and version control
- **Automated Workflows**: GitHub Actions automate the deployment process based on repository events
- **Shared Resources**: Common infrastructure components (droplets, databases) are shared across projects when possible

## Deployment Process

1. **Infrastructure Provisioning**:
   - Terraform manages the creation and configuration of domain records, load balancer, DigitalOcean virtual machine and nginx configuration.
   - Infrastructure is created only if it doesn't already exist
   - New projects are deployed to existing infrastructure when possible

2. **Project Deployment**:
   - Triggered via GitHub Actions
   - Requires repository name and domain name as inputs
   - Builds and deploys the application to personal infrastructure.

## Usage

To deploy a new project:

1. Ensure your application repository is ready for deployment
2. Fork this repo and add the following as github secrets: 
   * Cloudflare user name
   * Cloudflare password
3. Navigate to the actions tab and configure the deployment with:
   - Your repository name
   - Desired domain name
4. Trigger the deployment workflow

The deployment system will:
- Deploy cloud flare infrastructure including full DNS setup
- Build your application
- Deploy it to the shared infrastructure
- Configure all necessary networking and security settings