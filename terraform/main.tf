terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.5.0"
    }
  }
}

# Cloudflare Provider
provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

variable "cloudflare_api_token" {
  description = "Cloudflare API Token"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare Account ID"
  type        = string
  sensitive   = true
}

variable "aws_region" {
  description = "AWS Region for SES resources"
  type        = string
  default     = "us-east-1"
}

variable "gmail_address" {
  description = "Gmail address to forward emails to"
  type        = string
  
  validation {
    condition     = can(regex("^[a-zA-Z0-9._%+-]+@gmail\\.com$", var.gmail_address))
    error_message = "Gmail address must be a valid Gmail address ending with @gmail.com"
  }
}