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

variable "digital_ocean_api_key_name" {
  description = "DigitalOcean API key name"
  type        = string
  sensitive   = true
}

variable "digital_ocean_api_key_token" {
  description = "DigitalOcean API key token"
  type        = string
} 