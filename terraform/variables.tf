variable "cloudflare_api_token" {
  description = "Cloudflare API Token"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare Account ID"
  type        = string
}

variable "domain" {
  description = "Domain Name"
  type = string
}

variable "DIGITAL_OCEAN_SSH_KEY_NAME" {git 
  description = "DigitalOcean SSH Key Name"
  type        = string
  sensitive   = true
}

variable "DIGITAL_OCEAN_SSH_PRIVATE_KEY" {
  description = "DigitalOcean SSH Private Key"
  type        = string
} 