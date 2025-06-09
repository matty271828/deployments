resource "cloudflare_zone" "domain" {
  account_id = var.cloudflare_account_id
  zone       = var.domain
} 