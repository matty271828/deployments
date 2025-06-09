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
  description = "Map of domains to be added to Cloudflare with their configurations"
  type = map(object({
    name = string
    # Add any additional domain-specific configurations here
    # For example:
    # plan = string
    # type = string
  }))
} 