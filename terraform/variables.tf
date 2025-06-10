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

variable "digital_ocean_ssh_key_name" { 
  description = "DigitalOcean SSH Key Name"
  type        = string
  sensitive   = true
}

variable "digital_ocean_ssh_private_key" {
  description = "DigitalOcean SSH Private Key"
  type        = string
} 