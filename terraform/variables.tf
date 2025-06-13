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
  description = "Domain name to add"
  type        = string
}

variable "domains" {
  description = "List of domains and their frontend repos in format 'domain|frontend_repo'"
  type        = list(string)
} 