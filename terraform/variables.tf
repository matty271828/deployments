variable "cloudflare_api_token" {
  description = "Cloudflare API Token"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare Account ID"
  type        = string
}

variable "domains_json" {
  description = "JSON string containing the list of domains and their frontend repos from GitHub Actions"
  type        = string
}