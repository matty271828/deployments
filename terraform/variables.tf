variable "cloudflare_api_token" {
  description = "Cloudflare API Token"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare Account ID"
  type        = string
}

variable "domains" {
  description = "List of domains to manage"
  type        = list(string)
}

variable "digital_ocean_api_token" {
  description = "DigitalOcean API token"
  type        = string
  sensitive   = true
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

variable "droplet_name" {
  description = "Name of the DigitalOcean droplet to use for the load balancer"
  type        = string
  default     = "main-droplet"  # Default value, can be overridden in terraform.tfvars
} 